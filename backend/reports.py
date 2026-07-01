import datetime as dt
import os
import re


PERIOD_CONFIG = {
    "hourly": {"bucket_count": 24, "label_format": "%H:%M"},
    "daily": {"bucket_count": 30, "label_format": "%b %d"},
    "weekly": {"bucket_count": 12, "label_format": "Week of %b %d"},
    "monthly": {"bucket_count": 12, "label_format": "%b %Y"},
}

METRICS = {
    "temperature": {"source": "temperature", "response": "avgTemperature"},
    "humidity": {"source": "humidity", "response": "avgHumidity"},
    "spo2": {"source": "spo2", "response": "avgSpo2"},
    "heartRate": {"source": "heartRate", "response": "avgHeartRate"},
    "weight": {"source": "Weight", "response": "avgWeight"},
}

SAFE_RANGES = {
    "temperature": {"min": 36.0, "max": 38.0},
    "humidity": {"min": 40.0, "max": 70.0},
    "spo2": {"min": 90.0, "max": None},
    "heartRate": {"min": 100.0, "max": 160.0},
}
MAX_CHART_POINTS = 180
RANGE_KEYS = {"all", "today", "last7", "last30", "custom"}
CRY_ALERT_PATTERN = re.compile(r"(cry|alert|detected|yes|true|on)", re.IGNORECASE)
PRESENCE_ALERT_PATTERN = re.compile(r"(absent|missing|no|false|off)", re.IGNORECASE)


def build_sensor_logs_report(
    logs,
    range_key="all",
    start_at=None,
    end_at=None,
    now=None,
):
    window = _resolve_range_window(range_key, start_at, end_at, now)
    rows = build_sensor_report_rows(
        logs,
        start_at=window["start"],
        end_at=window["end"],
        now=window["now"],
    )["rows"]
    summary = _calculate_report_summary(rows)
    alerts = _build_report_alerts(rows, summary)
    status = _get_overall_status(summary, alerts)

    return {
        "rangeKey": window["rangeKey"],
        "rangeLabel": window["label"],
        "windowStart": window["start"].isoformat() if window["start"] is not None else None,
        "windowEnd": window["end"].isoformat() if window["end"] is not None else None,
        "logs": rows,
        "summary": summary,
        "alerts": alerts,
        "statusLabel": status["word"],
        "statusColor": status["severity"],
        "aiSummary": _build_ai_summary(summary, alerts, window["label"]),
        "chartSeries": _build_chart_series(rows),
    }


