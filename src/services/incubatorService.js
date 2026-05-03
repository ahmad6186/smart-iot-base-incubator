import { apiRequest, asResult } from './apiClient'

/**
 * Incubator data-access layer.
 *
 * This module is the single place where the UI talks to the backend for incubator-related
 * data. Keeping the backend response shape here keeps pages/components simple.
 *
 * Backend Firestore layout used by this app:
 * - `incubator/liveData`     : latest telemetry snapshot (temperature, humidity, etc.)
 * - `incubator/actuators`    : current actuator states (heater/fan/humidifier/buzzer/light)
 * - `incubator/settings`     : setpoints + safe ranges + notification preferences
 * - `incubator/alerts`       : optional "batched" alerts document { entries: [...] }
 * - `SensorLogs`             : time-series sensor log collection used for reports
 * - `incubator_alerts/*`     : optional per-alert documents (stream-friendly)
 * - `incubator_reports/*`    : optional per-report documents (stream-friendly)
 */
const POLL_INTERVAL_MS = Number(import.meta.env?.VITE_INCUBATOR_POLL_INTERVAL_MS || 3000)

/**
 * Real-time telemetry subscription.
 * The UI expects trend arrays to always exist (even when empty), so we normalize here.
 */
export const subscribeToIncubatorSnapshot = (callback) => {
  let isActive = true
  let timeoutId
  let controller

  const poll = async () => {
    if (!isActive) return
    controller?.abort()
    controller = new AbortController()

    try {
      const response = await apiRequest('/api/incubator/snapshot', {
        signal: controller.signal,
      })
      if (!isActive) return
      callback({ data: normalizeSnapshot(response?.data), error: null })
    } catch (error) {
      if (!isActive || error.name === 'AbortError') return
      callback({ data: null, error: error.message })
    } finally {
      if (isActive) {
        timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS)
      }
    }
  }

  poll()

  return () => {
    isActive = false
    if (timeoutId) window.clearTimeout(timeoutId)
    controller?.abort()
  }
}

/**
 * One-shot telemetry fetch (useful for non-reactive screens or initial hydration).
 */
export const fetchLiveDataOnce = async () => {
  return asResult(async () => {
    const response = await apiRequest('/api/incubator/live-data')
    return { data: response?.data ? normalizeLiveData(response.data) : null }
  })
}

/**
 * Real-time actuator state subscription.
 * The dashboard toggles rely on this document to reflect device/controller state.
 */
export const subscribeToActuators = (callback) => {
  return pollEndpoint('/api/incubator/actuators', (data, error) => {
    callback(error ? null : data)
  })
}

/**
 * Update a single actuator field (merge write).
 * Example: updateActuator('heater', true)
 */
export const updateActuator = async (name, value) => {
  return asResult(() =>
    apiRequest('/api/incubator/actuators', {
      method: 'PATCH',
      body: { [name]: value },
    })
  )
}

/**
 * Update operating mode (stored on `incubator/liveData` for convenience).
 */
export const updateMode = async (mode) => {
  return asResult(() =>
    apiRequest('/api/incubator/live-data', {
      method: 'PATCH',
      body: { mode },
    })
  )
}

/**
 * Update settings/setpoints (merge write).
 * Used by both the dashboard setpoint widgets and the Settings page.
 */
export const updateSetpoints = async (setpoints) => {
  return asResult(() =>
    apiRequest('/api/incubator/settings', {
      method: 'PATCH',
      body: setpoints,
    })
  )
}

/**
 * Real-time settings subscription.
 */
export const subscribeToSettings = (callback) => {
  return pollEndpoint('/api/incubator/settings', (data, error) => {
    callback(error ? null : data)
  })
}

/**
 * Alerts can be stored in two ways:
 * - As a single batched doc `incubator/alerts` with `entries: []`
 * - As many documents in `incubator_alerts/*`
 *
 * This function prefers the batched doc (when present) and falls back to the collection.
 */
export const fetchAlerts = async () => {
  const response = await apiRequest('/api/incubator/alerts')
  return response?.data || []
}

/**
 * Real-time alert feed.
 *
 * Subscribes to BOTH possible sources and forwards whichever emits latest.
 * This supports different backend pipelines without changing the UI.
 */
export const subscribeToAlerts = (callback) => {
  return pollEndpoint('/api/incubator/alerts', (data, error) => {
    callback(error ? [] : data || [], error)
  })
}

/**
 * Fetch SensorLogs rows for a user-selected date/time range.
 */
export const fetchReports = async ({ from, to } = {}) => {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const query = params.toString()
  const response = await apiRequest(`/api/incubator/reports${query ? `?${query}` : ''}`)
  return response?.data || null
}

/**
 * Ensures liveData always contains the arrays used by charts.
 * Without this, charts may crash or show inconsistent state when fields are missing.
 */
const normalizeLiveData = (data) => {
  if (!data) return null
  return {
    ...data,
    temperatureTrend: data.temperatureTrend || [],
    humidityTrend: data.humidityTrend || [],
    spo2Trend: data.spo2Trend || [],
    heartRateTrend: data.heartRateTrend || [],
  }
}

const normalizeSnapshot = (snapshot = {}) => {
  return {
    ...snapshot,
    liveData: normalizeLiveData(snapshot.liveData),
    alerts: snapshot.alerts || [],
  }
}

const pollEndpoint = (path, callback) => {
  let isActive = true
  let timeoutId
  let controller

  const poll = async () => {
    if (!isActive) return
    controller?.abort()
    controller = new AbortController()

    try {
      const response = await apiRequest(path, { signal: controller.signal })
      if (!isActive) return
      callback(response?.data, null)
    } catch (error) {
      if (!isActive || error.name === 'AbortError') return
      callback(null, error.message)
    } finally {
      if (isActive) {
        timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS)
      }
    }
  }

  poll()

  return () => {
    isActive = false
    if (timeoutId) window.clearTimeout(timeoutId)
    controller?.abort()
  }
}
