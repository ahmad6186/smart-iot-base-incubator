import { useEffect, useState } from 'react'
import {
  Alert as MuiAlert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
} from '@mui/material'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import PageHeader from '../components/common/PageHeader'
import ReportSummaryCards from '../components/reports/ReportSummaryCards'
import ReportCharts from '../components/reports/ReportCharts'
import AISummaryCard from '../components/reports/AISummaryCard'
import { REPORT_RANGE_OPTIONS, fetchSensorLogsReport } from '../services/reportService'

dayjs.extend(customParseFormat)

function Reports() {
  const [rangeKey, setRangeKey] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [appliedRange, setAppliedRange] = useState({ rangeKey: 'all' })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    const loadReports = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchSensorLogsReport(appliedRange)
        if (!active) return
        setReport(data)
      } catch (err) {
        if (!active) return
        setReport(null)
        setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadReports()
    return () => {
      active = false
    }
  }, [appliedRange])

  const rows = report?.logs || []
  const alerts = report?.alerts || []
  const summary = report?.summary || {
    totalLogs: 0,
    safeLogs: 0,
    compliancePercentage: 0,
    avgTemperature: null,
    avgHumidity: null,
    avgSpo2: null,
    avgHeartRate: null,
    avgNoiseLevel: null,
  }
  const rangeLabel = report?.rangeLabel || 'Last 7 days'
  const statusLabel = report?.statusLabel || 'Warning'
  const statusColor = report?.statusColor || 'warning'

  const handleRangeChange = (event) => {
    const nextRange = event.target.value
    setRangeKey(nextRange)
    setError(null)
    if (nextRange !== 'custom') {
      setAppliedRange({ rangeKey: nextRange })
    }
  }

  const handleApplyCustom = (event) => {
    event.preventDefault()
    if (!customFrom || !customTo) {
      setError('Select both the start and end date/time for the custom range.')
      return
    }

    const from = dayjs(customFrom)
    const to = dayjs(customTo)
    if (!from.isValid() || !to.isValid()) {
      setError('Select valid custom date/time values.')
      return
    }
    if (to.isBefore(from)) {
      setError('The end date/time must be after the start date/time.')
      return
    }

    setAppliedRange({
      rangeKey: 'custom',
      customFrom,
      customTo,
    })
  }

  const handleReset = () => {
    setRangeKey('all')
    setCustomFrom('')
    setCustomTo('')
    setError(null)
    setAppliedRange({ rangeKey: 'all' })
  }

  const formatTableDate = (row) => {
    const candidate = row.timestamp || row.sourceDateTime
    if (!candidate) return '--'

    const parsed = dayjs(candidate, ['MM/DD/YYYY HH:mm:ss', 'MM/DD/YYYY HH:mm', 'MM/DD/YYYY'], true)
    return parsed.isValid() ? parsed.format('DD MMM YYYY, h:mm A') : String(candidate)
  }
  const formatCellValue = (value, unit) => {
    if (value == null) return '--'
    return typeof value === 'number' ? `${value} ${unit}` : value
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Reports"
        subtitle="Firestore SensorLogs for the selected range."
        action={
          <Button variant="outlined" startIcon={<PictureAsPdfOutlinedIcon />} disabled>
            Export PDF
          </Button>
        }
      />

      {error && <MuiAlert severity="error">{error}</MuiAlert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
              <Typography variant="h6">Report Range</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={rangeLabel} variant="outlined" />
                <Chip label={`${summary.totalLogs} logs`} color="primary" variant="outlined" />
              </Stack>
            </Stack>

            <Grid container spacing={2} alignItems="end">
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="report-range-label">Range</InputLabel>
                  <Select
                    labelId="report-range-label"
                    value={rangeKey}
                    label="Range"
                    onChange={handleRangeChange}
                  >
                    {REPORT_RANGE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {rangeKey === 'custom' && (
                <>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="datetime-local"
                      label="From"
                      value={customFrom}
                      onChange={(event) => setCustomFrom(event.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      type="datetime-local"
                      label="To"
                      value={customTo}
                      onChange={(event) => setCustomTo(event.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Button variant="contained" fullWidth onClick={handleApplyCustom}>
                      Apply
                    </Button>
                  </Grid>
                </>
              )}

              <Grid item xs={12} md={rangeKey === 'custom' ? 12 : 8}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={handleReset}>
                    Reset
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : rows.length ? (
        <Stack spacing={3}>
          <ReportSummaryCards
            summary={summary}
            rangeLabel={rangeLabel}
            statusLabel={statusLabel}
            statusColor={statusColor}
          />

          <ReportCharts series={report.chartSeries} />

          <Grid container spacing={2} alignItems="stretch">
            <Grid item xs={12}>
              <AISummaryCard
                summaryText={report.aiSummary}
                statusLabel={statusLabel}
                rangeLabel={rangeLabel}
                highlights={alerts}
              />
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                >
                  <Typography variant="h6">Alerts Summary</Typography>
                  <Chip
                    label={alerts.length ? `${alerts.length} alerts` : 'No alerts'}
                    color={alerts.length ? 'warning' : 'success'}
                    variant="outlined"
                  />
                </Stack>

                <Divider />

                {alerts.length ? (
                  <Stack spacing={1.5}>
                    {alerts.map((alert) => (
                      <Stack
                        key={alert.key}
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        justifyContent="space-between"
                        sx={{ p: 1.5, borderRadius: 1, backgroundColor: 'grey.50' }}
                      >
                        <Stack spacing={0.5}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="body2" fontWeight={700}>
                              {alert.label}
                            </Typography>
                            <Chip
                              label={alert.severity === 'critical' ? 'Critical' : 'Warning'}
                              color={alert.severity === 'critical' ? 'error' : 'warning'}
                              size="small"
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {alert.detail}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" fontWeight={700}>
                          {alert.count}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <MuiAlert severity="success">No unsafe values were detected in this range.</MuiAlert>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Sensor Logs</Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 960 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date and Time</TableCell>
                        <TableCell>Temperature</TableCell>
                        <TableCell>Humidity</TableCell>
                        <TableCell>SpO2</TableCell>
                        <TableCell>Heart Rate</TableCell>
                        <TableCell>Noise Level</TableCell>
                        <TableCell>Cry Status</TableCell>
                        <TableCell>Presence Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {formatTableDate(row)}
                            </Typography>
                          </TableCell>
                          <TableCell>{formatCellValue(row.temperature, 'C')}</TableCell>
                          <TableCell>{formatCellValue(row.humidity, '%')}</TableCell>
                          <TableCell>{formatCellValue(row.spo2, '%')}</TableCell>
                          <TableCell>{formatCellValue(row.heartRate, 'bpm')}</TableCell>
                          <TableCell>{formatCellValue(row.noiseLevel, 'dB')}</TableCell>
                          <TableCell>{row.cryStatus || '--'}</TableCell>
                          <TableCell>{row.presenceStatus || '--'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      ) : (
        <MuiAlert severity="info">No SensorLogs data found for this range.</MuiAlert>
      )}
    </Stack>
  )
}

export default Reports
