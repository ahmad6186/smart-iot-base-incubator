import datetime as dt
import unittest

from reports import build_sensor_logs_report, build_sensor_report_rows


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

    def test_parses_comma_and_split_date_time_sensor_logs(self):
        logs = [
            {"DateTime": "05/03/2026, 23:13:12", "Temperature": "36.2"},
            {"Date": "05/04/2026", "Time": "01:05:00", "SpO2": "97"},
        ]

        report = build_sensor_report_rows(logs)

        self.assertEqual(report["count"], 2)
        self.assertEqual(report["rows"][0]["temperature"], 36.2)
        self.assertEqual(report["rows"][1]["timestamp"], "2026-05-04T01:05:00+00:00")
        self.assertEqual(report["rows"][1]["spo2"], 97.0)

    def test_backend_report_builds_summary_alerts_and_chart_series(self):
        logs = [
            {
                "DateTime": "2026-05-03T00:15:00+00:00",
                "temperature": 36.5,
                "humidity": 55,
                "spo2": 98,
                "heartRate": 120,
                "noiseLevel": 42,
                "cryStatus": "Quiet",
                "presenceStatus": "Present",
            },
            {
                "DateTime": "2026-05-03T01:15:00+00:00",
                "temperature": 39,
                "humidity": 30,
                "spo2": 88,
                "heartRate": 170,
                "noiseLevel": 65,
                "cryStatus": "Crying",
                "presenceStatus": "Absent",
            },
        ]

        report = build_sensor_logs_report(
            logs,
            range_key="all",
            now=dt.datetime(2026, 5, 4, tzinfo=dt.timezone.utc),
        )

        self.assertEqual(report["rangeKey"], "all")
        self.assertEqual(len(report["logs"]), 2)
        self.assertEqual(report["summary"]["totalLogs"], 2)
        self.assertEqual(report["summary"]["safeLogs"], 1)
        self.assertEqual(report["summary"]["compliancePercentage"], 50)
        self.assertEqual(report["summary"]["avgTemperature"], 37.75)
        self.assertEqual(report["summary"]["avgNoiseLevel"], 53.5)
        self.assertEqual(report["statusLabel"], "Critical")
        self.assertIn("All entries remained critical", report["aiSummary"])
        self.assertEqual(len(report["chartSeries"]["noiseLevel"]), 2)
        self.assertIn(
            "SpO2 below 90%",
            [alert["label"] for alert in report["alerts"]],
        )

    def test_backend_report_rejects_invalid_custom_range(self):
        with self.assertRaises(ValueError):
            build_sensor_logs_report(
                [],
                range_key="custom",
                start_at="2026-05-04T02:00:00+00:00",
                end_at="2026-05-04T01:00:00+00:00",
                now=dt.datetime(2026, 5, 4, tzinfo=dt.timezone.utc),
            )


if __name__ == "__main__":
    unittest.main()