def _resolve_range_window(range_key, start_at, end_at, now):
    selected_range = range_key if range_key in RANGE_KEYS else "last7"
    current = _ensure_utc(now or dt.datetime.now(dt.timezone.utc))
    start = None
    end = None
    label = "All entries"

    if selected_range == "last7":
        end = current
        start = (current - dt.timedelta(days=6)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        label = "Last 7 days"
    elif selected_range == "today":
        end = current
        start = current.replace(hour=0, minute=0, second=0, microsecond=0)
        label = "Today"
    elif selected_range == "last30":
        end = current
        start = (current - dt.timedelta(days=29)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        label = "Last 30 days"
    elif selected_range == "custom":
        start = _parse_optional_timestamp(start_at)
        end = _parse_optional_timestamp(end_at)
        if start is None or end is None:
            raise ValueError("Select both a start and end date/time for the custom range.")
        start = _ensure_utc(start)
        end = _ensure_utc(end)
        if end < start:
            raise ValueError("The end date/time must be after the start date/time.")
        label = f"{_format_range_datetime(start)} to {_format_range_datetime(end)}"

    return {
        "rangeKey": selected_range,
        "start": start,
        "end": end,
        "label": label,
        "now": current,
    }


def _calculate_report_summary(rows):
    totals = {
        "temperature": 0.0,
        "humidity": 0.0,
        "spo2": 0.0,
        "heartRate": 0.0,
        "noiseLevel": 0.0,
    }
    counts = {key: 0 for key in totals}
    safe_logs = 0

    for row in rows:
        for key in totals:
            value = row.get(key)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                totals[key] += value
                counts[key] += 1
        if _is_log_safe(row):
            safe_logs += 1

    total_logs = len(rows)
    compliance_percentage = _round_number((safe_logs / total_logs) * 100) if total_logs else 0

    return {
        "totalLogs": total_logs,
        "safeLogs": safe_logs,
        "compliancePercentage": compliance_percentage,
        "avgTemperature": _safe_average(totals["temperature"], counts["temperature"]),
        "avgHumidity": _safe_average(totals["humidity"], counts["humidity"]),
        "avgSpo2": _safe_average(totals["spo2"], counts["spo2"]),
        "avgHeartRate": _safe_average(totals["heartRate"], counts["heartRate"]),
        "avgNoiseLevel": _safe_average(totals["noiseLevel"], counts["noiseLevel"]),
        "temperatureIssues": _count_out_of_range(rows, "temperature", SAFE_RANGES["temperature"]),
        "humidityIssues": _count_out_of_range(rows, "humidity", SAFE_RANGES["humidity"]),
        "spo2Issues": _count_below_threshold(rows, "spo2", SAFE_RANGES["spo2"]["min"]),
        "heartRateIssues": _count_out_of_range(rows, "heartRate", SAFE_RANGES["heartRate"]),
        "cryAlerts": _count_text_alerts(rows, "cryStatus", CRY_ALERT_PATTERN),
        "presenceAlerts": _count_text_alerts(rows, "presenceStatus", PRESENCE_ALERT_PATTERN),
    }


def _build_report_alerts(rows, summary):
    alerts = []
    total = summary["totalLogs"] or len(rows) or 1

    _push_alert(alerts, "Temperature outside safe range", summary["temperatureIssues"], total, "warning")
    _push_alert(alerts, "Humidity outside safe range", summary["humidityIssues"], total, "warning")
    _push_alert(alerts, "SpO2 below 90%", summary["spo2Issues"], total, "critical")
    _push_alert(alerts, "Heart rate outside safe range", summary["heartRateIssues"], total, "warning")
    _push_alert(alerts, "Cry detected", summary["cryAlerts"], total, "warning")
    _push_alert(alerts, "Presence marked absent", summary["presenceAlerts"], total, "critical")

    return alerts


def _build_ai_summary(summary, alerts, label):
    if not summary["totalLogs"]:
        return f"No SensorLogs were found for {label}."

    status = _get_overall_status(summary, alerts)
    sentences = [
        (
            f"{label} remained {status['word'].lower()} with "
            f"{_format_number(summary['compliancePercentage'], 1)}% compliance."
        ),
        (
            f"Average temperature was {_format_number(summary['avgTemperature'], 1)} C, "
            f"humidity was {_format_number(summary['avgHumidity'], 1)}%, "
            f"SpO2 was {_format_number(summary['avgSpo2'], 1)}%, "
            f"heart rate was {_format_number(summary['avgHeartRate'], 1)} bpm, "
            f"and noise level averaged {_format_number(summary['avgNoiseLevel'], 1)}."
        ),
    ]

    if alerts:
        sentences.append(
            ". ".join(
                f"{alert['label'].lower()} in {alert['count']} readings"
                for alert in alerts[:2]
            )
        )
    else:
        sentences.append("No major safety violations were detected in the selected range.")

    return " ".join(sentences)


def _get_overall_status(summary, alerts):
    if summary["compliancePercentage"] >= 95 and not alerts:
        return {"word": "Good", "severity": "success"}
    if summary["compliancePercentage"] >= 80:
        return {"word": "Warning", "severity": "warning"}
    return {"word": "Critical", "severity": "error"}


def _build_chart_series(rows):
    sampled_rows = _sample_rows(rows)
    return {
        "temperature": [_build_series_point(row, "temperature") for row in sampled_rows],
        "humidity": [_build_series_point(row, "humidity") for row in sampled_rows],
        "spo2": [_build_series_point(row, "spo2") for row in sampled_rows],
        "heartRate": [_build_series_point(row, "heartRate") for row in sampled_rows],
        "noiseLevel": [_build_series_point(row, "noiseLevel") for row in sampled_rows],
    }


def _build_series_point(row, key):
    timestamp = row.get("timestamp")
    value = row.get(key)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        value = None
    return {
        "timestamp": timestamp,
        "label": _format_series_label(timestamp),
        "value": value,
    }


def _sample_rows(rows):
    if len(rows) <= MAX_CHART_POINTS:
        return rows

    step = (len(rows) + MAX_CHART_POINTS - 1) // MAX_CHART_POINTS
    return [
        row for index, row in enumerate(rows)
        if index % step == 0 or index == len(rows) - 1
    ]


def _push_alert(alerts, label, count, total, severity):
    if not count:
        return
    ratio = count / total if total else 0
    alerts.append(
        {
            "key": label,
            "label": label,
            "count": count,
            "severity": "critical" if ratio >= 0.2 or severity == "critical" else severity,
            "detail": f"{count} of {total} logs were affected.",
        }
    )


def _is_log_safe(row):
    return (
        _is_optional_value_in_range(row.get("temperature"), SAFE_RANGES["temperature"])
        and _is_optional_value_in_range(row.get("humidity"), SAFE_RANGES["humidity"])
        and _is_optional_value_at_or_above(row.get("spo2"), SAFE_RANGES["spo2"]["min"])
        and _is_optional_value_in_range(row.get("heartRate"), SAFE_RANGES["heartRate"])
    )


def _count_out_of_range(rows, key, value_range):
    count = 0
    for row in rows:
        value = row.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            if not _is_within_range(value, value_range):
                count += 1
    return count


def _count_below_threshold(rows, key, minimum):
    count = 0
    for row in rows:
        value = row.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool) and value < minimum:
            count += 1
    return count


def _count_text_alerts(rows, key, matcher):
    count = 0
    for row in rows:
        value = str(row.get(key) or "").strip()
        if value and matcher.search(value):
            count += 1
    return count


def _is_optional_value_in_range(value, value_range):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return True
    return _is_within_range(value, value_range)


def _is_optional_value_at_or_above(value, minimum):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return True
    return value >= minimum


def _is_within_range(value, value_range):
    minimum = value_range.get("min")
    maximum = value_range.get("max")
    if minimum is not None and value < minimum:
        return False
    if maximum is not None and value > maximum:
        return False
    return True


def build_sensor_report_rows(logs, start_at=None, end_at=None, now=None):
    start = _parse_optional_timestamp(start_at)
    end = _parse_optional_timestamp(end_at)

    if start is not None:
        start = _ensure_utc(start)
    if end is not None:
        end = _ensure_utc(end)
    if start is not None and end is not None and end < start:
        start, end = end, start

    rows = []
    for log in logs:
        timestamp = _extract_timestamp(log)
        if timestamp is None:
            continue
        timestamp = _ensure_utc(timestamp)
        if start is not None and timestamp < start:
            continue
        if end is not None and timestamp > end:
            continue
        rows.append(_serialize_sensor_log(log, timestamp))

    rows.sort(key=lambda row: row["timestamp"])
    current = _ensure_utc(now or dt.datetime.now(dt.timezone.utc))

    return {
        "period": "range",
        "generatedAt": current.isoformat(),
        "windowStart": start.isoformat() if start is not None else None,
        "windowEnd": end.isoformat() if end is not None else None,
        "rows": rows,
        "count": len(rows),
    }


def build_sensor_reports(logs, period="weekly", now=None):
    period = (period or "weekly").lower()
    if period not in PERIOD_CONFIG:
        period = "weekly"

    now = _ensure_utc(now or dt.datetime.now(dt.timezone.utc))
    bucket_count = PERIOD_CONFIG[period]["bucket_count"]
    period_start = _shift_period(_floor_datetime(now, period), period, -(bucket_count - 1))
    buckets = _build_buckets(period_start, period, bucket_count)
    bucket_map = {bucket["startAt"]: bucket for bucket in buckets}
    summary_totals = {metric_name: 0.0 for metric_name in METRICS}
    summary_counts = {metric_name: 0 for metric_name in METRICS}

    for log in logs:
        timestamp = _extract_timestamp(log)
        if timestamp is None:
            continue
        timestamp = _ensure_utc(timestamp)
        if timestamp < period_start or timestamp > now:
            continue

        bucket_start = _floor_datetime(timestamp, period).isoformat()
        bucket = bucket_map.get(bucket_start)
        if bucket is None:
            continue

        bucket["sampleCount"] += 1
        bucket["lastAt"] = _max_iso(bucket["lastAt"], timestamp.isoformat())
        bucket["firstAt"] = _min_iso(bucket["firstAt"], timestamp.isoformat())

        for metric_name, metric_config in METRICS.items():
            value = _extract_numeric(log, metric_config["source"])
            if value is None:
                continue
            bucket["sums"][metric_name] += value
            bucket["counts"][metric_name] += 1
            summary_totals[metric_name] += value
            summary_counts[metric_name] += 1

    rows = [_finalize_bucket(bucket) for bucket in buckets]
    available_rows = [row for row in rows if row["sampleCount"]]
    total_samples = sum(bucket["sampleCount"] for bucket in buckets)
    summary = _build_summary(summary_totals, summary_counts, total_samples)

    return {
        "period": period,
        "generatedAt": now.isoformat(),
        "windowStart": period_start.isoformat(),
        "windowEnd": now.isoformat(),
        "summary": summary,
        "rows": available_rows,
        "bucketCount": len(rows),
        "availableCount": len(available_rows),
        "sampleCount": total_samples,
    }


def _build_buckets(start, period, bucket_count):
    buckets = []
    current = start
    for index in range(bucket_count):
        next_start = _shift_period(current, period, 1)
        buckets.append(
            {
                "id": f"{period}-{index}",
                "period": period,
                "bucketLabel": _format_bucket_label(current, period),
                "startAt": current.isoformat(),
                "endAt": next_start.isoformat(),
                "sampleCount": 0,
                "sums": {name: 0.0 for name in METRICS},
                "counts": {name: 0 for name in METRICS},
                "lastAt": None,
                "firstAt": None,
            }
        )
        current = next_start
    return buckets


def _finalize_bucket(bucket):
    finalized = {
        "id": bucket["id"],
        "period": bucket["period"],
        "bucketLabel": bucket["bucketLabel"],
        "startAt": bucket["startAt"],
        "endAt": bucket["endAt"],
        "sampleCount": bucket["sampleCount"],
        "firstAt": bucket["firstAt"],
        "lastAt": bucket["lastAt"],
    }
    for metric_name, metric_config in METRICS.items():
        finalized[metric_config["response"]] = _safe_average(
            bucket["sums"][metric_name], bucket["counts"][metric_name]
        )
    return finalized


def _build_summary(totals, counts, sample_count):
    if not any(counts.values()):
        return {
            "sampleCount": 0,
            "avgTemperature": None,
            "avgHumidity": None,
            "avgSpo2": None,
            "avgHeartRate": None,
            "avgWeight": None,
        }

    return {
        "sampleCount": sample_count,
        "avgTemperature": _safe_average(totals["temperature"], counts["temperature"]),
        "avgHumidity": _safe_average(totals["humidity"], counts["humidity"]),
        "avgSpo2": _safe_average(totals["spo2"], counts["spo2"]),
        "avgHeartRate": _safe_average(totals["heartRate"], counts["heartRate"]),
        "avgWeight": _safe_average(totals["weight"], counts["weight"]),
    }


def _safe_average(total, count):
    if not count:
        return None
    return round(total / count, 2)


def _round_number(value, precision=2):
    return round(value, precision)


def _format_number(value, precision=1):
    if value is None:
        return "--"
    return f"{_round_number(value, precision):.{precision}f}"


def _format_series_label(timestamp):
    parsed = _parse_optional_timestamp(timestamp)
    if parsed is None:
        return ""
    return _format_range_datetime(_ensure_utc(parsed))


def _format_range_datetime(value):
    value = _ensure_utc(value)
    month = value.strftime("%B")
    weekday = value.strftime("%A")
    hour = value.strftime("%I").lstrip("0") or "0"
    minute = value.strftime("%M")
    am_pm = value.strftime("%p")
    return f"{weekday}, {month} {value.day}, {value.year} {hour}:{minute} {am_pm}"


def _extract_timestamp(log):
    combined_timestamp = _combined_date_time(log)
    if combined_timestamp is not None:
        return combined_timestamp

    for key in (
        "timestamp",
        "sourceDateTime",
        "createdAt",
        "DateTime",
        "dateTime",
        "datetime",
        "Time",
        "time",
        "Date",
        "date",
        "lastUpdated",
    ):
        value = log.get(key)
        if value is not None:
            parsed = _parse_timestamp(value)
            if parsed is not None:
                return parsed
    return None


def _combined_date_time(log):
    date_value = log.get("Date") or log.get("date")
    time_value = log.get("Time") or log.get("time")
    if date_value in (None, "") or time_value in (None, ""):
        return None
    return _parse_timestamp(f"{date_value} {time_value}")


def _extract_numeric(log, key):
    return _coerce_numeric(log.get(key))


def _coerce_numeric(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _extract_first_numeric(log, keys):
    return _coerce_numeric(_extract_first_value(log, keys))


def _extract_first_value(log, keys):
    for key in keys:
        value = log.get(key)
        if value not in (None, ""):
            return value

    normalized_log = {
        _normalize_field_name(key): value
        for key, value in log.items()
        if value not in (None, "")
    }
    for key in keys:
        value = normalized_log.get(_normalize_field_name(key))
        if value not in (None, ""):
            return value
    return None


def _normalize_field_name(key):
    return re.sub(r"[^a-z0-9]", "", str(key).lower())


def _parse_optional_timestamp(value):
    if value in (None, ""):
        return None
    return _parse_timestamp(value)


def _parse_timestamp(value):
    if isinstance(value, dt.datetime):
        return value

    if isinstance(value, (int, float)):
        return dt.datetime.fromtimestamp(value, tz=dt.timezone.utc)

    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    candidate = text.replace("Z", "+00:00") if text.endswith("Z") else text
    try:
        return dt.datetime.fromisoformat(candidate)
    except ValueError:
        pass

    date_order = (os.environ.get("REPORTS_DATE_ORDER") or "month-first").lower()
    patterns = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
    ]
    if date_order == "day-first":
        patterns.extend(
            [
                "%d/%m/%Y %H:%M:%S",
                "%d/%m/%Y %H:%M:%S.%f",
                "%d/%m/%Y %H:%M",
                "%d/%m/%Y",
                "%d/%m/%Y, %H:%M:%S",
                "%d/%m/%Y, %H:%M",
                "%d/%m/%Y %I:%M:%S %p",
                "%d/%m/%Y %I:%M %p",
                "%d/%m/%Y, %I:%M:%S %p",
                "%d/%m/%Y, %I:%M %p",
            ]
        )
    else:
        patterns.extend(
            [
                "%m/%d/%Y %H:%M:%S",
                "%m/%d/%Y %H:%M:%S.%f",
                "%m/%d/%Y %H:%M",
                "%m/%d/%Y",
                "%m/%d/%Y, %H:%M:%S",
                "%m/%d/%Y, %H:%M",
                "%m/%d/%Y %I:%M:%S %p",
                "%m/%d/%Y %I:%M %p",
                "%m/%d/%Y, %I:%M:%S %p",
                "%m/%d/%Y, %I:%M %p",
            ]
        )
        patterns.extend(
            [
                "%d/%m/%Y %H:%M:%S",
                "%d/%m/%Y %H:%M:%S.%f",
                "%d/%m/%Y %H:%M",
                "%d/%m/%Y",
                "%d/%m/%Y, %H:%M:%S",
                "%d/%m/%Y, %H:%M",
                "%d/%m/%Y %I:%M:%S %p",
                "%d/%m/%Y %I:%M %p",
                "%d/%m/%Y, %I:%M:%S %p",
                "%d/%m/%Y, %I:%M %p",
            ]
        )

    for pattern in patterns:
        try:
            return dt.datetime.strptime(text, pattern)
        except ValueError:
            continue

    return None


def _serialize_sensor_log(log, timestamp):
    source_date_time = (
        log.get("sourceDateTime")
        or log.get("DateTime")
        or log.get("dateTime")
        or log.get("datetime")
        or (
            f"{log.get('Date') or log.get('date')} {log.get('Time') or log.get('time')}"
            if (log.get("Date") or log.get("date")) and (log.get("Time") or log.get("time"))
            else None
        )
        or log.get("Time")
    )
    noise_value = _extract_first_value(
        log,
        (
            "noiseLevel",
            "NoiseLevel",
            "noise",
            "Noise",
            "noise_level",
            "Noise Level",
            "noise level",
        ),
    )
    noise_level = _coerce_numeric(noise_value)
    if noise_level is None and noise_value not in (None, ""):
        noise_level = noise_value
    cry_status = _extract_first_value(
        log,
        (
            "cryStatus",
            "CryStatus",
            "cry_status",
            "Cry Status",
            "cry status",
            "cry",
            "Cry",
            "crying",
            "Crying",
            "cryDetected",
            "CryDetected",
            "Cry Detected",
        ),
    )
    presence_status = _extract_first_value(
        log,
        (
            "presenceStatus",
            "PresenceStatus",
            "presence_status",
            "Presence Status",
            "presence status",
            "presence",
            "Presence",
            "babyPresence",
            "BabyPresence",
            "Baby Presence",
            "babyPresent",
            "BabyPresent",
            "Baby Present",
            "present",
            "Present",
        ),
    )

    row = {
        "id": log.get("id") or log.get("documentId") or timestamp.isoformat(),
        "timestamp": timestamp.isoformat(),
        "dateTime": timestamp.isoformat(),
        "sourceDateTime": source_date_time,
        "temperature": _extract_first_numeric(
            log,
            (
                "temperature",
                "Temperature",
                "temp",
                "Bodytemp",
                "bodyTemp",
                "bodytemp",
                "BodyTemp",
                "body_temp",
                "Body Temp",
            ),
        ),
        "humidity": _extract_first_numeric(log, ("humidity", "Humidity")),
        "spo2": _extract_first_numeric(log, ("spo2", "SpO2", "SpO₂", "SPO2")),
        "heartRate": _extract_first_numeric(
            log,
            ("heartRate", "HeartRate", "heart_rate", "BPM", "bpm"),
        ),
        "weight": _extract_first_numeric(log, ("Weight", "weight")),
        "noiseLevel": noise_level,
        "cryStatus": cry_status,
        "presenceStatus": presence_status,
    }
    return row


def _ensure_utc(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value.astimezone(dt.timezone.utc)


def _floor_datetime(value, period):
    value = _ensure_utc(value)
    if period == "hourly":
        return value.replace(minute=0, second=0, microsecond=0)
    if period == "daily":
        return value.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "weekly":
        start_of_day = value.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_of_day - dt.timedelta(days=start_of_day.weekday())
    if period == "monthly":
        return value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return value


def _shift_period(value, period, steps):
    if period == "hourly":
        return value + dt.timedelta(hours=steps)
    if period == "daily":
        return value + dt.timedelta(days=steps)
    if period == "weekly":
        return value + dt.timedelta(weeks=steps)
    if period == "monthly":
        return _shift_months(value, steps)
    return value


def _shift_months(value, months):
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return value.replace(year=year, month=month)


def _format_bucket_label(value, period):
    if period == "weekly":
        return f"Week of {value.strftime('%b %d')}"
    return value.strftime(PERIOD_CONFIG[period]["label_format"])


def _min_iso(existing, candidate):
    if existing is None:
        return candidate
    return min(existing, candidate)


def _max_iso(existing, candidate):
    if existing is None:
        return candidate
    return max(existing, candidate)
