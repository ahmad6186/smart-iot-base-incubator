import unittest

try:
    from .validation import (
        validate_actuator_update,
        validate_mode_update,
        validate_new_user_payload,
        validate_settings_update,
    )
except ImportError:
    from validation import (
        validate_actuator_update,
        validate_mode_update,
        validate_new_user_payload,
        validate_settings_update,
    )


class ValidationTests(unittest.TestCase):
    def test_rejects_unknown_actuator(self):
        payload, error = validate_actuator_update({"heater": True, "door": True})

        self.assertIsNone(payload)
        self.assertEqual(error, "Unsupported actuator: door.")

    def test_rejects_non_boolean_actuator(self):
        payload, error = validate_actuator_update({"heater": "on"})

        self.assertIsNone(payload)
        self.assertEqual(error, "Actuator heater must be true or false.")

    def test_rejects_invalid_role(self):
        payload, error = validate_new_user_payload(
            {
                "displayName": "Researcher",
                "email": "user@example.com",
                "password": "password123",
                "role": "SuperAdmin",
            }
        )

        self.assertIsNone(payload)
        self.assertEqual(error, "Invalid role.")

    def test_rejects_short_password(self):
        payload, error = validate_new_user_payload(
            {
                "displayName": "Parent",
                "email": "parent@example.com",
                "password": "short",
                "role": "Parent",
            }
        )

        self.assertIsNone(payload)
        self.assertEqual(error, "Password must be at least 8 characters.")

    def test_rejects_invalid_mode(self):
        payload, error = validate_mode_update({"mode": "Override"})

        self.assertIsNone(payload)
        self.assertEqual(error, "Mode must be Auto or Manual.")

    def test_accepts_valid_settings_patch(self):
        payload, error = validate_settings_update(
            {
                "temperatureSetpoint": 36.5,
                "safeRanges": {"temperature": [35, 38]},
                "notificationPreferences": {"email": True, "sms": False},
                "autoModeEnabled": True,
            }
        )

        self.assertIsNone(error)
        self.assertEqual(payload["temperatureSetpoint"], 36.5)

    def test_rejects_unknown_settings_field(self):
        payload, error = validate_settings_update({"debugMode": True})

        self.assertIsNone(payload)
        self.assertEqual(error, "Unsupported settings field: debugMode.")


if __name__ == "__main__":
    unittest.main()
