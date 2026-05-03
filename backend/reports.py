import datetime as dt
import os


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


def _extract_timestamp(log):
    for key in ("DateTime", "timestamp", "createdAt", "lastUpdated"):
        value = log.get(key)
        if value is not None:
            parsed = _parse_timestamp(value)
            if parsed is not None:
                return parsed
    return None


def _extract_numeric(log, key):
    value = log.get(key)
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
        "%Y/%m/%d %H:%M:%S",
    ]
    if date_order == "day-first":
        patterns.extend(["%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M:%S.%f"])
    else:
        patterns.extend(["%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M:%S.%f"])
        patterns.extend(["%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M:%S.%f"])

    for pattern in patterns:
        try:
            return dt.datetime.strptime(text, pattern)
        except ValueError:
            continue

    return None


def _serialize_sensor_log(log, timestamp):
    row = {
        "id": log.get("id") or log.get("documentId") or timestamp.isoformat(),
        "timestamp": timestamp.isoformat(),
        "dateTime": timestamp.isoformat(),
        "sourceDateTime": log.get("DateTime"),
        "temperature": _extract_numeric(log, "temperature"),
        "humidity": _extract_numeric(log, "humidity"),
        "spo2": _extract_numeric(log, "spo2"),
        "heartRate": _extract_numeric(log, "heartRate"),
        "weight": _extract_numeric(log, "Weight"),
        "noiseLevel": _extract_numeric(log, "noiseLevel"),
        "cryStatus": log.get("cryStatus"),
        "presenceStatus": log.get("presenceStatus"),
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
