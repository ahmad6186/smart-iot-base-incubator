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
import TrendChart from '../components/charts/TrendChart'
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
  const { liveData, actuators, settings, alerts, loading } = useIncubatorData()
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
        title="NICU Control Center"
        subtitle="Live neonatal telemetry, AI insights, and actuator control in one place."
      />
      <Card
        sx={{
          background: 'linear-gradient(120deg, rgba(37,99,235,0.12), rgba(14,165,233,0.12))',
          border: '1px solid rgba(37, 99, 235, 0.2)',
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                  Device status: {connectionStatus}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {lastUpdatedText}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  icon={<WifiTetheringIcon />}
                  label={connectionStatus === 'Online' ? 'Connected' : 'Awaiting device'}
                  color={connectionStatus === 'Online' ? 'success' : 'warning'}
                />
                <Chip
                  icon={<NotificationsActiveIcon />}
                  label={`${alerts.length} alerts`}
                  color="secondary"
                  variant="outlined"
                />
              </Stack>
            </Stack>
            <Typography variant="body1">
              Keep an eye on thermal comfort, respiratory health, and environmental stability. Switch
              between auto and manual modes without leaving this control center.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
      {!liveData && (
        <Alert severity="info" variant="outlined">
          No live incubator telemetry yet. Connect your AWS data pipeline to start streaming vitals.
        </Alert>
      )}

      <Grid container spacing={2} alignItems="stretch">
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

      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} md={6}>
          <TrendChart title="Temperature Trend" data={liveData?.temperatureTrend || []} unit="°C" />
        </Grid>
        <Grid item xs={12} md={6}>
          <TrendChart title="Humidity Trend" data={liveData?.humidityTrend || []} unit="%" />
        </Grid>
        <Grid item xs={12} md={6}>
          <TrendChart title="SpO₂ Trend" data={liveData?.spo2Trend || []} unit="%" />
        </Grid>
        <Grid item xs={12} md={6}>
          <TrendChart title="Heart Rate Trend" data={liveData?.heartRateTrend || []} unit="bpm" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Mode & Controls</Typography>
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
                <Typography variant="h6">Setpoints</Typography>
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
