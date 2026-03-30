import { Box, Typography, Card, CardContent, Button, Stack } from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'

function Camera() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Live Camera Feed
      </Typography>
      <Card sx={{ minHeight: 320, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CardContent sx={{ textAlign: 'center' }}>
          <VideocamIcon color="disabled" sx={{ fontSize: 64 }} />
          <Typography variant="h6" gutterBottom>
            Camera feed unavailable
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Connect your RTSP/HTTP video stream or upload snapshot URLs from Firebase Storage to show the incubator view.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="contained">Link Stream</Button>
            <Button variant="outlined">Upload Snapshot</Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}

export default Camera
