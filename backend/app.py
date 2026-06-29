import datetime as dt
import json
import math
import os
import urllib.error
import urllib.request
from functools import wraps

from flask import Flask, g, jsonify, request

try:
    import firebase_admin
    from firebase_admin import auth as firebase_auth
    from firebase_admin import credentials, firestore
except ImportError:
    firebase_admin = None
    firebase_auth = None
    credentials = None
    firestore = None

try:
    from google.api_core import exceptions as google_api_exceptions
except ImportError:
    google_api_exceptions = None

try:
    from .validation import (
        validate_actuator_update,
        validate_mode_update,
        validate_new_user_payload,
        validate_role_update,
        validate_settings_update,
        validate_uid,
    )
except ImportError:
    from validation import (
        validate_actuator_update,
        validate_mode_update,
        validate_new_user_payload,
        validate_role_update,
        validate_settings_update,
        validate_uid,
    )

try:
    from .reports import build_sensor_logs_report
except ImportError:
    from reports import build_sensor_logs_report


DEFAULT_ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
}
INCUBATOR_COLLECTION = "incubator"
USER_COLLECTION = "users"
ALERT_COLLECTIONS = ("incubator_alerts", "alerts")
REPORT_COLLECTIONS = ("incubator_reports", "reports")
ALERT_TIMESTAMP_FIELDS = ("DateTime", "dateTime", "createdAt", "timestamp")
SLASH_DATETIME_FORMATS = (
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y, %H:%M:%S",
    "%d/%m/%Y, %H:%M",
    "%d/%m/%Y %I:%M:%S %p",
    "%d/%m/%Y %I:%M %p",
    "%d/%m/%Y, %I:%M:%S %p",
    "%d/%m/%Y, %I:%M %p",
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M",
    "%m/%d/%Y, %H:%M:%S",
    "%m/%d/%Y, %H:%M",
    "%m/%d/%Y %I:%M:%S %p",
    "%m/%d/%Y %I:%M %p",
    "%m/%d/%Y, %I:%M:%S %p",
    "%m/%d/%Y, %I:%M %p",
)

_db_client = None


