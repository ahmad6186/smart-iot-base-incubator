import { useEffect, useState, useMemo } from 'react'
import {
  Stack,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Alert as MuiAlert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'
import dayjs from 'dayjs'
import TrendChart from '../components/charts/TrendChart'
import { fetchReports } from '../services/incubatorService'
import PageHeader from '../components/common/PageHeader'

function Reports() {
  const [reports, setReports] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadReports = async () => {
      try {
        const data = await fetchReports()
        setReports(data)
      } catch (err) {
        setError(err.message)
      }
    }
    loadReports()
  }, [])

  const normalizedReports = useMemo(
    () =>
      reports.map((report) => ({
        id: report.id,
        weekRange: report.weekRange || report.period || 'Week',
        avgTemperature:
          report.avgTemperature ??
          report.averageTemperature ??
          null,
        avgHumidity:
          report.avgHumidity ??
          report.averageHumidity ??
          null,
        avgSpo2:
          report.avgSpo2 ??
          report.averageSpo2 ??
          null,
        avgHeartRate:
          report.avgHeartRate ??
          report.averageHeartRate ??
          null,
        alertsCount: report.alertsCount ?? report.alertCount ?? 0,
        compliance: report.compliance ?? null,
        aiSummary: report.aiSummary || 'No AI summary provided.',
        createdAt: report.createdAt || null,
      })),
    [reports]
  )

  const latest = normalizedReports[0]

  const temperatureTrend = useMemo(
    () =>
      normalizedReports.map((report, idx) => ({
        timestamp: report.createdAt || dayjs().subtract(idx, 'week').toISOString(),
        value: report.avgTemperature,
      })),
    [normalizedReports]
  )
  const humidityTrend = useMemo(
    () =>
      normalizedReports.map((report, idx) => ({
        timestamp: report.createdAt || dayjs().subtract(idx, 'week').toISOString(),
        value: report.avgHumidity,
      })),
    [normalizedReports]
  )
  const spo2Trend = useMemo(
    () =>
      normalizedReports.map((report, idx) => ({
        timestamp: report.createdAt || dayjs().subtract(idx, 'week').toISOString(),
        value: report.avgSpo2,
      })),
    [normalizedReports]
  )
  const heartRateTrend = useMemo(
    () =>
      normalizedReports.map((report, idx) => ({
        timestamp: report.createdAt || dayjs().subtract(idx, 'week').toISOString(),
        value: report.avgHeartRate,
      })),
    [normalizedReports]
  )

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Weekly Reports"
        subtitle="Aggregated vitals, alert frequency, and AI assessments."
        action={
          <Button variant="contained" color="secondary">
            Export (soon)
          </Button>
        }
      />

      {error && <MuiAlert severity="error">{error}</MuiAlert>}

      {latest && (
        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} md={3}>
            <SummaryCard title="Average Temperature" value={formatMetric(latest.avgTemperature, '°C')} />
          </Grid>
          <Grid item xs={12} md={3}>
            <SummaryCard title="Average Humidity" value={formatMetric(latest.avgHumidity, '%')} />
          </Grid>
          <Grid item xs={12} md={3}>
            <SummaryCard title="Compliance" value={formatMetric(latest.compliance, '%')} />
          </Grid>
          <Grid item xs={12} md={3}>
            <SummaryCard title="Alerts" value={latest.alertsCount} />
          </Grid>
        </Grid>
      )}

      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} md={6}>
          <TrendChart title="Temperature Trend" data={temperatureTrend} unit="°C" />
        </Grid>
        <Grid item xs={12} md={6}>
          <TrendChart title="Humidity Trend" data={humidityTrend} unit="%" />
        </Grid>
        <Grid item xs={12} md={6}>
          <TrendChart title="SpO₂ Trend" data={spo2Trend} unit="%" />
        </Grid>
        <Grid item xs={12} md={6}>
          <TrendChart title="Heart Rate Trend" data={heartRateTrend} unit="bpm" />
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Report History
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Week</TableCell>
                <TableCell>Avg Temp (°C)</TableCell>
                <TableCell>Avg Humidity (%)</TableCell>
                <TableCell>Avg SpO₂ (%)</TableCell>
                <TableCell>Avg Heart Rate</TableCell>
                <TableCell>Alerts</TableCell>
                <TableCell>Compliance</TableCell>
                <TableCell>AI Summary</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {normalizedReports.map((report) => (
                <TableRow key={report.id || report.weekRange}>
                  <TableCell>{report.weekRange}</TableCell>
                  <TableCell>{formatMetric(report.avgTemperature, '°C')}</TableCell>
                  <TableCell>{formatMetric(report.avgHumidity, '%')}</TableCell>
                  <TableCell>{formatMetric(report.avgSpo2, '%')}</TableCell>
                  <TableCell>{formatMetric(report.avgHeartRate, 'bpm')}</TableCell>
                  <TableCell>
                    <Chip label={report.alertsCount} color="primary" variant="outlined" size="small" />
                  </TableCell>
                  <TableCell>{formatMetric(report.compliance, '%')}</TableCell>
                  <TableCell>{report.aiSummary}</TableCell>
                </TableRow>
              ))}
              {!normalizedReports.length && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" color="text.secondary">
                      No reports generated yet. Once AI summaries are produced they will appear here.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  )
}

const SummaryCard = ({ title, value }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
        {value ?? '--'}
      </Typography>
    </CardContent>
  </Card>
)

const formatMetric = (value, unit) => {
  if (value == null) return '--'
  if (typeof value === 'number') {
    return unit ? `${value} ${unit}` : value
  }
  return value
}

export default Reports
