import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase/firestore'
import { fetchReports as fetchBackendReports } from './incubatorService'

dayjs.extend(customParseFormat)

const SAFE_RANGES = {
  temperature: { min: 36.0, max: 38.0, label: '36.0 - 38.0 C' },
  humidity: { min: 40, max: 70, label: '40 - 70 %' },
  spo2: { min: 90, max: Infinity, label: '90+ %' },
  heartRate: { min: 100, max: 160, label: '100 - 160 bpm' },
}

const RANGE_OPTIONS = [
  { label: 'All entries', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: 'last7' },
  { label: 'Last 30 days', value: 'last30' },
  { label: 'Custom range', value: 'custom' },
]

const MAX_CHART_POINTS = 180

export const REPORT_RANGE_OPTIONS = RANGE_OPTIONS

export const fetchSensorLogsReport = async ({ rangeKey = 'last7', customFrom, customTo } = {}) => {
  const window = resolveRangeWindow(rangeKey, customFrom, customTo)
  const logs = await fetchSensorLogs(window)
  const summary = calculateSummary(logs)
  const alerts = buildAlerts(logs, summary)
  const status = getOverallStatus(summary, alerts)
  const aiSummary = buildAiSummary(summary, alerts, window.label)
  const chartSeries = buildChartSeries(logs)

  return {
    rangeKey: window.rangeKey,
    rangeLabel: window.label,
    windowStart: window.start ? window.start.toISOString() : null,
    windowEnd: window.end ? window.end.toISOString() : null,
    logs,
    summary,
    alerts,
    statusLabel: status.word,
    statusColor: status.severity,
    aiSummary,
    chartSeries,
  }
}

const resolveRangeWindow = (rangeKey, customFrom, customTo) => {
  const selectedRange = RANGE_OPTIONS.some((option) => option.value === rangeKey)
    ? rangeKey
    : 'last7'
  const now = dayjs()
  let start = null
  let end = now
  let label = 'All entries'

  if (selectedRange === 'last7') {
    start = now.subtract(6, 'day').startOf('day')
    label = 'Last 7 days'
  } else if (selectedRange === 'today') {
    start = now.startOf('day')
    label = 'Today'
  } else if (selectedRange === 'last30') {
    start = now.subtract(29, 'day').startOf('day')
    label = 'Last 30 days'
  } else if (selectedRange === 'custom') {
    if (!customFrom || !customTo) {
      throw new Error('Select both a start and end date/time for the custom range.')
    }

    start = dayjs(customFrom)
    end = dayjs(customTo)
    if (!start.isValid() || !end.isValid()) {
      throw new Error('Select valid custom start and end date/time values.')
    }
    if (end.isBefore(start)) {
      throw new Error('The end date/time must be after the start date/time.')
    }
    label = `${start.format('dddd, MMMM D, YYYY h:mm A')} to ${end.format('dddd, MMMM D, YYYY h:mm A')}`
  }

  return {
    rangeKey: selectedRange,
    start,
    end,
    label,
  }
}

const fetchSensorLogs = async ({ start, end }) => {
  try {
    const snapshot = await getDocs(collection(db, 'SensorLogs'))
    const rows = snapshot.docs.map((doc) => normalizeSensorLog(doc.id, doc.data()))
    return filterAndSortSensorLogs(rows, start, end)
  } catch (error) {
    const response = await fetchBackendReports({
      from: start ? start.toISOString() : undefined,
      to: end ? end.toISOString() : undefined,
    })
    const rows = Array.isArray(response?.rows) ? response.rows : []
    return filterAndSortSensorLogs(rows.map((row) => normalizeSensorLog(row.id, row)), start, end)
  }
}

const filterAndSortSensorLogs = (rows, start, end) =>
  rows
    .filter((log) => {
      if (!start && !end) return true
      if (!log.timestamp) return true
      const timestamp = dayjs(log.timestamp)
      if (!timestamp.isValid()) return true
      if (start && timestamp.isBefore(start)) return false
      if (end && timestamp.isAfter(end)) return false
      return true
    })
    .sort((left, right) => {
      const leftValue = left.timestamp ? dayjs(left.timestamp).valueOf() : 0
      const rightValue = right.timestamp ? dayjs(right.timestamp).valueOf() : 0
      return leftValue - rightValue
    })

const normalizeSensorLog = (id, data = {}) => {
  const sourceDateTime =
    data.timestamp ??
    data.sourceDateTime ??
    data.createdAt ??
    data.DateTime ??
    data.dateTime ??
    data.datetime ??
    data.Time
  const timestamp = toDateValue(sourceDateTime)
  return {
    id,
    timestamp: timestamp ? timestamp.toISOString() : null,
    sourceDateTime: sourceDateTime ?? null,
    temperature: toNumber(data.temperature),
    humidity: toNumber(data.humidity),
    spo2: toNumber(data.spo2),
    heartRate: toNumber(data.heartRate),
    noiseLevel: toNumber(data.noiseLevel),
    cryStatus: toText(data.cryStatus),
    presenceStatus: toText(data.presenceStatus),
  }
}

