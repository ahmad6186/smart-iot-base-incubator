from flask import Flask, render_template, Response, jsonify
import cv2
import time
import os
import requests
import numpy as np

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

# Face detector (built-in)
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

last_seen = time.time()
baby_present = False
status_text = "Initializing..."
last_alert_push = 0
firestore_client = None


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
    app.run(host="0.0.0.0", port=5000)
