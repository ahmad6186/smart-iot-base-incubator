import datetime as dt
import unittest

from reports import build_sensor_report_rows


class SensorReportTests(unittest.TestCase):
    def test_date_range_returns_raw_sensor_logs(self):
        logs = [
            {
                "DateTime": "2026-05-03T00:15:00+00:00",
                "temperature": 36.0,
                "humidity": 48.0,
                "spo2": 98.0,
                "heartRate": 120.0,
                "Weight": 2500.0,
            },
            {
                "DateTime": "2026-05-03T01:45:00+00:00",
                "temperature": 37.0,
                "humidity": 52.0,
                "spo2": 96.0,
                "heartRate": 118.0,
                "Weight": 2600.0,
            },
        ]

        report = build_sensor_report_rows(
            logs,
            start_at="2026-05-03T00:00:00+00:00",
            end_at="2026-05-03T01:00:00+00:00",
        )

        self.assertEqual(report["period"], "range")
        self.assertEqual(report["count"], 1)
        self.assertEqual(len(report["rows"]), 1)
        row = report["rows"][0]
        self.assertEqual(row["timestamp"], "2026-05-03T00:15:00+00:00")
        self.assertEqual(row["temperature"], 36.0)
        self.assertEqual(row["humidity"], 48.0)
        self.assertEqual(row["spo2"], 98.0)
        self.assertEqual(row["heartRate"], 120.0)
        self.assertEqual(row["weight"], 2500.0)

    def test_raw_rows_are_sorted_by_timestamp(self):
        logs = [
            {"DateTime": "2026-05-03T02:00:00+00:00", "temperature": 37.5},
            {"DateTime": "2026-05-03T01:00:00+00:00", "temperature": 36.5},
        ]

        report = build_sensor_report_rows(logs)

        self.assertEqual([row["timestamp"] for row in report["rows"]], [
            "2026-05-03T01:00:00+00:00",
            "2026-05-03T02:00:00+00:00",
        ])

    def test_ambiguous_slash_date_is_month_first(self):
        logs = [
            {"DateTime": "05/03/2026 23:13:12", "temperature": 36.2},
        ]

        report = build_sensor_report_rows(logs)
        row = report["rows"][0]

        self.assertEqual(row["timestamp"], "2026-05-03T23:13:12+00:00")
        self.assertEqual(row["temperature"], 36.2)


if __name__ == "__main__":
    unittest.main()
