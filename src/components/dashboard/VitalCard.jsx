import { Card, CardContent, Typography, Box, Chip, Stack } from '@mui/material'

const statusColors = {
  normal: 'success',
  warning: 'warning',
  critical: 'error',
}

function VitalCard({ title, value, unit, status = 'normal', icon, footer, min, max }) {
  const color = statusColors[status] || 'info'

  return (
    <Card
      sx={{
        height: '100%',
        border: status === 'normal' ? '1px solid transparent' : '1px solid',
        borderColor: status === 'normal' ? 'divider' : `${color}.main`,
        backgroundColor: 'background.paper',
      }}
    >
      <CardContent sx={{ height: '100%' }}>
        <Stack spacing={1.5} sx={{ height: '100%' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: status === 'normal' ? 'text.secondary' : `${color}.main`,
                backgroundColor: status === 'normal' ? 'grey.100' : 'rgba(37, 99, 235, 0.08)',
              }}
            >
              {icon}
            </Box>
            <Chip label={status} color={color} size="small" sx={{ textTransform: 'capitalize' }} />
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {value ?? '--'} {unit || ''}
            </Typography>
            {typeof min === 'number' && typeof max === 'number' ? (
              <Typography variant="caption" color="text.secondary">
                Safe range {min} - {max} {unit}
              </Typography>
            ) : (
              footer && (
                <Typography variant="caption" color="text.secondary">
                  {footer}
                </Typography>
              )
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default VitalCard
