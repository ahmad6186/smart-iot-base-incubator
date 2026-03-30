import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Box,
  Stack,
} from '@mui/material'
import dayjs from 'dayjs'

const severityColors = {
  normal: 'success',
  info: 'info',
  warning: 'warning',
  critical: 'error',
}

function AlertsPanel({ alerts = [] }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Latest Alerts</Typography>
          <Chip label={`${alerts.length} alerts`} color="primary" variant="outlined" size="small" />
        </Box>
        {alerts.length ? (
          <List>
            {alerts.slice(0, 5).map((alert) => (
              <ListItem
                key={alert.id}
                sx={{
                  mb: 1,
                  borderRadius: 2,
                  backgroundColor: 'action.hover',
                }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {alert.type}
                      </Typography>
                      <Chip
                        size="small"
                        label={alert.severity}
                        color={severityColors[alert.severity] || 'warning'}
                      />
                      {alert.resolved && (
                        <Chip size="small" label="Resolved" color="success" variant="outlined" />
                      )}
                    </Stack>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" color="text.secondary">
                        {alert.message}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {alert.createdAt
                          ? dayjs(alert.createdAt).format('MMM D, HH:mm')
                          : 'Timestamp unavailable'}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No alerts in the last 24 hours.
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export default AlertsPanel
