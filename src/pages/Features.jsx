import { Stack, Typography, Grid, Card, CardContent, Chip } from '@mui/material'
import SensorsIcon from '@mui/icons-material/Sensors'
import PsychologyIcon from '@mui/icons-material/Psychology'
import BabyChangingStationIcon from '@mui/icons-material/BabyChangingStation'
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety'
import PageHeader from '../components/common/PageHeader'

const features = [
  {
    title: 'IoT Sensor Network',
    description: 'Redundant temperature, humidity, SpO₂, heart rate, and acoustic sensors provide continuous telemetry with automatic calibration.',
    icon: <SensorsIcon fontSize="large" />,
  },
  {
    title: 'AI Monitoring Suite',
    description: 'Edge AI models detect infant crying, presence, and environmental anomalies to support rapid interventions.',
    icon: <PsychologyIcon fontSize="large" />,
  },
  {
    title: 'Smart Actuation',
    description: 'Closed-loop control adjusts heater, fan, humidifier, light, and buzzer with clinician override options.',
    icon: <HealthAndSafetyIcon fontSize="large" />,
  },
  {
    title: 'Computer Vision Safety',
    description: 'Thermal-vision fusion ensures the baby is in the incubator, preventing accidental removal or falls.',
    icon: <BabyChangingStationIcon fontSize="large" />,
  },
]

const hardware = [
  'ESP32/ESP8266 Wi-Fi modules',
  'DHT22 & SHT45 environment sensors',
  'MAX30102 pulse oximeter',
  'MEMS microphone array',
  'Thermal + RGB camera pair',
  'PID controlled heater and humidifier',
]

const sdgs = [
  'SDG 3: Good Health and Well-being',
  'SDG 9: Industry, Innovation, and Infrastructure',
  'SDG 10: Reduced Inequalities',
]

function Features() {
  return (
    <Stack spacing={4}>
      <PageHeader
        title="Project Features"
        subtitle="Smart IoT-Based Infant Incubator with AI Monitoring System"
      />

      <Grid container spacing={2}>
        {features.map((feature) => (
          <Grid item xs={12} md={6} key={feature.title}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    {feature.icon}
                    <Typography variant="h5">{feature.title}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Core Hardware
              </Typography>
              <Stack spacing={1}>
                {hardware.map((item) => (
                  <Chip key={item} label={item} variant="outlined" />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sustainable Development Goals Alignment
              </Typography>
              <Stack spacing={1}>
                {sdgs.map((item) => (
                  <Chip key={item} color="primary" label={item} />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  )
}

export default Features
