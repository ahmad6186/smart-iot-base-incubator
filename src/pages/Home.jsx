import { useState } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Snackbar,
  Alert,
  Stack,
  Chip,
  Divider,
  CircularProgress,
} from '@mui/material'
import ThermostatIcon from '@mui/icons-material/Thermostat'
import WaterDropIcon from '@mui/icons-material/WaterDrop'
import FavoriteIcon from '@mui/icons-material/Favorite'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import HearingIcon from '@mui/icons-material/Hearing'
import BabyChangingStationIcon from '@mui/icons-material/BabyChangingStation'
import WifiTetheringIcon from '@mui/icons-material/WifiTethering'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import dayjs from 'dayjs'
import VitalCard from '../components/dashboard/VitalCard'
import AlertsPanel from '../components/dashboard/AlertsPanel'
import ActuatorToggle from '../components/dashboard/ActuatorToggle'
import SetpointControl from '../components/dashboard/SetpointControl'
import AiFeatureCard from '../components/dashboard/AiFeatureCard'
import useIncubatorData from '../hooks/useIncubatorData'
import {
  updateActuator,
  updateMode,
  updateSetpoints,
} from '../services/incubatorService'
import PageHeader from '../components/common/PageHeader'
import { useAuth } from '../context/AuthContext'

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

