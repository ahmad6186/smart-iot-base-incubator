import { useEffect, useState, useMemo } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert as MuiAlert,
} from '@mui/material'
import dayjs from 'dayjs'
import TrendChart from '../components/charts/TrendChart'
import { fetchReports } from '../services/incubatorService'

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

  const latest = reports[0]

  const temperatureTrend = useMemo(
    () =>
      reports.map((report, idx) => ({
        timestamp: report.createdAt || dayjs().subtract(idx, 'week').toISOString(),
        value: report.averageTemperature,
      })),
    [reports]
  )
  const humidityTrend = useMemo(
    () =>
      reports.map((report, idx) => ({
        timestamp: report.createdAt || dayjs().subtract(idx, 'week').toISOString(),
        value: report.averageHumidity,
      })),
    [reports]
  )
  const spo2Trend = useMemo(
    () =>
      reports.map((report, idx) => ({
        timestamp: report.createdAt || dayjs().subtract(idx, 'week').toISOString(),
        value: report.averageSpo2,
      })),
    [reports]
  )
  const heartRateTrend = useMemo(
    () =>
      reports.map((report, idx) => ({
        timestamp: report.createdAt || dayjs().subtract(idx, 'week').toISOString(),
        value: report.averageHeartRate,
      })),
    [reports]
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Weekly Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aggregated vitals, AI summaries, and compliance KPIs
          </Typography>
        </Box>
        <Button variant="contained" color="secondary">
          Export PDF (Coming Soon)
        </Button>
      </Stack>

      {error && <MuiAlert severity="error">{error}</MuiAlert>}

      {latest && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <SummaryCard title="Average Temperature" value={`${latest.averageTemperature} °C`} />
          </Grid>
          <Grid item xs={12} md={3}>
            <SummaryCard title="Average Humidity" value={`${latest.averageHumidity}%`} />
          </Grid>
          <Grid item xs={12} md={3}>
            <SummaryCard title="Compliance" value={`${latest.compliance}%`} />
          </Grid>
          <Grid item xs={12} md={3}>
            <SummaryCard title="Alerts" value={latest.alertCount} />
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
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
          <List>
            {reports.map((report) => (
              <ListItem key={report.id} divider>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {report.weekRange}
                      </Typography>
                      <Chip label={`${report.compliance}% compliance`} color="success" size="small" />
                    </Stack>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" color="text.secondary">
                        Avg Temp {report.averageTemperature}°C · Avg Humidity {report.averageHumidity}% · Alerts {report.alertCount}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        AI Summary: {report.aiSummary}
                      </Typography>
                    </>
                  }
                />
                <Typography variant="caption" color="text.secondary">
                  {report.createdAt
                    ? `Generated ${dayjs(report.createdAt).format('MMM D, YYYY')}`
                    : 'Awaiting generation timestamp'}
                </Typography>
              </ListItem>
            ))}
            {!reports.length && (
              <ListItem>
                <ListItemText
                  primary="No reports generated yet."
                  secondary="Once AI summaries are produced they will appear here."
                />
              </ListItem>
            )}
          </List>
        </CardContent>
      </Card>
    </Box>
  )
}

const SummaryCard = ({ title, value }) => (
  <Card sx={{ borderRadius: 4 }}>
    <CardContent>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        {value ?? '--'}
      </Typography>
    </CardContent>
  </Card>
)

export default Reports
