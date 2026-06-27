from flask import Flask, render_template, Response, jsonify
import cv2
import datetime as dt
import time
import os
import requests
import numpy as np
import html
import smtplib
import threading
from email.message import EmailMessage
from email.utils import formataddr

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    firebase_admin = None
    firestore = None

app = Flask(__name__)

# ESP32 URL (IMPORTANT)
ESP32_URL = "http://192.168.0.112/capture"
MISSING_THRESHOLD_SECONDS = 5
ALERT_COOLDOWN_SECONDS = 60
FIREBASE_ALERT_COLLECTION = "incubator_alerts"
FIREBASE_ALERT_COLLECTIONS = (FIREBASE_ALERT_COLLECTION, "alerts")
FIREBASE_INCUBATOR_COLLECTION = "incubator"
FIREBASE_BATCHED_ALERT_DOCUMENT = "alerts"
FIREBASE_USER_COLLECTION = "users"
ALERT_EMAIL_RECIPIENT_ROLES = {"admin", "parent"}
ALERT_EMAIL_SENT_FIELD = "emailNotificationSent"
ALERT_EMAIL_ATTEMPTED_FIELD = "emailNotificationAttempted"

# Face detector (built-in)
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

last_seen = time.time()
baby_present = False
status_text = "Initializing....."
last_alert_push = 0
firestore_client = None
alert_listener_watch = None
alert_listener_watches = []
alert_listener_started = False
alert_listener_lock = threading.Lock()
alert_listener_ready = False
alert_collection_ready = {}
batched_alert_listener_ready = False
batched_alert_seen_keys = set()


def init_firestore():
    """Initialize Firebase Admin SDK once and reuse the Firestore client."""
    global firestore_client

    if firestore_client is not None:
        return firestore_client

    if firebase_admin is None or firestore is None:
        print("[Firebase] firebase_admin not installed; alerts disabled.")
        return None

    try:
        firebase_admin.get_app()
    except ValueError:
        cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH") or os.environ.get(
            "GOOGLE_APPLICATION_CREDENTIALS"
        )
        if cred_path:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # Allow Application Default Credentials (e.g., GCE, Cloud Run)
            firebase_admin.initialize_app()

    try:
        firestore_client = firestore.client()
        print("[Firebase] Firestore client initialized.")
    except Exception as exc:
        firestore_client = None
        print(f"[Firebase] Unable to initialize Firestore client: {exc}")

    return firestore_client


def push_baby_missing_alert():
    """Send a critical alert to Firestore when the baby is missing."""
    global last_alert_push

    db = init_firestore()
    if db is None:
        return

    now = time.time()
    if now - last_alert_push < ALERT_COOLDOWN_SECONDS:
        return

    alert_payload = {
        "type": "Baby removed detected",
        "severity": "critical",
        "message": "Vision service reports no infant presence for more than 5 seconds.",
        "resolved": False,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "source": "cv_presence_service",
        "cameraUrl": ESP32_URL,
        "present": False,
    }

    try:
        db.collection(FIREBASE_ALERT_COLLECTION).add(alert_payload)
        last_alert_push = now
        print("[Firebase] Baby missing alert pushed to Firestore.")
    except Exception as exc:
        print(f"[Firebase] Failed to push alert: {exc}")


def start_alert_email_listener():
    global alert_listener_ready, alert_listener_started, alert_listener_watch
    global alert_listener_watches, alert_collection_ready
    global batched_alert_listener_ready, batched_alert_seen_keys

    if not alert_email_enabled():
        print("[Email] Alert email listener disabled.")
        return None

    with alert_listener_lock:
        if alert_listener_started:
            return alert_listener_watches

        db = init_firestore()
        if db is None:
            return None

        alert_listener_ready = False
        alert_collection_ready = {
            collection_name: False for collection_name in FIREBASE_ALERT_COLLECTIONS
        }
        batched_alert_listener_ready = False
        batched_alert_seen_keys = set()
        alert_listener_watches = []

        for collection_name in FIREBASE_ALERT_COLLECTIONS:
            alert_listener_watches.append(
                db.collection(collection_name).on_snapshot(
                    alert_collection_snapshot_handler(collection_name)
                )
            )

        alert_listener_watches.append(
            db.collection(FIREBASE_INCUBATOR_COLLECTION)
            .document(FIREBASE_BATCHED_ALERT_DOCUMENT)
            .on_snapshot(handle_batched_alert_snapshot)
        )
        alert_listener_watch = alert_listener_watches[0]
        alert_listener_started = True
        print("[Email] Alert email listener started.")
        return alert_listener_watches


