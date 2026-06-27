import math


VALID_ROLES = {"Admin", "Parent"}
VALID_MODES = {"Auto", "Manual"}
ALLOWED_ACTUATORS = {"heater", "fan", "humidifier", "buzzer", "light"}
ALLOWED_SETTINGS_KEYS = {
    "temperatureSetpoint",
    "minTemp",
    "maxTemp",
    "humiditySetpoint",
    "safeRanges",
    "notificationPreferences",
    "autoModeEnabled",
    "babyRemovalPermitted",
}
ALLOWED_SAFE_RANGE_KEYS = {"temperature", "humidity", "spo2", "heartRate", "noise"}
ALLOWED_NOTIFICATION_KEYS = {"email", "sms", "push"}


def clean_string(value, *, max_length=120):
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_length]


def validate_role(role):
    role = clean_string(role, max_length=20)
    if role not in VALID_ROLES:
        return None, "Invalid role."
    return role, None


def validate_new_user_payload(payload):
    if not isinstance(payload, dict):
        return None, "Invalid JSON payload."

    email = clean_string(payload.get("email"), max_length=254).lower()
    password = payload.get("password")
    display_name = clean_string(
        payload.get("displayName") or payload.get("name"), max_length=120
    )
    role, role_error = validate_role(payload.get("role", "Parent"))

    if not display_name:
        return None, "Display name is required."
    if not email or "@" not in email:
        return None, "Valid email is required."
    if not isinstance(password, str) or len(password) < 8:
        return None, "Password must be at least 8 characters."
    if role_error:
        return None, role_error

    return {
        "email": email,
        "password": password,
        "displayName": display_name,
        "role": role,
    }, None


def validate_role_update(payload):
    if not isinstance(payload, dict):
        return None, "Invalid JSON payload."
    return validate_role(payload.get("role"))


def validate_uid(uid):
    uid = clean_string(uid, max_length=128)
    if not uid:
        return None, "Missing user id."
    return uid, None


def validate_actuator_update(payload):
    if not isinstance(payload, dict):
        return None, "Invalid JSON payload."
    if not payload:
        return None, "At least one actuator value is required."

    cleaned = {}
    for key, value in payload.items():
        if key not in ALLOWED_ACTUATORS:
            return None, f"Unsupported actuator: {key}."
        if not isinstance(value, bool):
            return None, f"Actuator {key} must be true or false."
        cleaned[key] = value

    return cleaned, None


def validate_mode_update(payload):
    if not isinstance(payload, dict):
        return None, "Invalid JSON payload."
    mode = clean_string(payload.get("mode"), max_length=20)
    if mode not in VALID_MODES:
        return None, "Mode must be Auto or Manual."
    return {"mode": mode}, None


def validate_settings_update(payload):
    if not isinstance(payload, dict):
        return None, "Invalid JSON payload."
    if not payload:
        return None, "At least one settings value is required."

    unknown_keys = sorted(set(payload) - ALLOWED_SETTINGS_KEYS)
    if unknown_keys:
        return None, f"Unsupported settings field: {unknown_keys[0]}."

    cleaned = {}
    for key, value in payload.items():
        if key in {"temperatureSetpoint", "humiditySetpoint", "minTemp", "maxTemp"}:
            number, error = _finite_number(value, key)
            if error:
                return None, error
            cleaned[key] = number
        elif key in {"autoModeEnabled", "babyRemovalPermitted"}:
            if not isinstance(value, bool):
                return None, f"{key} must be true or false."
            cleaned[key] = value
        elif key == "notificationPreferences":
            prefs, error = _validate_notification_preferences(value)
            if error:
                return None, error
            cleaned[key] = prefs
        elif key == "safeRanges":
            ranges, error = _validate_safe_ranges(value)
            if error:
                return None, error
            cleaned[key] = ranges

    temperature_bounds_error = _validate_temperature_bounds(cleaned)
    if temperature_bounds_error:
        return None, temperature_bounds_error

    return cleaned, None


def _finite_number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None, f"{label} must be a number."
    if not math.isfinite(value):
        return None, f"{label} must be finite."
    return value, None


def _validate_temperature_bounds(value):
    if "minTemp" in value and "maxTemp" in value and value["minTemp"] > value["maxTemp"]:
        return "minTemp cannot be greater than maxTemp."
    return None


def _validate_notification_preferences(value):
    if not isinstance(value, dict):
        return None, "notificationPreferences must be an object."

    unknown_keys = sorted(set(value) - ALLOWED_NOTIFICATION_KEYS)
    if unknown_keys:
        return None, f"Unsupported notification preference: {unknown_keys[0]}."

    cleaned = {}
    for key, enabled in value.items():
        if not isinstance(enabled, bool):
            return None, f"Notification preference {key} must be true or false."
        cleaned[key] = enabled
    return cleaned, None


def _validate_safe_ranges(value):
    if not isinstance(value, dict):
        return None, "safeRanges must be an object."

    unknown_keys = sorted(set(value) - ALLOWED_SAFE_RANGE_KEYS)
    if unknown_keys:
        return None, f"Unsupported safe range: {unknown_keys[0]}."

    cleaned = {}
    for key, bounds in value.items():
        if not isinstance(bounds, list) or len(bounds) != 2:
            return None, f"Safe range {key} must be [min, max]."
        minimum, min_error = _finite_number(bounds[0], f"{key} minimum")
        if min_error:
            return None, min_error
        maximum, max_error = _finite_number(bounds[1], f"{key} maximum")
        if max_error:
            return None, max_error
        if minimum > maximum:
            return None, f"Safe range {key} minimum cannot exceed maximum."
        cleaned[key] = [minimum, maximum]
    return cleaned, None
