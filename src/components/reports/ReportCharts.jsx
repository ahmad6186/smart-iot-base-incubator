import { Grid } from '@mui/material'
import TrendChart from '../charts/TrendChart'

function ReportCharts({ series }) {
  return (
    <Grid container spacing={2} alignItems="stretch">
      <Grid item xs={12} lg={6}>
        <TrendChart title="Temperature Trend" data={series.temperature} unit="°C" />
      </Grid>
      <Grid item xs={12} lg={6}>
        <TrendChart title="Humidity Trend" data={series.humidity} unit="%" />
      </Grid>
      <Grid item xs={12} lg={6}>
        <TrendChart title="SpO2 Trend" data={series.spo2} unit="%" />
      </Grid>
      <Grid item xs={12} lg={6}>
        <TrendChart title="Heart Rate Trend" data={series.heartRate} unit="bpm" />
      </Grid>
    </Grid>
  )
}

export default ReportCharts
