import { Card, CardContent, Typography, Chip, Stack } from '@mui/material'
import { panelSx } from '../common/surfaceStyles'

function AiFeatureCard({ title, description, status, insight }) {
  return (
    <Card sx={panelSx}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6">{title}</Typography>
            <Chip label={status || 'Active'} color="secondary" size="small" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          {insight && (
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
              {insight}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

export default AiFeatureCard
