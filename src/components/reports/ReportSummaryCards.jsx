import { Card, CardContent, Chip, Grid, Stack, Typography, Box } from '@mui/material'
import ThermostatIcon from '@mui/icons-material/Thermostat'
import WaterDropIcon from '@mui/icons-material/WaterDrop'
import FavoriteIcon from '@mui/icons-material/Favorite'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import StorageIcon from '@mui/icons-material/Storage'
import VerifiedIcon from '@mui/icons-material/Verified'

const formatValue = (value, unit) => {
  if (value == null) return '--'
  return `${value} ${unit}`
}

const summaryCards = (summary) => [
  {
    title: 'Average Temperature',
    value: formatValue(summary.avgTemperature, '°C'),
    helper: 'Safe range 36.0 - 38.0 °C',
    icon: <ThermostatIcon />,
  },
  {
    title: 'Average Humidity',
    value: formatValue(summary.avgHumidity, '%'),
    helper: 'Safe range 40 - 70 %',
    icon: <WaterDropIcon />,
  },
  {
    title: 'Average SpO2',
    value: formatValue(summary.avgSpo2, '%'),
    helper: 'Safe range 90+ %',
    icon: <FavoriteIcon />,
  },
  {
    title: 'Average Heart Rate',
    value: formatValue(summary.avgHeartRate, 'bpm'),
    helper: 'Safe range 100 - 160 bpm',
    icon: <MonitorHeartIcon />,
  },
  {
    title: 'Total Logs',
    value: `${summary.totalLogs ?? 0}`,
    helper: 'Rows returned from SensorLogs',
    icon: <StorageIcon />,
  },
  {
    title: 'Compliance',
    value: `${summary.compliancePercentage ?? 0}%`,
    helper: `${summary.safeLogs ?? 0} logs within the safe range`,
    icon: <VerifiedIcon />,
    highlight: true,
  },
]

function ReportSummaryCards({ summary, rangeLabel, statusLabel, statusColor }) {
  const cards = summaryCards(summary)

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
        <Typography variant="h6">Report Summary</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={rangeLabel} variant="outlined" />
          <Chip label={statusLabel} color={statusColor} />
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {cards.map((card) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={card.title}>
            <Card
              sx={{
                height: '100%',
                border: card.highlight ? '1px solid' : '1px solid transparent',
                borderColor: card.highlight ? 'primary.main' : 'divider',
                backgroundColor: card.highlight ? 'rgba(37, 99, 235, 0.04)' : 'background.paper',
              }}
            >
              <CardContent sx={{ height: '100%' }}>
                <Stack spacing={1.5} sx={{ height: '100%' }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: card.highlight ? 'primary.main' : 'text.secondary',
                      backgroundColor: card.highlight ? 'rgba(37, 99, 235, 0.08)' : 'grey.100',
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      {card.title}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {card.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {card.helper}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  )
}

export default ReportSummaryCards
