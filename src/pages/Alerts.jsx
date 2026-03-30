import { useEffect, useMemo, useState } from 'react'
import {
  Stack,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert as MuiAlert,
  Divider,
} from '@mui/material'
import dayjs from 'dayjs'
import { fetchAlerts } from '../services/incubatorService'
import PageHeader from '../components/common/PageHeader'

const severityOptions = ['all', 'normal', 'warning', 'critical']
const typeOptions = [
  'all',
  'High temperature',
  'Low temperature',
  'Humidity abnormal',
  'SpO2 drop',
  'Baby crying detected',
  'Baby removed detected',
  'Anomaly detected',
  'Sensor failure',
]

function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [filters, setFilters] = useState({
    severity: 'all',
    type: 'all',
    date: '',
  })
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const data = await fetchAlerts()
        setAlerts(data)
      } catch (err) {
        setError(err.message)
      }
    }
    loadAlerts()
  }, [])

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchSeverity = filters.severity === 'all' || alert.severity === filters.severity
      const matchType = filters.type === 'all' || alert.type === filters.type
      const matchDate =
        !filters.date ||
        dayjs(alert.createdAt).isSame(dayjs(filters.date), 'day')
      return matchSeverity && matchType && matchDate
    })
  }, [alerts, filters])

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Alerts"
        subtitle="Filter and review incubator events captured by the AI monitoring stack."
      />
      <Card>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  label="Severity"
                  value={filters.severity}
                  onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}
                >
                  {severityOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type"
                  value={filters.type}
                  onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                >
                  {typeOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={filters.date}
                onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
              />
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={1}>
            {typeOptions.slice(1).map((type) => (
              <Grid item key={type}>
                <Chip
                  label={type}
                  variant={filters.type === type ? 'filled' : 'outlined'}
                  color="secondary"
                  onClick={() => setFilters((prev) => ({ ...prev, type }))}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
      {error && <MuiAlert severity="error">{error}</MuiAlert>}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Alert History
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAlerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>{alert.type}</TableCell>
                  <TableCell>
                    <Chip
                      label={alert.severity}
                      color={
                        alert.severity === 'critical'
                          ? 'error'
                          : alert.severity === 'warning'
                            ? 'warning'
                            : 'success'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{alert.message}</TableCell>
                  <TableCell>
                    <Chip
                      label={alert.resolved ? 'Resolved' : 'Open'}
                      color={alert.resolved ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {alert.createdAt
                      ? dayjs(alert.createdAt).format('MMM D, HH:mm')
                      : 'N/A'}
                  </TableCell>
                </TableRow>
              ))}
              {!filteredAlerts.length && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary">
                      No alerts match the selected filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  )
}

export default Alerts
