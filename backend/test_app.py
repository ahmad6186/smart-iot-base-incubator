import unittest

import app as backend_app


class FakeDocument:
    def __init__(self, document_id, data):
        self.id = document_id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        if self._data is None:
            return None
        return dict(self._data)


class FakeDocumentRef:
    def __init__(self, document_id, data):
        self.document_id = document_id
        self.data = data

    def get(self):
        if isinstance(self.data, Exception):
            raise self.data
        return FakeDocument(self.document_id, self.data)


class FakeCollection:
    def __init__(self, documents):
        self.documents = documents

    def document(self, document_id):
        return FakeDocumentRef(document_id, self.documents.get(document_id))

    def stream(self):
        return [
            FakeDocument(document_id, data)
            for document_id, data in self.documents.items()
        ]


class FakeDb:
    def __init__(self, collections):
        self.collections = collections

    def collection(self, collection_name):
        return FakeCollection(self.collections.get(collection_name, {}))


class SnapshotEndpointTests(unittest.TestCase):
    def setUp(self):
        self.original_db_client = backend_app._db_client
        self.original_authenticate_request = backend_app.authenticate_request

        backend_app._db_client = FakeDb(
            {
                "incubator": {
                    "liveData": {"temperature": 36.7},
                    "actuators": {"heater": True},
                    "settings": {"safeRanges": {"temperature": [35, 38]}},
                },
                "incubator_alerts": {
                    "without-created-at": {
                        "message": "Alert without a timestamp",
                        "severity": "warning",
                    },
                    "datetime-alert": {
                        "message": "Alert with DateTime",
                        "severity": "warning",
                        "DateTime": "2026-06-29T10:15:00+00:00",
                    },
                    "numeric-created-at": {
                        "message": "Alert with a numeric timestamp",
                        "severity": "critical",
                        "createdAt": 1_700_000_000,
                    },
                },
            }
        )

        def authenticate_request():
            backend_app.g.current_user = {"uid": "test-user"}
            backend_app.g.current_profile = {"role": "Parent"}
            return None

        backend_app.authenticate_request = authenticate_request
        self.client = backend_app.app.test_client()

    def tearDown(self):
        backend_app._db_client = self.original_db_client
        backend_app.authenticate_request = self.original_authenticate_request

    def test_snapshot_handles_alerts_with_mixed_timestamp_shapes(self):
        response = self.client.get(
            "/api/incubator/snapshot",
            headers={"Authorization": "Bearer test-token"},
        )

        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        payload = response.get_json()

        self.assertTrue(payload["success"])
        self.assertEqual(
            [alert["id"] for alert in payload["data"]["alerts"]],
            ["datetime-alert", "numeric-created-at", "without-created-at"],
        )

    def test_alert_endpoint_sorts_batched_alerts_by_datetime_field(self):
        backend_app._db_client = FakeDb(
            {
                "incubator": {
                    "alerts": {
                        "entries": [
                            {
                                "id": "older-alert",
                                "message": "Older alert",
                                "DateTime": "2026-06-29T08:00:00+00:00",
                            },
                            {
                                "id": "slash-format-alert",
                                "message": "Slash format alert",
                                "DateTime": "29/06/2026 11:26:58",
                            },
                            {
                                "id": "newer-alert",
                                "message": "Newer alert",
                                "DateTime": "2026-06-29T09:00:00+00:00",
                            },
                        ]
                    },
                },
            }
        )

        response = self.client.get(
            "/api/incubator/alerts",
            headers={"Authorization": "Bearer test-token"},
        )

        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        payload = response.get_json()

        self.assertTrue(payload["success"])
        self.assertEqual(
            [alert["id"] for alert in payload["data"]],
            ["slash-format-alert", "newer-alert", "older-alert"],
        )

    @unittest.skipIf(
        backend_app.google_api_exceptions is None,
        "google api exceptions are unavailable",
    )
    def test_snapshot_returns_quota_response_for_firestore_quota_errors(self):
        backend_app._db_client = FakeDb(
            {
                "incubator": {
                    "liveData": backend_app.google_api_exceptions.ResourceExhausted(
                        "Quota exceeded."
                    ),
                },
            }
        )

        response = self.client.get(
            "/api/incubator/snapshot",
            headers={"Authorization": "Bearer test-token"},
        )

        self.assertEqual(response.status_code, 429, response.get_data(as_text=True))
        payload = response.get_json()

        self.assertFalse(payload["success"])
        self.assertEqual(
            payload["error"],
            "Backend datastore quota is exhausted. Please wait before trying again.",
        )


if __name__ == "__main__":
    unittest.main()