function Home() {
  const { liveData, actuators, settings, alerts, loading, error } = useIncubatorData()
  const { isAdmin } = useAuth()
  const canControl = Boolean(isAdmin)
  const [modeSaving, setModeSaving] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const handleModeChange = async (_, value) => {
    if (!value || !liveData || !canControl) return
    setModeSaving(true)
    const result = await updateMode(value)
    setSnackbar({
      open: true,
      message: result.success ? `Mode changed to ${value}` : result.error,
      severity: result.success ? 'success' : 'error',
    })
    setModeSaving(false)
  }

  const handleActuatorChange = async (name, value) => {
    if (!actuators || !canControl) return
    const result = await updateActuator(name, value)
    setSnackbar({
      open: true,
      message: result.success ? `${name} updated` : result.error,
      severity: result.success ? 'success' : 'error',
    })
  }

  const handleSetpointChange = async (field, value) => {
    if (!settings || !canControl) return
    const result = await updateSetpoints({ [field]: Number(value) })
    setSnackbar({
      open: true,
      message: result.success ? `${field} setpoint saved` : result.error,
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
  const connectionStatus = liveData?.connectionStatus || 'Offline'
  const lastUpdatedText = liveData?.lastUpdated
    ? dayjs(liveData.lastUpdated).format('MMM D, HH:mm:ss')
    : 'Awaiting telemetry from AWS'

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Dashboard"
        subtitle="Live incubator readings, actuator state, and alerts."
        eyebrow="Dashboard"
      />
      {error && (
        <Alert severity="error" variant="outlined">
          {error}
        </Alert>
      )}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
              <Typography variant="h6">Live Snapshot</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  icon={<WifiTetheringIcon />}
                  label={connectionStatus === 'Online' ? 'Connected' : 'Awaiting device'}
                  color={connectionStatus === 'Online' ? 'success' : 'warning'}
                  variant={connectionStatus === 'Online' ? 'filled' : 'outlined'}
                />
                <Chip label={`Mode: ${liveData?.mode || 'Unknown'}`} variant="outlined" />
                <Chip
                  icon={<NotificationsActiveIcon />}
                  label={`${alerts.length} alerts`}
                  color="secondary"
                  variant="outlined"
                />
              </Stack>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Last update
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {lastUpdatedText}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Controller mode
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {liveData?.mode || 'Unknown'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Active alerts
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {alerts.length}
                </Typography>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>
      {!liveData && (
        <Alert severity="info" variant="outlined">
          No live incubator telemetry yet. Connect your AWS data pipeline to start streaming vitals.
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
        <Grid item xs={12} sm={6} md={3}>
          <VitalCard
            title="Temperature"
            value={liveData?.temperature}
            unit="°C"
            status={statusFromRange(liveData?.temperature, safeRanges.temperature)}
            icon={<ThermostatIcon fontSize="large" />}
            footer="Core incubator temperature"
            min={safeRanges.temperature?.[0]}
            max={safeRanges.temperature?.[1]}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalCard
            title="Humidity"
            value={liveData?.humidity}
            unit="%"
            status={statusFromRange(liveData?.humidity, safeRanges.humidity)}
            icon={<WaterDropIcon fontSize="large" />}
            footer="Relative humidity"
            min={safeRanges.humidity?.[0]}
            max={safeRanges.humidity?.[1]}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalCard
            title="SpO₂"
            value={liveData?.spo2}
            unit="%"
            status={statusFromRange(liveData?.spo2, safeRanges.spo2)}
            icon={<FavoriteIcon fontSize="large" />}
            footer="Peripheral oxygen saturation"
            min={safeRanges.spo2?.[0]}
            max={safeRanges.spo2?.[1]}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalCard
            title="Heart Rate"
            value={liveData?.heartRate}
            unit="bpm"
            status={statusFromRange(liveData?.heartRate, safeRanges.heartRate)}
            icon={<MonitorHeartIcon fontSize="large" />}
            footer="Infant heart rate"
            min={safeRanges.heartRate?.[0]}
            max={safeRanges.heartRate?.[1]}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalCard
            title="System Status"
            value={connectionStatus}
            status={connectionStatus === 'Online' ? 'normal' : 'critical'}
            icon={<WifiTetheringIcon fontSize="large" />}
            footer={`Mode: ${liveData?.mode || 'Unknown'}`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalCard
            title="Noise Level"
            value={liveData?.noise}
            unit="dB"
            status="normal"
            icon={<HearingIcon fontSize="large" />}
            footer="Ambient NICU noise"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalCard
            title="Cry Detection"
            value={liveData?.cryStatus}
            status={liveData?.cryStatus === 'Crying' ? 'warning' : 'normal'}
            icon={<BabyChangingStationIcon fontSize="large" />}
            footer="AI powered cry analysis"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalCard
            title="Baby Presence"
            value={liveData?.presenceStatus}
            status={liveData?.presenceStatus === 'Absent' ? 'critical' : 'normal'}
            icon={<BabyChangingStationIcon fontSize="large" />}
            footer="Computer vision occupancy"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Mode & Controls</Typography>
                  <Chip label={canControl ? 'Admin' : 'Read only'} color={canControl ? 'primary' : 'default'} size="small" />
                </Stack>
                <ToggleButtonGroup
                  exclusive
                  value={liveData?.mode ?? null}
                  onChange={handleModeChange}
                  size="small"
                  disabled={modeSaving || !canControl}
                >
                  <ToggleButton value="Auto" disabled={modeSaving || !liveData || !canControl}>
                    Auto
                  </ToggleButton>
                  <ToggleButton value="Manual" disabled={modeSaving || !liveData || !canControl}>
                    Manual
                  </ToggleButton>
                </ToggleButtonGroup>
                <Divider />
                <Stack spacing={2}>
                  {!canControl && (
                    <Alert severity="info">
                      You have read-only access. Only admins can change actuator states.
                    </Alert>
                  )}
                  <ActuatorToggle
                    label="Heater"
                    value={actuators?.heater}
                    onChange={(value) => handleActuatorChange('heater', value)}
                    description="Maintain thermal comfort"
                    disabled={!actuators || !canControl}
                  />
                  <ActuatorToggle
                    label="Fan"
                    value={actuators?.fan}
                    onChange={(value) => handleActuatorChange('fan', value)}
                    description="Air circulation"
                    disabled={!actuators || !canControl}
                  />
                  <ActuatorToggle
                    label="Humidifier"
                    value={actuators?.humidifier}
                    onChange={(value) => handleActuatorChange('humidifier', value)}
                    description="Humidity regulation"
                    disabled={!actuators || !canControl}
                  />
                  <ActuatorToggle
                    label="Buzzer"
                    value={actuators?.buzzer}
                    onChange={(value) => handleActuatorChange('buzzer', value)}
                    description="Nurse alerts"
                    disabled={!actuators || !canControl}
                  />
                  <ActuatorToggle
                    label="Light"
                    value={actuators?.light}
                    onChange={(value) => handleActuatorChange('light', value)}
                    description="Observation lighting"
                    disabled={!actuators || !canControl}
                  />
                  {!actuators && (
                    <Typography variant="caption" color="text.secondary">
                      Waiting for actuator state from AWS controller.
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Setpoints</Typography>
                  <Chip label={settings ? 'Configured' : 'Waiting'} color={settings ? 'primary' : 'default'} size="small" variant="outlined" />
                </Stack>
                {settings ? (
                  <>
                    <SetpointControl
                      label="Temperature"
                      unit="°C"
                      value={settings?.temperatureSetpoint}
                      range={safeRanges.temperature || [0, 100]}
                      onSave={(value) => handleSetpointChange('temperatureSetpoint', value)}
                      disabled={!canControl}
                    />
                    <SetpointControl
                      label="Humidity"
                      unit="%"
                      value={settings?.humiditySetpoint}
                      range={safeRanges.humidity || [0, 100]}
                      onSave={(value) => handleSetpointChange('humiditySetpoint', value)}
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
        <Grid item xs={12} md={4}>
          <AlertsPanel alerts={alerts} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <AiFeatureCard
            title="AI Cry Detection"
            description="Computer audition flags prolonged crying episodes."
            status={liveData?.cryStatus === 'Crying' ? 'Alert' : 'Active'}
            insight={
              liveData ? `Latest classification: ${liveData.cryStatus}` : 'Awaiting sensor stream'
            }
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <AiFeatureCard
            title="AI Presence Detection"
            description="Monitors incubator occupancy via thermal + visual sensors."
            insight={liveData ? `Status: ${liveData.presenceStatus}` : 'Awaiting camera feed'}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <AiFeatureCard
            title="AI Anomaly Detection"
            description="Learns normal environmental signatures to surface anomalies."
            insight={
              liveData
                ? 'Monitoring incoming signals for deviations.'
                : 'Awaiting anomaly detection feed.'
            }
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <AiFeatureCard
            title="Weekly AI Summary"
            description="Generates compliance and stability narratives from reports."
            insight="Connect AWS analytics to generate weekly AI reports."
          />
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
