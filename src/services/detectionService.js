import { apiRequest } from './apiClient'

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
  const response = await apiRequest('/api/presence', { signal })
  return normalizePresencePayload(response?.data)
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