def load_env_file(path):
    if not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def create_app():
    app = Flask(__name__)

    register_error_handlers(app)

    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            return ("", 204)
        return None

    @app.after_request
    def apply_cors(response):
        origin = request.headers.get("Origin")
        if origin in allowed_origins():
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Headers"] = (
                "Authorization, Content-Type"
            )
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PATCH, OPTIONS"
            )
        return response

    @app.get("/api/health")
    def health():
        return jsonify(
            {
                "ok": True,
                "firebaseAdminSdkAvailable": firebase_admin is not None,
                "detectionProxyConfigured": bool(detection_service_url()),
            }
        )

    @app.route("/api/users/me", methods=["GET", "POST"])
    @require_auth
    def current_user_profile():
        return success(g.current_profile)

    @app.get("/api/users")
    @require_admin
    def list_users():
        db = get_db()
        users = [document_to_dict(doc) for doc in db.collection(USER_COLLECTION).stream()]
        users.sort(key=lambda user: (user.get("email") or "").lower())
        return success(users)

    @app.post("/api/users")
    @require_admin
    def create_user():
        payload, error = validate_new_user_payload(json_payload())
        if error:
            return failure(error, 400)

        db = get_db()
        created_user = None
        try:
            created_user = firebase_auth.create_user(
                email=payload["email"],
                password=payload["password"],
                display_name=payload["displayName"],
            )
            profile = {
                "name": payload["displayName"],
                "email": payload["email"],
                "role": payload["role"],
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
            db.collection(USER_COLLECTION).document(created_user.uid).set(
                profile, merge=False
            )
            return success(
                {"uid": created_user.uid, "email": payload["email"]},
                status=201,
            )
        except Exception:
            if created_user is not None:
                try:
                    firebase_auth.delete_user(created_user.uid)
                except Exception:
                    pass
            return failure("Unable to create user.", 500)

    @app.patch("/api/users/<uid>/role")
    @require_admin
    def update_user_role(uid):
        uid, uid_error = validate_uid(uid)
        if uid_error:
            return failure(uid_error, 400)

        role, role_error = validate_role_update(json_payload())
        if role_error:
            return failure(role_error, 400)

        if uid == g.current_user["uid"]:
            return failure("Admins cannot change their own role.", 400)

        get_db().collection(USER_COLLECTION).document(uid).set(
            {"role": role, "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True
        )
        return success({"uid": uid, "role": role})

    @app.get("/api/incubator/snapshot")
    @require_auth
    def incubator_snapshot():
        return success(build_incubator_snapshot())

    @app.get("/api/incubator/live-data")
    @require_auth
    def live_data():
        return success(read_document(INCUBATOR_COLLECTION, "liveData"))

    @app.get("/api/incubator/actuators")
    @require_auth
    def actuators():
        return success(read_document(INCUBATOR_COLLECTION, "actuators"))

    @app.patch("/api/incubator/actuators")
    @require_admin
    def update_actuators():
        payload, error = validate_actuator_update(json_payload())
        if error:
            return failure(error, 400)
        write_document(INCUBATOR_COLLECTION, "actuators", payload)
        return success({"updated": True})

    @app.patch("/api/incubator/live-data")
    @require_admin
    def update_live_data():
        payload, error = validate_mode_update(json_payload())
        if error:
            return failure(error, 400)
        write_document(INCUBATOR_COLLECTION, "liveData", payload)
        return success({"updated": True})

    @app.get("/api/incubator/settings")
    @require_auth
    def settings():
        return success(read_document(INCUBATOR_COLLECTION, "settings"))

    @app.patch("/api/incubator/settings")
    @require_admin
    def update_settings():
        payload, error = validate_settings_update(json_payload())
        if error:
            return failure(error, 400)
        write_document(INCUBATOR_COLLECTION, "settings", payload)
        return success({"updated": True})

    @app.get("/api/incubator/alerts")
    @require_auth
    def alerts():
        return success(read_alerts())

    @app.get("/api/incubator/reports")
    @require_auth
    def reports():
        sensor_logs = read_sensor_logs()
        start_at = request.args.get("from")
        end_at = request.args.get("to")
        range_key = request.args.get("rangeKey") or request.args.get("range")
        if not range_key and (start_at is not None or end_at is not None):
            range_key = "custom"
        try:
            return success(
                build_sensor_logs_report(
                    sensor_logs,
                    range_key=range_key or "all",
                    start_at=start_at,
                    end_at=end_at,
                )
            )
        except ValueError as error:
            return failure(str(error), 400)

    @app.get("/api/presence")
    @require_auth
    def presence():
        try:
            return success(fetch_presence_status())
        except urllib.error.URLError:
            return failure("Detection service is unavailable.", 502)
        except Exception:
            return failure("Unable to fetch detection status.", 502)

    return app


def allowed_origins():
    configured = os.environ.get("BACKEND_ALLOWED_ORIGINS")
    if not configured:
        return DEFAULT_ALLOWED_ORIGINS
    return {origin.strip() for origin in configured.split(",") if origin.strip()}


def json_payload():
    return request.get_json(silent=True) or {}


def success(data, *, status=200):
    return jsonify({"success": True, "data": serialize_value(data)}), status


def failure(message, status):
    return jsonify({"success": False, "error": message}), status


def register_error_handlers(app):
    if google_api_exceptions is None:
        return

    @app.errorhandler(google_api_exceptions.ResourceExhausted)
    def handle_resource_exhausted(error):
        return datastore_error_response(error)

    @app.errorhandler(google_api_exceptions.GoogleAPICallError)
    def handle_google_api_error(error):
        return datastore_error_response(error)


def datastore_error_response(error):
    if google_api_exceptions is not None and isinstance(
        error, google_api_exceptions.ResourceExhausted
    ):
        return failure(
            "Backend datastore quota is exhausted. Please wait before trying again.",
            429,
        )

    if google_api_exceptions is not None and isinstance(
        error,
        (
            google_api_exceptions.DeadlineExceeded,
            google_api_exceptions.ServiceUnavailable,
        ),
    ):
        return failure("Backend datastore is temporarily unavailable.", 503)

    return failure("Backend datastore request failed.", 503)


def response_for_datastore_error(error):
    if google_api_exceptions is None:
        return None
    if isinstance(error, google_api_exceptions.GoogleAPICallError):
        return datastore_error_response(error)
    return None


def get_db():
    global _db_client

    if _db_client is not None:
        return _db_client
    if firebase_admin is None or firestore is None:
        raise RuntimeError("Firebase Admin SDK is not installed.")

    ensure_firebase_admin_app()
    _db_client = firestore.client()
    return _db_client


def ensure_firebase_admin_app():
    if firebase_admin is None:
        raise RuntimeError("Firebase Admin SDK is not installed.")

    try:
        firebase_admin.get_app()
    except ValueError:
        credential_path = os.environ.get("FIREBASE_CREDENTIALS_PATH") or os.environ.get(
            "GOOGLE_APPLICATION_CREDENTIALS"
        )
        if credential_path:
            firebase_admin.initialize_app(credentials.Certificate(credential_path))
        else:
            firebase_admin.initialize_app()


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        error_response = authenticate_request()
        if error_response is not None:
            return error_response
        return view(*args, **kwargs)

    return wrapped


def require_admin(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        error_response = authenticate_request()
        if error_response is not None:
            return error_response
        if (g.current_profile.get("role") or "").lower() != "admin":
            return failure("Admin role is required.", 403)
        return view(*args, **kwargs)

    return wrapped


def authenticate_request():
    if firebase_auth is None:
        return failure("Firebase Admin SDK is not installed.", 503)

    header = request.headers.get("Authorization", "")
    prefix = "Bearer "
    if not header.startswith(prefix):
        return failure("Authentication is required.", 401)

    token = header[len(prefix) :].strip()
    if not token:
        return failure("Authentication is required.", 401)

    try:
        ensure_firebase_admin_app()
        decoded = firebase_auth.verify_id_token(token)
    except RuntimeError:
        return failure("Backend Firebase configuration is unavailable.", 503)
    except Exception:
        return failure("Authentication failed.", 401)

    try:
        profile = ensure_user_profile(decoded)
    except RuntimeError:
        return failure("Backend Firebase configuration is unavailable.", 503)
    except Exception as error:
        datastore_response = response_for_datastore_error(error)
        if datastore_response is not None:
            return datastore_response
        return failure("Unable to load user profile.", 500)

    g.current_user = decoded
    g.current_profile = profile
    return None


def bootstrap_admin_emails():
    configured = os.environ.get("BACKEND_BOOTSTRAP_ADMIN_EMAILS", "")
    return {email.strip().lower() for email in configured.split(",") if email.strip()}


def ensure_user_profile(decoded_token):
    uid = decoded_token.get("uid")
    if not uid:
        raise ValueError("Missing uid.")

    db = get_db()
    ref = db.collection(USER_COLLECTION).document(uid)
    snapshot = ref.get()
    if snapshot.exists:
        return document_to_dict(snapshot)

    email = (decoded_token.get("email") or "").strip().lower()
    display_name = (
        decoded_token.get("name")
        or decoded_token.get("displayName")
        or (email.split("@", 1)[0] if email else "User")
    )
    role = "Admin" if email in bootstrap_admin_emails() else "Parent"
    ref.set(
        {
            "name": str(display_name)[:120],
            "email": email,
            "role": role,
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        merge=False,
    )
    return document_to_dict(ref.get())


def read_document(collection_name, document_id):
    snapshot = get_db().collection(collection_name).document(document_id).get()
    if not snapshot.exists:
        return None
    data = document_to_dict(snapshot)
    if collection_name == INCUBATOR_COLLECTION and document_id == "liveData":
        return normalize_live_data(data)
    if collection_name == INCUBATOR_COLLECTION and document_id == "settings":
        return normalize_settings(data)
    return data


def write_document(collection_name, document_id, payload):
    get_db().collection(collection_name).document(document_id).set(
        {**payload, "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True
    )


def build_incubator_snapshot():
    return {
        "liveData": read_document(INCUBATOR_COLLECTION, "liveData"),
        "actuators": read_document(INCUBATOR_COLLECTION, "actuators"),
        "settings": read_document(INCUBATOR_COLLECTION, "settings"),
        "alerts": read_alerts(),
    }


def read_alerts():
    batched = read_batched_entries("alerts")
    if batched:
        return sort_entries_by_timestamp_fields(batched, ALERT_TIMESTAMP_FIELDS)
    return read_first_non_empty_collection(ALERT_COLLECTIONS, ALERT_TIMESTAMP_FIELDS)


def read_reports():
    batched = read_batched_entries("reports")
    if batched:
        return batched
    return read_first_non_empty_collection(REPORT_COLLECTIONS)


def read_sensor_logs():
    db = get_db()
    logs = []
    for doc in db.collection("SensorLogs").stream():
        data = document_to_dict(doc)
        if data:
            logs.append(data)
    logs.sort(
        key=lambda item: timestamp_sort_key_from_fields(
            item, "DateTime", "timestamp", "createdAt"
        )
    )
    return logs


def read_batched_entries(document_id):
    data = read_document(INCUBATOR_COLLECTION, document_id)
    entries = data.get("entries") if isinstance(data, dict) else None
    if isinstance(entries, list):
        return [serialize_value(entry) for entry in entries]
    return []


def read_first_non_empty_collection(
    collection_names, sort_fields=("createdAt", "timestamp")
):
    db = get_db()
    for collection_name in collection_names:
        docs = [document_to_dict(doc) for doc in db.collection(collection_name).stream()]
        if docs:
            return sort_entries_by_timestamp_fields(docs, sort_fields)
    return []


def sort_entries_by_timestamp_fields(entries, field_names):
    return sorted(
        entries,
        key=lambda item: timestamp_sort_key_from_fields(item, *field_names),
        reverse=True,
    )


def timestamp_sort_key_from_fields(item, *field_names):
    if not isinstance(item, dict):
        return timestamp_sort_key(None)

    for field_name in field_names:
        value = item.get(field_name)
        if value is not None and value != "":
            return timestamp_sort_key(value)
    return timestamp_sort_key(None)


def timestamp_sort_key(value):
    timestamp = coerce_timestamp_seconds(value)
    if timestamp is not None:
        return (1, timestamp)
    return (0, "" if value is None else str(value))


def coerce_timestamp_seconds(value):
    if isinstance(value, dt.datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt.timezone.utc)
        return value.timestamp()

    if isinstance(value, dt.date):
        value = dt.datetime.combine(value, dt.time.min, tzinfo=dt.timezone.utc)
        return value.timestamp()

    if isinstance(value, dict):
        seconds = value.get("seconds")
        if seconds is None:
            seconds = value.get("_seconds")
        nanoseconds = value.get("nanoseconds")
        if nanoseconds is None:
            nanoseconds = value.get("_nanoseconds", 0)

        seconds = finite_float(seconds)
        nanoseconds = finite_float(nanoseconds)
        if seconds is None:
            return None
        return seconds + ((nanoseconds or 0) / 1_000_000_000)

    numeric_value = finite_float(value)
    if numeric_value is not None:
        if abs(numeric_value) > 9_999_999_999:
            return numeric_value / 1000
        return numeric_value

    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"
        try:
            parsed = dt.datetime.fromisoformat(normalized)
        except ValueError:
            parsed = parse_slash_datetime(normalized)
            if parsed is None:
                return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.timestamp()

    return None


def parse_slash_datetime(value):
    for date_format in SLASH_DATETIME_FORMATS:
        try:
            return dt.datetime.strptime(value, date_format)
        except ValueError:
            continue
    return None


def finite_float(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        try:
            number = float(value.strip())
        except ValueError:
            return None
    else:
        return None

    if not math.isfinite(number):
        return None
    return number


def normalize_live_data(data):
    if not isinstance(data, dict):
        return data
    normalized = dict(data)
    if normalized.get("noise") is None and normalized.get("noiseLevel") is not None:
        normalized["noise"] = normalized["noiseLevel"]
    return {
        **normalized,
        "temperatureTrend": normalized.get("temperatureTrend") or [],
        "humidityTrend": normalized.get("humidityTrend") or [],
        "spo2Trend": normalized.get("spo2Trend") or [],
        "heartRateTrend": normalized.get("heartRateTrend") or [],
    }


def normalize_settings(data):
    if not isinstance(data, dict):
        return data

    normalized = dict(data)
    safe_ranges = normalized.get("safeRanges")
    if not isinstance(safe_ranges, dict):
        safe_ranges = {}

    temperature_range = safe_ranges.get("temperature")
    if isinstance(temperature_range, list) and len(temperature_range) == 2:
        if normalized.get("minTemp") is None:
            normalized["minTemp"] = temperature_range[0]
        if normalized.get("maxTemp") is None:
            normalized["maxTemp"] = temperature_range[1]

    minimum = normalized.get("minTemp")
    maximum = normalized.get("maxTemp")
    if minimum is not None and maximum is not None:
        safe_ranges["temperature"] = [minimum, maximum]

    if "humidity" not in safe_ranges:
        minimum = normalized.get("minHumidity")
        maximum = normalized.get("maxHumidity")
        if minimum is not None and maximum is not None:
            safe_ranges["humidity"] = [minimum, maximum]

    normalized["safeRanges"] = safe_ranges
    return normalized


def document_to_dict(document):
    data = document.to_dict() or {}
    return {"id": document.id, **serialize_value(data)}


def serialize_value(value):
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if isinstance(value, tuple):
        return [serialize_value(item) for item in value]
    if isinstance(value, dt.datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt.timezone.utc)
        return value.isoformat()
    if isinstance(value, dt.date):
        return value.isoformat()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def detection_service_url():
    return os.environ.get("DETECTION_SERVICE_URL", "http://localhost:5000/status")


def fetch_presence_status():
    url = detection_service_url()
    timeout = float(os.environ.get("DETECTION_SERVICE_TIMEOUT_SECONDS", "3"))
    request_obj = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request_obj, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    present = payload.get("present")
    if present is None:
        present = payload.get("baby_present", False)

    confidence = payload.get("confidence")
    if not isinstance(confidence, (int, float)):
        confidence = None

    timestamp = payload.get("timestamp") or dt.datetime.now(dt.timezone.utc).isoformat()

    return {
        "present": bool(present),
        "confidence": confidence,
        "timestamp": timestamp,
        "status": payload.get("status") or payload.get("message"),
    }


load_env_file(os.path.join(os.path.dirname(__file__), ".env"))
app = create_app()


if __name__ == "__main__":
    host = os.environ.get("BACKEND_HOST", "127.0.0.1")
    port = int(os.environ.get("BACKEND_PORT", "8000"))
    app.run(host=host, port=port)
