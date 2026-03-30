import { Card, CardContent, Typography, Box, Chip, LinearProgress } from '@mui/material'

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
        borderRadius: 4,
        background: 'linear-gradient(180deg, rgba(99,102,241,0.04) 0%, rgba(255,255,255,0.9) 100%)',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Chip label={status} color={color} size="small" sx={{ textTransform: 'capitalize' }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 2 }}>
          <Typography variant="h3" component="span" sx={{ fontWeight: 700 }}>
            {value ?? '--'}
          </Typography>
          {unit && (
            <Typography variant="h6" component="span" color="text.secondary">
              {unit}
            </Typography>
          )}
        </Box>
        {icon && (
          <Box sx={{ mt: 2, color: (theme) => theme.palette.primary.main }}>
            {icon}
          </Box>
        )}
        {typeof min === 'number' && typeof max === 'number' && typeof value === 'number' && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              color={color}
              value={Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))}
            />
            <Typography variant="caption" color="text.secondary">
              Safe range: {min} - {max} {unit}
            </Typography>
          </Box>
        )}
        {footer && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {footer}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export default VitalCard
