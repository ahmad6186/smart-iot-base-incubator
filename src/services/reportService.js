import dayjs from 'dayjs'
import { fetchReports as fetchBackendReports } from './incubatorService'

const RANGE_OPTIONS = [
  { label: 'All entries', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: 'last7' },
  { label: 'Last 30 days', value: 'last30' },
  { label: 'Custom range', value: 'custom' },
]

export const REPORT_RANGE_OPTIONS = RANGE_OPTIONS

export const fetchSensorLogsReport = async ({ rangeKey = 'all', customFrom, customTo } = {}) => {
  const window = resolveRangeWindow(rangeKey, customFrom, customTo)
  const report = await fetchBackendReports({
    rangeKey: window.rangeKey,
    from: window.start ? window.start.toISOString() : undefined,
    to: window.end ? window.end.toISOString() : undefined,
  })

  return normalizeBackendReport(report, window)
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

const normalizeBackendReport = (report = {}, window) => {
  const logs = Array.isArray(report.logs)
    ? report.logs
    : Array.isArray(report.rows)
      ? report.rows
      : []
  const summary = {
    totalLogs: 0,
    safeLogs: 0,
    compliancePercentage: 0,
    avgTemperature: null,
    avgHumidity: null,
    avgSpo2: null,
    avgHeartRate: null,
    avgNoiseLevel: null,
    ...(report.summary || {}),
  }

  return {
    rangeKey: report.rangeKey || window.rangeKey,
    rangeLabel: report.rangeLabel || window.label,
    windowStart: report.windowStart ?? (window.start ? window.start.toISOString() : null),
    windowEnd: report.windowEnd ?? (window.end ? window.end.toISOString() : null),
    logs,
    summary,
    alerts: Array.isArray(report.alerts) ? report.alerts : [],
    statusLabel: report.statusLabel || 'Warning',
    statusColor: report.statusColor || 'warning',
    aiSummary: report.aiSummary || `No SensorLogs were found for ${window.label}.`,
    chartSeries: {
      temperature: [],
      humidity: [],
      spo2: [],
      heartRate: [],
      noiseLevel: [],
      ...(report.chartSeries || {}),
    },
  }
}