const buildChartSeries = (logs) => {
  const sampledLogs = sampleLogs(logs)
  return {
    temperature: sampledLogs.map((log) => buildSeriesPoint(log, 'temperature')),
    humidity: sampledLogs.map((log) => buildSeriesPoint(log, 'humidity')),
    spo2: sampledLogs.map((log) => buildSeriesPoint(log, 'spo2')),
    heartRate: sampledLogs.map((log) => buildSeriesPoint(log, 'heartRate')),
  }
}

const buildSeriesPoint = (log, key) => ({
  timestamp: log.timestamp,
  label: log.timestamp ? dayjs(log.timestamp).format('dddd, MMMM D, h:mm A') : '',
  value: log[key],
})

const sampleLogs = (logs) => {
  if (logs.length <= MAX_CHART_POINTS) {
    return logs
  }

  const step = Math.ceil(logs.length / MAX_CHART_POINTS)
  return logs.filter((_, index) => index % step === 0 || index === logs.length - 1)
}

const calculateSummary = (logs) => {
  const totals = {
    temperature: 0,
    humidity: 0,
    spo2: 0,
    heartRate: 0,
    noiseLevel: 0,
  }
  const counts = {
    temperature: 0,
    humidity: 0,
    spo2: 0,
    heartRate: 0,
    noiseLevel: 0,
  }
  let safeLogs = 0

  logs.forEach((log) => {
    if (typeof log.temperature === 'number') {
      totals.temperature += log.temperature
      counts.temperature += 1
    }
    if (typeof log.humidity === 'number') {
      totals.humidity += log.humidity
      counts.humidity += 1
    }
    if (typeof log.spo2 === 'number') {
      totals.spo2 += log.spo2
      counts.spo2 += 1
    }
    if (typeof log.heartRate === 'number') {
      totals.heartRate += log.heartRate
      counts.heartRate += 1
    }
    if (typeof log.noiseLevel === 'number') {
      totals.noiseLevel += log.noiseLevel
      counts.noiseLevel += 1
    }

    if (isLogSafe(log)) {
      safeLogs += 1
    }
  })

  const totalLogs = logs.length
  const compliancePercentage = totalLogs ? round((safeLogs / totalLogs) * 100) : 0

  return {
    totalLogs,
    safeLogs,
    compliancePercentage,
    avgTemperature: average(totals.temperature, counts.temperature),
    avgHumidity: average(totals.humidity, counts.humidity),
    avgSpo2: average(totals.spo2, counts.spo2),
    avgHeartRate: average(totals.heartRate, counts.heartRate),
    avgNoiseLevel: average(totals.noiseLevel, counts.noiseLevel),
    temperatureIssues: countOutOfRange(logs, 'temperature', SAFE_RANGES.temperature),
    humidityIssues: countOutOfRange(logs, 'humidity', SAFE_RANGES.humidity),
    spo2Issues: countBelowThreshold(logs, 'spo2', SAFE_RANGES.spo2.min),
    heartRateIssues: countOutOfRange(logs, 'heartRate', SAFE_RANGES.heartRate),
    cryAlerts: countTextAlerts(logs, 'cryStatus', /(cry|alert|detected|yes|true|on)/i),
    presenceAlerts: countTextAlerts(logs, 'presenceStatus', /(absent|missing|no|false|off)/i),
  }
}

const buildAlerts = (logs, summary) => {
  const alerts = []
  const total = summary.totalLogs || logs.length || 1

  pushAlert(alerts, 'Temperature outside safe range', summary.temperatureIssues, total, 'warning')
  pushAlert(alerts, 'Humidity outside safe range', summary.humidityIssues, total, 'warning')
  pushAlert(alerts, 'SpO2 below 90%', summary.spo2Issues, total, 'critical')
  pushAlert(alerts, 'Heart rate outside safe range', summary.heartRateIssues, total, 'warning')
  pushAlert(alerts, 'Cry detected', summary.cryAlerts, total, 'warning')
  pushAlert(alerts, 'Presence marked absent', summary.presenceAlerts, total, 'critical')

  return alerts
}

