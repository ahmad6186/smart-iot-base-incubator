import { useState } from 'react'
import { Stack, Typography, Card, CardContent, Box, Alert } from '@mui/material'
import PageHeader from '../components/common/PageHeader'

const CAMERA_STREAM_URL = 'http://192.168.100.21'

function Camera() {
  const [streamError, setStreamError] = useState(false)

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Live Camera Feed"
        subtitle="Live stream coming directly from the incubator camera."
      />
      <Card>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Streaming from {CAMERA_STREAM_URL}
          </Typography>
          <Box
            component="iframe"
            src={CAMERA_STREAM_URL}
            title="Incubator live stream"
            loading="lazy"
            sx={{
              width: '100%',
              minHeight: 560,
              border: 0,
              borderRadius: 1,
              bgcolor: 'grey.900',
            }}
            onError={() => setStreamError(true)}
          />
          {streamError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              Unable to load the camera stream. Ensure the browser is on the same network and that the camera allows
              cross-origin access over HTTP.
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              If you do not see the feed, confirm the camera is reachable from this device or open{' '}
              <a href={CAMERA_STREAM_URL} target="_blank" rel="noreferrer">
                the stream in a new tab
              </a>
              .
            </Typography>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}

export default Camera
