import { useEffect, useState } from 'react'
import { Stack, Typography, Card, CardContent, Box, Alert } from '@mui/material'
import PageHeader from '../components/common/PageHeader'
import { fetchPresenceStatus } from '../services/detectionService'

// ESP32 STREAM URL (IMPORTANT: use :81/stream)
const CAMERA_STREAM_URL = 'http://192.168.0.109:81/stream'
const DETECTION_POLL_INTERVAL_MS = 3000

function Camera() {
  const [streamError, setStreamError] = useState(false)
  const [presenceData, setPresenceData] = useState(null)
  const [presenceLoading, setPresenceLoading] = useState(true)
  const [presenceError, setPresenceError] = useState(null)

  useEffect(() => {
    let isMounted = true
    let timeoutId
    let controller

    const pollPresence = async (initial = false) => {
      if (!isMounted) return
      if (initial) {
        setPresenceLoading(true)
      }
      controller?.abort()
      controller = new AbortController()

      try {
        const result = await fetchPresenceStatus({ signal: controller.signal })
        if (!isMounted) return
        setPresenceData(result)
        setPresenceError(null)
      } catch (error) {
        if (!isMounted || error.name === 'AbortError') return
        setPresenceError(error.message || 'Unable to reach detection service.')
      } finally {
        if (!isMounted) return
        setPresenceLoading(false)
        timeoutId = window.setTimeout(() => pollPresence(false), DETECTION_POLL_INTERVAL_MS)
      }
    }

    pollPresence(true)

    return () => {
      isMounted = false
      if (timeoutId) window.clearTimeout(timeoutId)
      if (controller) controller.abort()
    }
  }, [])

  const presenceLabel = presenceData
    ? presenceData.present
      ? 'Baby Present'
      : 'Baby Not Detected'
    : presenceLoading
      ? 'Analyzing feed...'
      : 'Status unavailable'

  const confidenceLabel = (() => {
    if (!presenceData || typeof presenceData.confidence !== 'number') return null
    const normalized = presenceData.confidence > 1 ? Math.min(presenceData.confidence, 100) : presenceData.confidence * 100
    return `${Math.round(normalized)}% confidence`
  })()

  const timestampLabel = presenceData?.timestamp
    ? `Updated ${new Date(presenceData.timestamp).toLocaleTimeString()}`
    : null

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
            sx={{
              position: 'relative',
              width: '100%',
              height: '90%',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'black',
            }}
          >
            <Box
              component="img"
              src={CAMERA_STREAM_URL}
              alt="Camera Stream"
              onError={() => setStreamError(true)}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                top: 16,
                left: 16,
                bgcolor: 'rgba(0,0,0,0.6)',
                color: 'common.white',
                px: 2,
                py: 1,
                borderRadius: 1,
                minWidth: 220,
              }}
            >
              <Typography variant="subtitle2" color="common.white">
                Baby Presence
              </Typography>
              <Typography variant="body1" fontWeight={600} color="common.white">
                {presenceLabel}
              </Typography>
              {confidenceLabel && (
                <Typography variant="caption" color="grey.200">
                  {confidenceLabel}
                </Typography>
              )}
              {timestampLabel && (
                <Typography variant="caption" color="grey.200" display="block">
                  {timestampLabel}
                </Typography>
              )}
            </Box>
          </Box>

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

          {presenceError && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {presenceError}
              <br />
              Confirm the Flask detection API is running and that `VITE_DETECTION_API_URL` points to
              it.
            </Alert>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}

export default Camera
