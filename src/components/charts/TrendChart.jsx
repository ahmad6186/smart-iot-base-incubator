import { Card, CardContent, Typography } from '@mui/material'
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

function TrendChart({ title, data = [], color = '#6366f1', unit }) {
  const formattedData = data.map((point) => ({
    ...point,
    label: point.timestamp ? dayjs(point.timestamp).format('HH:mm') : '',
  }))

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ height: '100%' }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        {formattedData.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => `${value} ${unit || ''}`} />
              <Line type="natural" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No trend data available
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export default TrendChart
