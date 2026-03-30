import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Stack,
  Switch,
  FormControlLabel,
  Divider,
  TextField,
  Button,
  Alert,
} from '@mui/material'
import dayjs from 'dayjs'
import useIncubatorData from '../hooks/useIncubatorData'
import { updateSetpoints } from '../services/incubatorService'
import { getCurrentUser } from '../firebase/auth'

function Settings() {
  const { settings } = useIncubatorData()
  const user = getCurrentUser()
  const [notifications, setNotifications] = useState(settings?.notificationPreferences || {})
  const [message, setMessage] = useState(null)
  const [safeRanges, setSafeRanges] = useState(settings?.safeRanges || {})
  const [autoModeEnabled, setAutoModeEnabled] = useState(settings?.autoModeEnabled ?? true)

  useEffect(() => {
    setNotifications(settings?.notificationPreferences || {})
    setSafeRanges(settings?.safeRanges || {})
    setAutoModeEnabled(settings?.autoModeEnabled ?? true)
  }, [settings])

  const handleNotificationChange = (key) => (event) => {
    setNotifications((prev) => ({ ...prev, [key]: event.target.checked }))
  }

  const handleRangeChange = (key, bound, value) => {
    setSafeRanges((prev) => ({
      ...prev,
      [key]: [
        bound === 0 ? Number(value) : Number(prev[key]?.[0] ?? value),
        bound === 1 ? Number(value) : Number(prev[key]?.[1] ?? value),
      ],
    }))
  }

  const handleSave = async () => {
    const payload = {
      notificationPreferences: notifications,
      safeRanges,
      autoModeEnabled,
    }
    const result = await updateSetpoints(payload)
    setMessage(result.success ? 'Settings updated.' : result.error)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Settings & Preferences
      </Typography>
      {message && <Alert severity="info">{message}</Alert>}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack spacing={2} alignItems="center">
                <Avatar sx={{ width: 80, height: 80 }}>
                  {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                </Avatar>
                <Typography variant="h6">{user?.displayName || user?.email}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Lead Researcher
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last login: {dayjs(user?.metadata?.lastSignInTime).format('MMM D, HH:mm')}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notification Preferences
              </Typography>
              {['email', 'sms', 'push'].map((type) => (
                <FormControlLabel
                  key={type}
                  control={
                    <Switch
                      checked={Boolean(notifications[type])}
                      onChange={handleNotificationChange(type)}
                    />
                  }
                  label={`Notify via ${type.toUpperCase()}`}
                />
              ))}
              <Divider sx={{ my: 2 }} />
              <FormControlLabel
                control={
                  <Switch
                    checked={autoModeEnabled}
                    onChange={(e) => setAutoModeEnabled(e.target.checked)}
                  />
                }
                label="Enable Adaptive Auto Mode"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Thresholds
              </Typography>
              {Object.keys(safeRanges).map((key) => (
                <Stack key={key} spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                    {key}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="Min"
                      type="number"
                      value={safeRanges[key]?.[0] ?? ''}
                      onChange={(e) => handleRangeChange(key, 0, e.target.value)}
                      size="small"
                    />
                    <TextField
                      label="Max"
                      type="number"
                      value={safeRanges[key]?.[1] ?? ''}
                      onChange={(e) => handleRangeChange(key, 1, e.target.value)}
                      size="small"
                    />
                  </Stack>
                </Stack>
              ))}
              <Button variant="contained" onClick={handleSave}>
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default Settings
