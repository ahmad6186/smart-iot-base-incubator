import { useState } from 'react'
import { Stack, Typography, Card, CardContent, Box, Alert } from '@mui/material'
import PageHeader from '../components/common/PageHeader'

// ESP32 STREAM URL (IMPORTANT: use :81/stream)
const CAMERA_STREAM_URL = 'http://192.168.0.109:81/stream'

function Camera() {
  const [streamError, setStreamError] = useState(false)

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Live Camera Feed"
        subtitle="Live stream coming directly from the incubator camera."
      />

      <Card sx={{ height: '80vh' }}>
        <CardContent sx={{ height: '100%' }}>
          <Typography variant="subtitle1" gutterBottom>
            Streaming from {CAMERA_STREAM_URL}
          </Typography>

          {/* VIDEO STREAM */}
          <Box
            component="img"
            src={CAMERA_STREAM_URL}
            alt="Camera Stream"
            onError={() => setStreamError(true)}
            sx={{
              width: '100%',
              height: '90%',
              objectFit: 'cover',
              borderRadius: 2,
              bgcolor: 'black',
            }}
          />

          {/* ERROR MESSAGE */}
          {streamError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              Unable to load the camera stream. Make sure:
              <br />• ESP32 is ON  
              <br />• Same WiFi network  
              <br />• Stream URL is correct  
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              If the stream does not appear, try opening it directly:
              <br />
              <a href={CAMERA_STREAM_URL} target="_blank" rel="noreferrer">
                Open Stream
              </a>
            </Typography>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}

export default Camera