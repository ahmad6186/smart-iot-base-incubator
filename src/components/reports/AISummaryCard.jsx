import { Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'

const STATUS_COLORS = {
  Good: 'success',
  Warning: 'warning',
  Critical: 'error',
}

function AISummaryCard({ summaryText, statusLabel, rangeLabel, highlights = [] }) {
  return (
    <Card
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'primary.light',
        background:
          'linear-gradient(180deg, rgba(239, 246, 255, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <SmartToyOutlinedIcon color="primary" />
              <Typography variant="h6">Summary</Typography>
            </Stack>
            <Chip label={statusLabel} color={STATUS_COLORS[statusLabel] || 'default'} />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {rangeLabel}
          </Typography>

          <Typography variant="body1" sx={{ lineHeight: 1.75 }}>
            {summaryText}
          </Typography>

          {highlights.length > 0 && (
            <>
              <Divider />
              <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Key findings
                </Typography>
                {highlights.map((item) => (
                  <Stack
                    key={item.key}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="body2">{item.label}</Typography>
                    <Chip
                      label={`${item.count}`}
                      color={item.severity === 'critical' ? 'error' : 'warning'}
                      size="small"
                    />
                  </Stack>
                ))}
              </Stack>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

export default AISummaryCard