def alert_collection_snapshot_handler(collection_name):
    def handle_collection_snapshot(docs, changes, read_time):
        handle_alert_collection_snapshot(collection_name, docs, changes, read_time)

    return handle_collection_snapshot


def handle_alert_snapshot(docs, changes, read_time):
    handle_alert_collection_snapshot(
        FIREBASE_ALERT_COLLECTION,
        docs,
        changes,
        read_time,
    )


def handle_alert_collection_snapshot(collection_name, docs, changes, read_time):
    global alert_listener_ready

    db = init_firestore()
    if db is None:
        return

    if collection_name == FIREBASE_ALERT_COLLECTION and not alert_listener_ready:
        alert_collection_ready[collection_name] = False

    if not alert_collection_ready.get(collection_name, False):
        alert_collection_ready[collection_name] = True
        if collection_name == FIREBASE_ALERT_COLLECTION:
            alert_listener_ready = True
        print(f"[Email] Alert email listener ready for new {collection_name} alerts.")
        return

    for change in changes:
        if getattr(change, "type", None) == "REMOVED":
            continue
        process_alert_email_change(db, change.document)


def handle_batched_alert_snapshot(document_snapshots, changes, read_time):
    global batched_alert_listener_ready, batched_alert_seen_keys

    db = init_firestore()
    if db is None:
        return

    entries = batched_alert_entries(document_snapshots)
    entry_keys = {alert_identity(entry) for entry in entries}

    if not batched_alert_listener_ready:
        batched_alert_seen_keys = entry_keys
        batched_alert_listener_ready = True
        print("[Email] Batched alert email listener ready for new alerts.")
        return

    new_entries = []
    for entry in entries:
        entry_key = alert_identity(entry)
        if entry_key in batched_alert_seen_keys:
            continue
        new_entries.append(entry)

    batched_alert_seen_keys.update(entry_keys)
    for entry in new_entries:
        if entry.get(ALERT_EMAIL_ATTEMPTED_FIELD) is True:
            continue
        send_alert_email(db, entry)


def batched_alert_entries(document_snapshots):
    if document_snapshots is None:
        return []
    if isinstance(document_snapshots, (list, tuple)):
        snapshots = document_snapshots
    else:
        snapshots = [document_snapshots]

    for snapshot in snapshots:
        data = snapshot.to_dict() or {}
        entries = data.get("entries")
        if isinstance(entries, list):
            return [entry for entry in entries if isinstance(entry, dict)]
    return []


def alert_identity(alert_payload):
    explicit_id = alert_payload.get("id") or alert_payload.get("alertId")
    if explicit_id:
        return f"id:{safe_text(explicit_id, fallback='')}"

    return "|".join(
        safe_text(alert_payload.get(field), fallback="")
        for field in ("createdAt", "timestamp", "type", "severity", "message")
    )


def process_alert_email_change(db, document):
    alert_payload = document.to_dict() or {}
    document_id = getattr(document, "id", None)
    if document_id and "id" not in alert_payload:
        alert_payload["id"] = document_id
    if alert_payload.get(ALERT_EMAIL_ATTEMPTED_FIELD) is True:
        return

    sent = send_alert_email(db, alert_payload)
    update_alert_email_status(document.reference, sent)


