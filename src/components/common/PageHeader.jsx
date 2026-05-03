import { Box, Typography, Stack, Chip } from '@mui/material'

function PageHeader({ title, subtitle, action, eyebrow }) {
  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        boxShadow: '0 16px 32px rgba(15, 23, 42, 0.04)',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
      >
        <Stack spacing={1}>
          {eyebrow && <Chip label={eyebrow} color="primary" variant="outlined" size="small" sx={{ width: 'fit-content' }} />}
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Stack>
        {action}
      </Stack>
    </Box>
  )
}

export default PageHeader
