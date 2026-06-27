import importlib.util
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


def load_detection_app():
    cv2_stub = types.SimpleNamespace(
        data=types.SimpleNamespace(haarcascades=""),
        CascadeClassifier=lambda path: object(),
        FONT_HERSHEY_SIMPLEX=0,
    )
    sys.modules.setdefault("cv2", cv2_stub)
    sys.modules.setdefault("numpy", types.SimpleNamespace(uint8=object))
    sys.modules.setdefault("requests", types.SimpleNamespace())

    module_path = Path(__file__).with_name("app.py")
    spec = importlib.util.spec_from_file_location("baby_detection_app", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


app = load_detection_app()


class FakeDocument:
    def __init__(self, data, doc_id="alert-doc"):
        self._data = data
        self.id = doc_id
        self.reference = FakeReference()

    def to_dict(self):
        return self._data


class FakeReference:
    def __init__(self):
        self.set_calls = []

    def set(self, data, merge=False):
        self.set_calls.append((data, merge))


class FakeChange:
    def __init__(self, document, change_type="ADDED"):
        self.document = document
        self.type = change_type


class FakeCollection:
    def __init__(self, documents):
        self.documents = documents

    def stream(self):
        return [FakeDocument(data) for data in self.documents]


class FakeDb:
    def __init__(self, users):
        self.users = users

    def collection(self, collection_name):
        if collection_name == app.FIREBASE_USER_COLLECTION:
            return FakeCollection(self.users)
        return FakeCollection([])


class FakeSmtp:
    sent_messages = []
    logged_in = False
    used_tls = False

    def __init__(self, host, port, timeout):
        self.host = host
        self.port = port
        self.timeout = timeout

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def ehlo(self):
        return None

    def starttls(self):
        FakeSmtp.used_tls = True

    def login(self, username, password):
        FakeSmtp.logged_in = True

    def send_message(self, message):
        FakeSmtp.sent_messages.append(message)


class AlertEmailTests(unittest.TestCase):
    def setUp(self):
        FakeSmtp.sent_messages = []
        FakeSmtp.logged_in = False
        FakeSmtp.used_tls = False
        app.alert_listener_ready = False
        app.alert_collection_ready = {}
        app.batched_alert_listener_ready = False
        app.batched_alert_seen_keys = set()

    def test_alert_recipients_include_only_admins_and_parents(self):
        db = FakeDb(
            [
                {"email": "Admin@Example.com", "role": "Admin"},
                {"email": "parent@example.com", "role": "Parent"},
                {"email": "parent@example.com", "role": "Parent"},
                {"email": "viewer@example.com", "role": "Viewer"},
                {"email": "invalid-email", "role": "Parent"},
                {"role": "Admin"},
            ]
        )

        recipients = app.alert_recipient_emails(db)

        self.assertEqual(recipients, ["admin@example.com", "parent@example.com"])

    def test_alert_email_sends_with_bcc_recipients_when_enabled(self):
        db = FakeDb(
            [
                {"email": "admin@example.com", "role": "Admin"},
                {"email": "parent@example.com", "role": "Parent"},
            ]
        )
        env = {
            "ALERT_EMAIL_ENABLED": "true",
            "ALERT_SMTP_HOST": "smtp.example.com",
            "ALERT_SMTP_PORT": "587",
            "ALERT_SMTP_USER": "alerts@example.com",
            "ALERT_SMTP_PASSWORD": "app-password",
            "ALERT_EMAIL_FROM": "alerts@example.com",
        }

        original_smtp = app.smtplib.SMTP
        try:
            app.smtplib.SMTP = FakeSmtp
            with patch.dict(os.environ, env, clear=False):
                sent = app.send_alert_email(
                    db,
                    {
                        "type": "Baby removed detected",
                        "severity": "critical",
                        "message": "No infant presence detected.",
                        "source": "test",
                        "cameraUrl": "http://camera.local",
                    },
                )
        finally:
            app.smtplib.SMTP = original_smtp

        self.assertTrue(sent)
        self.assertTrue(FakeSmtp.used_tls)
        self.assertTrue(FakeSmtp.logged_in)
        self.assertEqual(len(FakeSmtp.sent_messages), 1)

        message = FakeSmtp.sent_messages[0]
        self.assertEqual(message["To"], "alerts@example.com")
        self.assertIn("admin@example.com", message["Bcc"])
        self.assertIn("parent@example.com", message["Bcc"])
        self.assertIn("Incubator Alert", message["Subject"])
        body = message.get_body(preferencelist=("plain",)).get_content()
        self.assertIn("A new incubator alert is visible on the Alerts page.", body)
        self.assertIn("Message: No infant presence detected.", body)
        self.assertIn("Status: Open", body)
        self.assertIn("Time: N/A", body)

    def test_alert_email_change_sends_and_marks_unattempted_alert(self):
        document = FakeDocument(
            {
                "type": "Temperature alert",
                "severity": "warning",
                "message": "Temperature outside safe range.",
            }
        )

        firestore_stub = types.SimpleNamespace(SERVER_TIMESTAMP=object())

        with (
            patch.object(app, "firestore", firestore_stub),
            patch.object(app, "send_alert_email", return_value=True) as send_alert_email,
        ):
            app.process_alert_email_change(FakeDb([]), document)

        send_alert_email.assert_called_once()
        self.assertEqual(len(document.reference.set_calls), 1)

        update_payload, merge = document.reference.set_calls[0]
        self.assertTrue(merge)
        self.assertTrue(update_payload[app.ALERT_EMAIL_ATTEMPTED_FIELD])
        self.assertTrue(update_payload[app.ALERT_EMAIL_SENT_FIELD])

    def test_alert_email_change_skips_already_attempted_alert(self):
        document = FakeDocument(
            {
                "type": "Temperature alert",
                app.ALERT_EMAIL_ATTEMPTED_FIELD: True,
            }
        )

        with patch.object(app, "send_alert_email", return_value=True) as send_alert_email:
            app.process_alert_email_change(FakeDb([]), document)

        send_alert_email.assert_not_called()
        self.assertEqual(document.reference.set_calls, [])

    def test_initial_alert_snapshot_is_ignored_to_avoid_old_email_flood(self):
        app.alert_listener_ready = False
        document = FakeDocument({"type": "Old alert"})

        with (
            patch.object(app, "init_firestore", return_value=FakeDb([])),
            patch.object(app, "process_alert_email_change") as process_change,
        ):
            app.handle_alert_snapshot([document], [FakeChange(document)], None)

        self.assertTrue(app.alert_listener_ready)
        process_change.assert_not_called()

    def test_alert_collection_snapshots_have_independent_initial_skips(self):
        primary_document = FakeDocument({"type": "Old primary alert"})
        fallback_document = FakeDocument({"type": "Old fallback alert"})

        with (
            patch.object(app, "init_firestore", return_value=FakeDb([])),
            patch.object(app, "process_alert_email_change") as process_change,
        ):
            app.handle_alert_collection_snapshot(
                app.FIREBASE_ALERT_COLLECTION,
                [primary_document],
                [FakeChange(primary_document)],
                None,
            )
            app.handle_alert_collection_snapshot(
                "alerts",
                [fallback_document],
                [FakeChange(fallback_document)],
                None,
            )

        process_change.assert_not_called()

    def test_batched_alert_snapshot_sends_only_new_entries(self):
        old_alert = {
            "id": "old-alert",
            "message": "Existing alert",
            "createdAt": "2026-01-01T10:00:00Z",
        }
        new_alert = {
            "id": "new-alert",
            "message": "New alert",
            "createdAt": "2026-01-01T10:05:00Z",
        }
        db = FakeDb([])

        with (
            patch.object(app, "init_firestore", return_value=db),
            patch.object(app, "send_alert_email", return_value=True) as send_alert_email,
        ):
            app.handle_batched_alert_snapshot(
                [FakeDocument({"entries": [old_alert]})],
                [],
                None,
            )
            app.handle_batched_alert_snapshot(
                [FakeDocument({"entries": [old_alert, new_alert]})],
                [],
                None,
            )

        send_alert_email.assert_called_once_with(db, new_alert)

    def test_alert_email_formats_timestamp_shapes(self):
        self.assertEqual(
            app.format_alert_time({"seconds": 1_700_000_000, "nanoseconds": 0}),
            "2023-11-14T22:13:20+00:00",
        )
        self.assertEqual(
            app.format_alert_time(1_700_000_000_000),
            "2023-11-14T22:13:20+00:00",
        )


if __name__ == "__main__":
    unittest.main()
