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
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { fetchAlerts } from '../services/incubatorService'
import PageHeader from '../components/common/PageHeader'

dayjs.extend(customParseFormat)

const alertTypeOptions = [
  'all',
  'CRITICAL_HIGH_TEMP',
  'CRITICAL_LOW_TEMP',
  'BABY_NOT_PRESENT',
  'CRITICAL_LOW_SPO2',
  'CRITICAL_LOW_HR',
  'BABY_MISSING',
]

const getAlertDateTime = (alert) =>
  alert.DateTime || alert.dateTime || alert.createdAt || alert.timestamp || null

const getAlertType = (alert) => alert.alertType || alert.type || ''

const alertDateTimeFormats = [
  'DD/MM/YYYY HH:mm:ss',
  'DD/MM/YYYY HH:mm',
  'DD/MM/YYYY, HH:mm:ss',
  'DD/MM/YYYY, HH:mm',
  'D/M/YYYY H:mm:ss',
  'D/M/YYYY H:mm',
  'D/M/YYYY, H:mm:ss',
  'D/M/YYYY, H:mm',
]

const parseAlertDateTime = (alert) => {
  const value = getAlertDateTime(alert)
  if (!value) return null

  if (typeof value === 'string') {
    for (const format of alertDateTimeFormats) {
      const parsed = dayjs(value, format, true)
      if (parsed.isValid()) return parsed
    }
  }

  const fallback = dayjs(value)
  return fallback.isValid() ? fallback : null
}

function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [filters, setFilters] = useState({
    alertType: 'all',
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
    return alerts
      .filter((alert) => {
        const alertDateTime = parseAlertDateTime(alert)
        const alertType = getAlertType(alert)
        const matchAlertType = filters.alertType === 'all' || alertType === filters.alertType
        const matchDate =
          !filters.date ||
          (alertDateTime && alertDateTime.isSame(dayjs(filters.date), 'day'))
        return matchAlertType && matchDate
      })
      .sort((first, second) => {
        const firstDateTime = parseAlertDateTime(first)
        const secondDateTime = parseAlertDateTime(second)

        if (!firstDateTime && !secondDateTime) return 0
        if (!firstDateTime) return 1
        if (!secondDateTime) return -1
        return secondDateTime.valueOf() - firstDateTime.valueOf()
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
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Alert Type</InputLabel>
                <Select
                  label="Alert Type"
                  value={filters.alertType}
                  onChange={(e) => setFilters((prev) => ({ ...prev, alertType: e.target.value }))}
                >
                  {alertTypeOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
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
            {alertTypeOptions.slice(1).map((alertType) => (
              <Grid item key={alertType}>
                <Chip
                  label={alertType}
                  variant={filters.alertType === alertType ? 'filled' : 'outlined'}
                  color="secondary"
                  onClick={() => setFilters((prev) => ({ ...prev, alertType }))}
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
                <TableCell>Message</TableCell>
                <TableCell>Alert Type</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAlerts.map((alert) => {
                const alertDateTime = parseAlertDateTime(alert)
                const alertType = getAlertType(alert)

                return (
                  <TableRow key={alert.id}>
                    <TableCell>{alert.message}</TableCell>
                    <TableCell>{alertType || 'N/A'}</TableCell>
                    <TableCell>
                      {alertDateTime ? alertDateTime.format('MMM D, YYYY') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {alertDateTime ? alertDateTime.format('HH:mm') : 'N/A'}
                    </TableCell>
                  </TableRow>
                )
              })}
              {!filteredAlerts.length && (
                <TableRow>
                  <TableCell colSpan={4}>
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