def update_alert_email_status(reference, sent):
    if firestore is None:
        return
    try:
        reference.set(
            {
                ALERT_EMAIL_ATTEMPTED_FIELD: True,
                ALERT_EMAIL_SENT_FIELD: bool(sent),
                "emailNotificationAttemptedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
    except Exception as exc:
        print(f"[Email] Failed to mark alert email status: {exc.__class__.__name__}")


def send_alert_email(db, alert_payload):
    if not alert_email_enabled():
        return False

    config, error = alert_email_config()
    if error:
        print(f"[Email] Alert email not sent: {error}")
        return False

    try:
        recipients = alert_recipient_emails(db)
        if not recipients:
            print("[Email] Alert email not sent: no admin or parent recipients.")
            return False

        message = build_alert_email_message(config, recipients, alert_payload)
        send_email_message(config, message)
        print(f"[Email] Alert email sent to {len(recipients)} registered recipient(s).")
        return True
    except Exception as exc:
        print(f"[Email] Failed to send alert email: {exc.__class__.__name__}")
        return False


def alert_email_enabled():
    return os.environ.get("ALERT_EMAIL_ENABLED", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def alert_email_config():
    host = os.environ.get("ALERT_SMTP_HOST", "").strip()
    username = os.environ.get("ALERT_SMTP_USER", "").strip()
    password = os.environ.get("ALERT_SMTP_PASSWORD", "")
    sender = os.environ.get("ALERT_EMAIL_FROM", "").strip() or username
    use_tls = env_bool("ALERT_SMTP_USE_TLS", default=True)
    use_ssl = env_bool("ALERT_SMTP_USE_SSL", default=False)

    port, port_error = env_int("ALERT_SMTP_PORT", 587)
    if port_error:
        return None, port_error
    timeout, timeout_error = env_int("ALERT_SMTP_TIMEOUT_SECONDS", 10)
    if timeout_error:
        return None, timeout_error

    if not host:
        return None, "ALERT_SMTP_HOST is required."
    if not sender:
        return None, "ALERT_EMAIL_FROM or ALERT_SMTP_USER is required."
    if username and not password:
        return None, "ALERT_SMTP_PASSWORD is required when ALERT_SMTP_USER is set."
    if use_ssl and use_tls:
        return None, "Use ALERT_SMTP_USE_SSL or ALERT_SMTP_USE_TLS, not both."
    if port < 1 or port > 65535:
        return None, "ALERT_SMTP_PORT must be between 1 and 65535."
    if timeout < 1:
        return None, "ALERT_SMTP_TIMEOUT_SECONDS must be at least 1."

    return {
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "sender": sender,
        "use_tls": use_tls,
        "use_ssl": use_ssl,
        "timeout": timeout,
    }, None


def env_bool(name, *, default=False):
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default):
    raw_value = os.environ.get(name)
    if raw_value is None or raw_value.strip() == "":
        return default, None
    try:
        return int(raw_value), None
    except ValueError:
        return None, f"{name} must be an integer."


def alert_recipient_emails(db):
    recipients = set()
    for doc in db.collection(FIREBASE_USER_COLLECTION).stream():
        data = doc.to_dict() or {}
        role = str(data.get("role") or "").strip().lower()
        if role not in ALERT_EMAIL_RECIPIENT_ROLES:
            continue
        email = normalize_email(data.get("email"))
        if email:
            recipients.add(email)
    return sorted(recipients)


def normalize_email(value):
    if not isinstance(value, str):
        return None
    email = value.strip().lower()
    if not email or len(email) > 254:
        return None
    if any(char.isspace() for char in email):
        return None
    if email.count("@") != 1:
        return None
    local_part, domain = email.split("@", 1)
    if not local_part or not domain or "." not in domain:
        return None
    return email


def build_alert_email_message(config, recipients, alert_payload):
    severity = safe_text(alert_payload.get("severity"), fallback="Alert")
    alert_type = safe_text(alert_payload.get("type"), fallback="Incubator alert")
    alert_message = safe_text(alert_payload.get("message"), fallback="An alert was reported.")
    alert_status = "Resolved" if alert_payload.get("resolved") is True else "Open"
    alert_time = format_alert_time(
        alert_payload.get("createdAt") or alert_payload.get("timestamp")
    )

    subject = safe_header(f"Incubator Alert: {severity.title()} - {alert_type}")
    text_body = (
        "A new incubator alert is visible on the Alerts page.\n\n"
        f"Message: {alert_message}\n"
        f"Status: {alert_status}\n"
        f"Time: {alert_time}\n"
        f"Type: {alert_type}\n"
        f"Severity: {severity}\n"
    )
    html_body = (
        "<p>A new incubator alert is visible on the Alerts page.</p>"
        "<ul>"
        f"<li><strong>Message:</strong> {html.escape(alert_message)}</li>"
        f"<li><strong>Status:</strong> {html.escape(alert_status)}</li>"
        f"<li><strong>Time:</strong> {html.escape(alert_time)}</li>"
        f"<li><strong>Type:</strong> {html.escape(alert_type)}</li>"
        f"<li><strong>Severity:</strong> {html.escape(severity)}</li>"
        "</ul>"
    )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr(("Incubator Alerts", config["sender"]))
    message["To"] = config["sender"]
    message["Bcc"] = ", ".join(recipients)
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    return message


def safe_text(value, *, fallback):
    if value is None:
        return fallback
    text = str(value).strip()
    return text[:500] if text else fallback


def safe_header(value):
    return " ".join(str(value).splitlines()).strip()[:160] or "Incubator Alert"


def format_alert_time(value):
    if value is None or value == "":
        return "N/A"

    if isinstance(value, dt.datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt.timezone.utc)
        return value.isoformat()

    if isinstance(value, dt.date):
        return value.isoformat()

    if isinstance(value, dict):
        seconds = value.get("seconds")
        if seconds is None:
            seconds = value.get("_seconds")
        nanoseconds = value.get("nanoseconds")
        if nanoseconds is None:
            nanoseconds = value.get("_nanoseconds", 0)
        try:
            seconds = float(seconds)
            nanoseconds = float(nanoseconds or 0)
        except (TypeError, ValueError):
            return safe_text(value, fallback="N/A")
        return dt.datetime.fromtimestamp(
            seconds + (nanoseconds / 1_000_000_000),
            tz=dt.timezone.utc,
        ).isoformat()

    if isinstance(value, (int, float)):
        seconds = float(value)
        if abs(seconds) > 9_999_999_999:
            seconds = seconds / 1000
        return dt.datetime.fromtimestamp(seconds, tz=dt.timezone.utc).isoformat()

    return safe_text(value, fallback="N/A")


def send_email_message(config, message):
    smtp_class = smtplib.SMTP_SSL if config["use_ssl"] else smtplib.SMTP
    with smtp_class(config["host"], config["port"], timeout=config["timeout"]) as smtp:
        if config["use_tls"]:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
        if config["username"]:
            smtp.login(config["username"], config["password"])
        smtp.send_message(message)


# ----------- FRAME GENERATOR -----------
def generate_frames():
    global last_seen, baby_present, status_text

    while True:
        try:
            # Get image from ESP32
            response = requests.get(ESP32_URL, timeout=2)

            if response.status_code != 200:
                continue

            img_array = np.frombuffer(response.content, np.uint8)
            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)

            detected_baby = False

            for (x, y, w, h) in faces:
                # 👶 Simple baby logic (face size)
                if w < 100:
                    label = "Baby 👶"
                    color = (0, 255, 0)
                    detected_baby = True
                else:
                    label = "Adult 🧑"
                    color = (0, 0, 255)

                cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
                cv2.putText(
                    frame,
                    label,
                    (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    color,
                    2,
                )

            # -------- STATUS LOGIC --------
            if detected_baby:
                baby_present = True
                last_seen = time.time()
                status_text = "Baby Present 👶"
            else:
                if time.time() - last_seen > MISSING_THRESHOLD_SECONDS:
                    push_baby_missing_alert()
                    baby_present = False
                    status_text = "ALERT! Baby Missing 🚨"

            # Show status
            cv2.putText(
                frame,
                status_text,
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (255, 255, 0),
                3,
            )

            _, buffer = cv2.imencode(".jpg", frame)
            frame = buffer.tobytes()

            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"

        except Exception as e:
            print("Error:", e)
            continue


# ----------- ROUTES -----------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/video")
def video():
    return Response(
        generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame"
    )


@app.route("/status")
def status():
    return jsonify({"baby_present": baby_present, "status": status_text})


# ----------- RUN -----------
if __name__ == "__main__":
    start_alert_email_listener()
    app.run(host="0.0.0.0", port=5000)
