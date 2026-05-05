import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import dayjs from 'dayjs'

const DEFAULT_METRICS = [
  {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    color: '#ef4444',
    yAxisId: 'left',
  },
  {
    key: 'humidity',
    label: 'Humidity',
    unit: '%',
    color: '#0ea5e9',
    yAxisId: 'left',
  },
  {
    key: 'spo2',
    label: 'SpO2',
    unit: '%',
    color: '#22c55e',
    yAxisId: 'left',
  },
  {
    key: 'heartRate',
    label: 'Heart Rate',
    unit: 'bpm',
    color: '#8b5cf6',
    yAxisId: 'right',
  },
  {
    key: 'noiseLevel',
    label: 'Noise Level',
    unit: 'dB',
    color: '#f97316',
    yAxisId: 'left',
  },
]

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const labelForPoint = (point, index) => {
  if (point.label) return point.label
  if (point.timestamp) return dayjs(point.timestamp).format('MMM D, HH:mm')
  return `Reading ${index + 1}`
}

const orderForPoint = (point, index) => {
  if (!point.timestamp) return index
  const parsed = dayjs(point.timestamp)
  return parsed.isValid() ? parsed.valueOf() : index
}

const buildOverviewData = (metrics) => {
  const rowsByKey = new Map()

  metrics.forEach((metric) => {
    const points = metric.data || []

    points.forEach((point, index) => {
      const rowKey = point.timestamp || point.label || String(index)
      const existing = rowsByKey.get(rowKey) || {
        id: rowKey,
        label: labelForPoint(point, index),
        order: orderForPoint(point, index),
      }

      existing[metric.key] = toNumber(point.value)
      rowsByKey.set(rowKey, existing)
    })
  })

  return Array.from(rowsByKey.values()).sort((left, right) => left.order - right.order)
}

const valueWithUnit = (value, unit) => {
  if (value == null) return 'No data'
  return `${value}${unit ? ` ${unit}` : ''}`
}

function ReadingsOverviewChart({
  title = 'All Readings Overview',
  subtitle = 'Temperature, humidity, SpO2, and heart rate in one timeline.',
  metrics = DEFAULT_METRICS,
  height = 360,
  fullBleed = false,
}) {
  const theme = useTheme()
  const chartData = buildOverviewData(metrics)
  const metricByKey = metrics.reduce((result, metric) => {
    result[metric.key] = metric
    return result
  }, {})

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...(fullBleed
          ? {
              width: {
                xs: 'calc(100vw - 32px)',
                md: 'calc(100vw - 260px - 64px)',
              },
              maxWidth: 'none',
              position: 'relative',
              left: '50%',
              transform: 'translateX(-50%)',
            }
          : {}),
      }}
    >
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack spacing={0.5} sx={{ mb: 1 }}>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        </Stack>

        <Box sx={{ flex: 1, minHeight: height }}>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={chartData} margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.8)} />
                <XAxis
                  dataKey="label"
                  interval="preserveStartEnd"
                  minTickGap={22}
                  tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                />
                <YAxis
                  yAxisId="left"
                  width={52}
                  tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  width={58}
                  tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value, _name, item) => {
                    const metric = metricByKey[item.dataKey] || {}
                    return [valueWithUnit(value, metric.unit), metric.label || item.dataKey]
                  }}
                  labelStyle={{ color: theme.palette.text.primary }}
                  contentStyle={{
                    borderRadius: 8,
                    borderColor: theme.palette.divider,
                    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
                  }}
                />
                <Legend verticalAlign="top" align="center" height={24} />
                {metrics.map((metric) => (
                  <Line
                    key={metric.key}
                    yAxisId={metric.yAxisId || 'left'}
                    type="monotone"
                    dataKey={metric.key}
                    name={metric.label}
                    stroke={metric.color}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
                {chartData.length > 2 && (
                  <Brush
                    dataKey="label"
                    height={24}
                    travellerWidth={8}
                    stroke={theme.palette.primary.main}
                    fill={theme.palette.background.paper}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No reading data available
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

export default ReadingsOverviewChart
