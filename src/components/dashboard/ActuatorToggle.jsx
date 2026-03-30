import { Card, CardContent, Typography, Switch, Stack, Chip } from '@mui/material'

function ActuatorToggle({ label, value, onChange, description, disabled = false }) {
  const hasValue = value === true || value === false
  const chipLabel = hasValue ? (value ? 'Enabled' : 'Disabled') : 'Unknown'
  const chipColor = hasValue ? (value ? 'success' : 'default') : 'warning'

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {label}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={chipLabel}
              color={chipColor}
              variant="outlined"
              size="small"
            />
            <Switch
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default ActuatorToggle
