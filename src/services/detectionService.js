const DEFAULT_API_BASE = 'http://localhost:5000'

const stripTrailingSlash = (value) => value.replace(/\/+$/, '')

const detectionApiBase =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_DETECTION_API_URL
    ? stripTrailingSlash(import.meta.env.VITE_DETECTION_API_URL)
    : DEFAULT_API_BASE

/**
 * Fetch the latest presence inference from the Flask/OpenCV service.
 *
 * Expected response shape:
 * {
 *   present: boolean,
 *   confidence: number (0-1 or 0-100),
 *   timestamp: string (ISO 8601) | number (epoch ms)
 * }
 */
export const fetchPresenceStatus = async ({ signal } = {}) => {
  const response = await fetch(`${detectionApiBase}/api/presence`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    const message = `Detection API error (${response.status})`
    throw new Error(message)
  }

  const payload = await response.json()
  return normalizePresencePayload(payload)
}

const normalizePresencePayload = (payload = {}) => {
  const { present = false, confidence = null, timestamp = null } = payload

  let normalizedTimestamp = null
  if (timestamp) {
    normalizedTimestamp =
      typeof timestamp === 'number'
        ? new Date(timestamp).toISOString()
        : new Date(timestamp).toISOString()
  }

  return {
    present: Boolean(present),
    confidence: typeof confidence === 'number' ? confidence : null,
    timestamp: normalizedTimestamp || new Date().toISOString(),
    raw: payload,
  }
}

export default {
  fetchPresenceStatus,
}
