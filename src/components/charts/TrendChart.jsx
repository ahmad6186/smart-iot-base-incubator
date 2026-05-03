import { Box, Card, CardContent, Typography } from '@mui/material'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import dayjs from 'dayjs'

function TrendChart({ title, data = [], color = '#6366f1', unit, height = 280 }) {
  const formattedData = data.map((point) => ({
    ...point,
    label: point.label || (point.timestamp ? dayjs(point.timestamp).format('MMMM D, HH:mm') : ''),
  }))

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Box sx={{ flex: 1, minHeight: height }}>
          {formattedData.length ? (
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={formattedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={16} />
                <YAxis />
                <Tooltip
                  formatter={(value) => (value == null ? 'No data' : `${value} ${unit || ''}`)}
                />
                <Line type="natural" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No trend data available
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

export default TrendChart
