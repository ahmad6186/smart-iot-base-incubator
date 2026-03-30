import { Stack, Typography, Card, CardContent, Button } from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import PageHeader from '../components/common/PageHeader'

function Camera() {
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Live Camera Feed"
        subtitle="Connect your incubator’s RTSP/HTTP stream or upload periodic snapshots."
      />
      <Card sx={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    </Stack>
  )
}

export default Camera