const buildAiSummary = (summary, alerts, label) => {
  if (!summary.totalLogs) {
    return `No SensorLogs were found for ${label}.`
  }

  const status = getOverallStatus(summary, alerts)
  const sentences = [
    `${label} remained ${status.word.toLowerCase()} with ${formatNumber(
      summary.compliancePercentage,
      1
    )}% compliance.`,
    `Average temperature was ${formatNumber(summary.avgTemperature, 1)} °C, humidity was ${formatNumber(
      summary.avgHumidity,
      1
    )}%, SpO2 was ${formatNumber(summary.avgSpo2, 1)}%, heart rate was ${formatNumber(
      summary.avgHeartRate,
      1
    )} bpm, and noise level averaged ${formatNumber(summary.avgNoiseLevel, 1)}.`,
  ]

  const alertLead = alerts.slice(0, 2)
  if (alertLead.length) {
    sentences.push(
      alertLead
        .map((alert) => `${alert.label.toLowerCase()} in ${alert.count} readings`)
        .join('. ')
    )
  } else {
    sentences.push('No major safety violations were detected in the selected range.')
  }

  return sentences.join(' ')
}

const getOverallStatus = (summary, alerts) => {
  if (summary.compliancePercentage >= 95 && alerts.length === 0) {
    return { word: 'Good', severity: 'success' }
  }
  if (summary.compliancePercentage >= 80) {
    return { word: 'Warning', severity: 'warning' }
  }
  return { word: 'Critical', severity: 'error' }
}

const pushAlert = (alerts, label, count, total, severity) => {
  if (!count) return
  const ratio = total ? count / total : 0
  alerts.push({
    key: label,
    label,
    count,
    severity: ratio >= 0.2 || severity === 'critical' ? 'critical' : severity,
    detail: `${count} of ${total} logs were affected.`,
  })
}

const isLogSafe = (log) => {
  const tempSafe =
    typeof log.temperature !== 'number' || isWithinRange(log.temperature, SAFE_RANGES.temperature)
  const humiditySafe =
    typeof log.humidity !== 'number' || isWithinRange(log.humidity, SAFE_RANGES.humidity)
  const spo2Safe = typeof log.spo2 !== 'number' || log.spo2 >= SAFE_RANGES.spo2.min
  const heartRateSafe =
    typeof log.heartRate !== 'number' || isWithinRange(log.heartRate, SAFE_RANGES.heartRate)

  return tempSafe && humiditySafe && spo2Safe && heartRateSafe
}

const countOutOfRange = (logs, key, range) =>
  logs.reduce((count, log) => {
    if (typeof log[key] !== 'number') return count
    return isWithinRange(log[key], range) ? count : count + 1
  }, 0)

const countBelowThreshold = (logs, key, min) =>
  logs.reduce((count, log) => (typeof log[key] === 'number' && log[key] < min ? count + 1 : count), 0)

const countTextAlerts = (logs, key, matcher) =>
  logs.reduce((count, log) => {
    const value = normalizeStatus(log[key])
    return value && matcher.test(value) ? count + 1 : count
  }, 0)

const isWithinRange = (value, range) => {
  if (typeof value !== 'number') return false
  if (typeof range.min === 'number' && value < range.min) return false
  if (typeof range.max === 'number' && value > range.max) return false
  return true
}

const average = (total, count) => {
  if (!count) return null
  return round(total / count)
}

const round = (value, precision = 2) => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

const formatNumber = (value, precision = 1) => {
  if (value == null || Number.isNaN(value)) return '--'
  return round(value, precision).toFixed(precision)
}

const toText = (value) => {
  if (value == null) return ''
  return String(value).trim()
}

const normalizeStatus = (value) => toText(value).toLowerCase()

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const toDateValue = (value) => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = parseSensorTimestamp(value)
    return parsed.isValid() ? parsed.toDate() : null
  }
  return null
}

const parseSensorTimestamp = (value) => {
  if (typeof value === 'number') {
    return dayjs(value)
  }

  const text = String(value).trim()
  if (!text) return dayjs('')

  const formats = [
    'MM/DD/YYYY HH:mm:ss',
    'MM/DD/YYYY HH:mm',
    'M/D/YYYY HH:mm:ss',
    'M/D/YYYY HH:mm',
    'MM/DD/YYYY',
    'M/D/YYYY',
    'MM/DD/YYYY h:mm:ss A',
    'MM/DD/YYYY h:mm A',
    'M/D/YYYY h:mm:ss A',
    'M/D/YYYY h:mm A',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD HH:mm',
    'YYYY-MM-DD',
    'YYYY-MM-DDTHH:mm:ss',
    'YYYY-MM-DDTHH:mm:ss.SSS',
    'YYYY-MM-DDTHH:mm:ss.SSSZ',
  ]

  for (const format of formats) {
    const parsed = dayjs(text, format, true)
    if (parsed.isValid()) return parsed
  }

  const normalizedText = text.replace(' ', 'T')
  const isoParsed = dayjs(normalizedText)
  if (isoParsed.isValid()) return isoParsed

  return dayjs.invalid?.() || dayjs('')
}
