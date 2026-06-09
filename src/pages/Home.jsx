import { useState } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Snackbar,
  Alert,
  Stack,
  Chip,
  CircularProgress,
} from '@mui/material'


import dayjs from 'dayjs'
import AlertsPanel from '../components/dashboard/AlertsPanel'
import TemperatureRangeControl from '../components/dashboard/TemperatureRangeControl'
import useIncubatorData from '../hooks/useIncubatorData'
import {
  updateSetpoints,
} from '../services/incubatorService'
import PageHeader from '../components/common/PageHeader'
import { useAuth } from '../context/AuthContext'

const sensitiveLiveDataKeyPattern =
  /(password|secret|token|api[-_]?key|private[-_]?key|credential|cookie|session|authorization|auth)/i

const hiddenLiveDataKeys = new Set([
  'heartRateTrend',
  'humidityTrend',
  'spo2Trend',
  'temperatureTrend',
  'noiseTrend',
])

const statusFromRange = (value, range) => {
  if (!range) return 'normal'
  const [min, max] = range
  if (value == null) return 'normal'
  if (value < min || value > max) {
    const diff = Math.min(Math.abs(value - min), Math.abs(value - max))
    return diff > 1 ? 'critical' : 'warning'
  }
  return 'normal'
}

const formatLiveDataValue = (key, value) => {
  if (sensitiveLiveDataKeyPattern.test(key)) return 'Redacted'
  if (value == null || value === '') return '--'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '--'
  if (typeof value === 'string') return value

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

function Home() {
  const { liveData, settings, alerts, loading, error } = useIncubatorData()
  const { isAdmin } = useAuth()
  const canControl = Boolean(isAdmin)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const handleTemperatureRangeChange = async ({ minTemp, maxTemp }) => {
    if (!settings || !canControl) return
    if (!Number.isFinite(minTemp) || !Number.isFinite(maxTemp)) {
      setSnackbar({
        open: true,
        message: 'minTemp and maxTemp must be valid numbers',
        severity: 'error',
      })
      return
    }
    if (minTemp > maxTemp) {
      setSnackbar({
        open: true,
        message: 'minTemp cannot be greater than maxTemp',
        severity: 'error',
      })
      return
    }

    const result = await updateSetpoints({ minTemp, maxTemp })
    setSnackbar({
      open: true,
      message: result.success ? 'Temperature limits saved' : result.error,
      severity: result.success ? 'success' : 'error',
    })
  }

  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false })

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  const safeRanges = settings?.safeRanges || {}
  const minTemp = settings?.minTemp ?? safeRanges.temperature?.[0]
  const maxTemp = settings?.maxTemp ?? safeRanges.temperature?.[1]
  const temperatureRange =
    minTemp !== undefined && maxTemp !== undefined ? [minTemp, maxTemp] : safeRanges.temperature
  const connectionStatus = liveData?.connectionStatus || 'Offline'
  const lastUpdatedText = liveData?.lastUpdated
    ? dayjs(liveData.lastUpdated).format('MMM D, HH:mm:ss')
    : 'Awaiting telemetry from Firebase'
  const liveDataEntries = liveData
    ? Object.entries(liveData).filter(([key]) => !hiddenLiveDataKeys.has(key))
    : []

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Dashboard"
        subtitle="Live incubator readings, temperature limits, and alerts."
        eyebrow="Dashboard"
      />
      {error && (
        <Alert severity="error" variant="outlined">
          {error}
        </Alert>
      )}
     

      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
            <Typography variant="h6">Current Readings</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={connectionStatus} color={connectionStatus === 'Online' ? 'success' : 'warning'} />
              <Chip label={`${alerts.length} alerts`} variant="outlined" />
            </Stack>
          </Stack>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
              <Typography variant="h6">Live Data Fields</Typography>
              <Chip label={`${liveDataEntries.length} fields`} color="primary" variant="outlined" />
            </Stack>

            {liveDataEntries.length > 0 ? (
              <Grid container spacing={1.5}>
                {liveDataEntries.map(([key, value]) => (
                  <Grid item xs={12} sm={6} md={4} key={key}>
                    <Box
                      sx={{
                        height: '100%',
                        minWidth: 0,
                        p: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        backgroundColor: 'grey.50',
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          wordBreak: 'break-word',
                        }}
                      >
                        {key}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 0.5,
                          fontWeight: 600,
                          maxHeight: 120,
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {formatLiveDataValue(key, value)}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No liveData fields available yet.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Setpoints</Typography>
                  <Chip label={settings ? 'Configured' : 'Waiting'} color={settings ? 'primary' : 'default'} size="small" variant="outlined" />
                </Stack>
                {settings ? (
                  <>
                    <TemperatureRangeControl
                      unit="°C"
                      minValue={minTemp}
                      maxValue={maxTemp}
                      bounds={[0, 100]}
                      onSave={handleTemperatureRangeChange}
                      disabled={!canControl}
                    />
                    {!canControl && (
                      <Alert severity="info">
                        View-only mode: contact an administrator to update target ranges.
                      </Alert>
                    )}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No setpoint configuration available yet. Connect AWS settings storage to manage
                    thresholds remotely.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <AlertsPanel alerts={alerts} />
        </Grid>
      </Grid>

      

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={handleCloseSnackbar} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  )
}

export default Home
