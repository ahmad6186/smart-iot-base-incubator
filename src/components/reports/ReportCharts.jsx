import { Grid } from '@mui/material'
import ReadingsOverviewChart from '../charts/ReadingsOverviewChart'

function ReportCharts({ series }) {
  return (
    <Grid container spacing={2} alignItems="stretch">
      <Grid item xs={12}>
        <ReadingsOverviewChart
          title="All Sensor Readings"
          subtitle="Report readings combined in one chart for the selected range."
          fullBleed
          metrics={[
            {
              key: 'temperature',
              label: 'Temperature',
              unit: '°C',
              color: '#ef4444',
              yAxisId: 'left',
              data: series.temperature,
            },
            {
              key: 'humidity',
              label: 'Humidity',
              unit: '%',
              color: '#0ea5e9',
              yAxisId: 'left',
              data: series.humidity,
            },
            {
              key: 'spo2',
              label: 'SpO2',
              unit: '%',
              color: '#22c55e',
              yAxisId: 'left',
              data: series.spo2,
            },
            {
              key: 'heartRate',
              label: 'Heart Rate',
              unit: 'bpm',
              color: '#8b5cf6',
              yAxisId: 'right',
              data: series.heartRate,
            },
          ]}
        />
      </Grid>
    </Grid>
  )
}

export default ReportCharts
