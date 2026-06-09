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
import { panelSx, softAccentPanelSx } from '../components/common/surfaceStyles'

const sensitiveLiveDataKeyPattern =
  /(password|secret|token|api[-_]?key|private[-_]?key|credential|cookie|session|authorization|auth)/i

const hiddenLiveDataKeys = new Set([
  'heartRateTrend',
  'humidityTrend',
  'spo2Trend',
  'temperatureTrend',
  'noiseTrend',
  'timestamp',
  'id'
])

const liveDataHighlightConfig = {
  temperature: {
    accent: '#dc2626',
    badgeBg: 'rgba(15, 23, 42, 0.06)',
    badgeLabel: 'TEMP',
  },
  humidity: {
    accent: '#0284c7',
    badgeBg: 'rgba(15, 23, 42, 0.06)',
    badgeLabel: 'HUM',
  },
  spo2: {
    accent: '#16a34a',
    badgeBg: 'rgba(15, 23, 42, 0.06)',
    badgeLabel: 'SpO2',
  },
  heartRate: {
    accent: '#7c3aed',
    badgeBg: 'rgba(15, 23, 42, 0.06)',
    badgeLabel: 'BPM',
  },
  noise: {
    accent: '#ea580c',
    badgeBg: 'rgba(15, 23, 42, 0.06)',
    badgeLabel: 'NOISE',
  },
  noiseLevel: {
    accent: '#ea580c',
    badgeBg: 'rgba(15, 23, 42, 0.06)',
    badgeLabel: 'NOISE',
  },
  connectionStatus: {
    accent: '#0f766e',
    badgeBg: 'rgba(15, 23, 42, 0.06)',
    badgeLabel: 'STATUS',
  },
  lastUpdated: {
    accent: '#475569',
    badgeBg: 'rgba(15, 23, 42, 0.06)',
    badgeLabel: 'SYNC',
  },
  mode: {
    accent: '#1d4ed8',
    badgeBg: 'rgba(15, 23, 42, 0.06)',
    badgeLabel: 'MODE',
  },
}

const prettifyLiveDataKey = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase())

const getLiveDataCardStyle = (key) =>
  liveDataHighlightConfig[key] || {
    accent: '#2563eb',
    badgeBg: 'rgba(15, 23, 42, 0.06)',
    badgeLabel: 'LIVE',
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
  const summaryCards = [
    {
      label: 'Connection',
      value: connectionStatus,
      tone: connectionStatus === 'Online' ? 'success.main' : 'warning.main',
      caption: 'Device telemetry link',
    },
    {
      label: 'Last Updated',
      value: liveData?.lastUpdated ? dayjs(liveData.lastUpdated).fromNow?.() || lastUpdatedText : 'Waiting',
      tone: 'text.primary',
      caption: lastUpdatedText,
    },
    {
      label: 'Visible Fields',
      value: String(liveDataEntries.length),
      tone: 'primary.main',
      caption: 'Displayed on this page',
    },
    {
      label: 'Access',
      value: canControl ? 'Admin Control' : 'View Only',
      tone: canControl ? 'info.main' : 'text.primary',
      caption: canControl ? 'Setpoints can be updated' : 'Changes require admin access',
    },
  ]

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Dashboard"
        subtitle="Live incubator readings, temperature limits, and alerts."
        eyebrow="Dashboard"
        action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Chip
              label={connectionStatus}
              color={connectionStatus === 'Online' ? 'success' : 'warning'}
            />
            <Chip label={`${alerts.length} alerts`} variant="outlined" />
          </Stack>
        }
      />
      {error && (
        <Alert severity="error" variant="outlined">
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.label}>
            <Card sx={card.label === 'Connection' ? softAccentPanelSx : panelSx}>
              <CardContent>
                <Stack spacing={0.75}>
                  <Typography variant="overline" color="text.secondary">
                    {card.label}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: card.tone }}>
                    {card.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.caption}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Card sx={panelSx}>
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Box>
                    <Typography variant="h6">Live Data Fields</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Current telemetry values from the incubator controller.
                    </Typography>
                  </Box>
                  <Chip label={`${liveDataEntries.length} fields`} color="primary" variant="outlined" />
                </Stack>

                {liveDataEntries.length > 0 ? (
                  <Grid container spacing={1.5}>
                    {liveDataEntries.map(([key, value]) => (
                      <Grid item xs={12} sm={6} xl={4} key={key}>
                        {(() => {
                          const cardStyle = getLiveDataCardStyle(key)
                          return (
                            <Box
                              sx={{
                                height: '100%',
                                minWidth: 0,
                                p: 2,
                                borderRadius: 1.5,
                                border: '1px solid rgba(15, 23, 42, 0.14)',
                                background:
                                  'linear-gradient(135deg, rgba(248,250,252,0.95) 0%, rgba(255,255,255,1) 68%)',
                                boxShadow: `0 18px 36px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.65)`,
                                position: 'relative',
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 12,
                                  right: -24,
                                  width: 92,
                                  height: 92,
                                  borderRadius: '22px',
                                  transform: 'rotate(24deg)',
                                  background: 'linear-gradient(135deg, rgba(15,23,42,0.05) 0%, rgba(255,255,255,0) 100%)',
                                  border: '1px solid rgba(15, 23, 42, 0.06)',
                                }}
                              />
                              <Stack spacing={1.25} sx={{ position: 'relative' }}>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  justifyContent="space-between"
                                  alignItems="flex-start"
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      display: 'block',
                                      fontWeight: 700,
                                      color: 'text.secondary',
                                      letterSpacing: 0.9,
                                      textTransform: 'uppercase',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {prettifyLiveDataKey(key)}
                                  </Typography>
                                  <Box
                                    sx={{
                                      px: 1.1,
                                      py: 0.5,
                                      borderRadius: 1,
                                      backgroundColor: 'rgba(255,255,255,0.82)',
                                      color: cardStyle.accent,
                                      border: '1px solid rgba(15, 23, 42, 0.08)',
                                      boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                                      fontSize: 10,
                                      fontWeight: 800,
                                      lineHeight: 1,
                                      letterSpacing: 0.8,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {cardStyle.badgeLabel}
                                  </Box>
                                </Stack>
                                <Typography
                                  variant="h6"
                                  sx={{
                                    fontWeight: 700,
                                    color: cardStyle.accent,
                                    fontFamily: '"Space Grotesk", "Segoe UI", sans-serif',
                                    textShadow: '0 1px 0 rgba(255,255,255,0.6)',
                                    maxHeight: 120,
                                    overflow: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {formatLiveDataValue(key, value)}
                                </Typography>
                              </Stack>
                            </Box>
                          )
                        })()}
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
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <Card sx={panelSx}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Setpoints</Typography>
                    <Chip
                      label={settings ? 'Configured' : 'Waiting'}
                      color={settings ? 'primary' : 'default'}
                      size="small"
                      variant="outlined"
                    />
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
                      No setpoint configuration available yet. Connect AWS settings storage to
                      manage thresholds remotely.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
            <AlertsPanel alerts={alerts} />
          </Stack>
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
