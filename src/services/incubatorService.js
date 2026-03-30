import {
  getDocument,
  subscribeToDocument,
  subscribeToCollection,
  getDocuments,
  setDocument,
} from '../firebase/firestore'

/**
 * Incubator data-access layer.
 *
 * This module is the single place where the UI talks to Firestore for incubator-related
 * data. Keeping the Firestore "shape" here makes pages/components simpler and lets you
 * change document paths without touching UI code.
 *
 * Firestore layout used by this app:
 * - `incubator/liveData`     : latest telemetry snapshot (temperature, humidity, etc.)
 * - `incubator/actuators`    : current actuator states (heater/fan/humidifier/buzzer/light)
 * - `incubator/settings`     : setpoints + safe ranges + notification preferences
 * - `incubator/alerts`       : optional "batched" alerts document { entries: [...] }
 * - `incubator/reports`      : optional "batched" reports document { entries: [...] }
 * - `incubator_alerts/*`     : optional per-alert documents (stream-friendly)
 * - `incubator_reports/*`    : optional per-report documents (stream-friendly)
 */
const COLLECTION = 'incubator'
const ALERT_COLLECTIONS = ['incubator_alerts', 'alerts']
const REPORT_COLLECTIONS = ['incubator_reports', 'reports']

/**
 * Real-time telemetry subscription.
 * The UI expects trend arrays to always exist (even when empty), so we normalize here.
 */
export const subscribeToLiveData = (callback) => {
  return subscribeToDocument(COLLECTION, 'liveData', (doc, error) => {
    if (error || !doc) {
      callback({ data: null, error })
      return
    }
    callback({ data: normalizeLiveData(doc), error: null })
  })
}

/**
 * One-shot telemetry fetch (useful for non-reactive screens or initial hydration).
 */
export const fetchLiveDataOnce = async () => {
  const result = await getDocument(COLLECTION, 'liveData')
  if (result.success && result.data) {
    return { success: true, data: normalizeLiveData(result.data) }
  }
  return { success: true, data: null }
}

/**
 * Real-time actuator state subscription.
 * The dashboard toggles rely on this document to reflect device/controller state.
 */
export const subscribeToActuators = (callback) => {
  return subscribeToDocument(COLLECTION, 'actuators', (doc, error) => {
    if (error || !doc) {
      callback(null)
      return
    }
    callback(doc)
  })
}

/**
 * Update a single actuator field (merge write).
 * Example: updateActuator('heater', true)
 */
export const updateActuator = async (name, value) => {
  return setDocument(COLLECTION, 'actuators', { [name]: value }, true)
}

/**
 * Update operating mode (stored on `incubator/liveData` for convenience).
 */
export const updateMode = async (mode) => {
  return setDocument(COLLECTION, 'liveData', { mode }, true)
}

/**
 * Update settings/setpoints (merge write).
 * Used by both the dashboard setpoint widgets and the Settings page.
 */
export const updateSetpoints = async (setpoints) => {
  return setDocument(COLLECTION, 'settings', setpoints, true)
}

/**
 * Real-time settings subscription.
 */
export const subscribeToSettings = (callback) => {
  return subscribeToDocument(COLLECTION, 'settings', (doc, error) => {
    if (error || !doc) {
      callback(null)
      return
    }
    callback(doc)
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
  let alerts = []
  const docResult = await getDocument(COLLECTION, 'alerts')
  if (docResult.success && docResult.data?.entries) {
    alerts = docResult.data.entries
  }
  if (!alerts.length) {
    for (const collectionName of ALERT_COLLECTIONS) {
      const collectionResult = await getDocuments(collectionName)
      if (collectionResult.success && collectionResult.data?.length) {
        alerts = collectionResult.data
        break
      }
    }
  }

  return alerts
}

/**
 * Real-time alert feed.
 *
 * Subscribes to BOTH possible sources and forwards whichever emits latest.
 * This supports different backend pipelines without changing the UI.
 */
export const subscribeToAlerts = (callback) => {
  const unsubscribes = []

  ALERT_COLLECTIONS.forEach((collectionName) => {
    unsubscribes.push(
      subscribeToCollection(collectionName, (docs, error) => {
        if (error) {
          callback([], error)
          return
        }
        if (docs?.length) {
          callback(docs)
        }
      })
    )
  })

  unsubscribes.push(
    subscribeToDocument(COLLECTION, 'alerts', (doc) => {
      if (doc?.entries?.length) {
        callback(doc.entries)
      } else {
        callback([])
      }
    })
  )

  return () => {
    unsubscribes.forEach((unsubscribe) => {
      if (typeof unsubscribe === 'function') unsubscribe()
    })
  }
}

/**
 * Reports can be stored as:
 * - A single batched doc `incubator/reports` with `entries: []`
 * - Many documents in `incubator_reports/*`
 *
 * This function prefers the batched doc and falls back to the collection.
 */
export const fetchReports = async () => {
  const docResult = await getDocument(COLLECTION, 'reports')
  if (docResult.success && docResult.data?.entries?.length) {
    return docResult.data.entries
  }
  for (const collectionName of REPORT_COLLECTIONS) {
    const collectionResult = await getDocuments(collectionName)
    if (collectionResult.success && collectionResult.data?.length) {
      return collectionResult.data
    }
  }
  return []
}

/**
 * Ensures liveData always contains the arrays used by charts.
 * Without this, charts may crash or show inconsistent state when fields are missing.
 */
const normalizeLiveData = (data) => {
  return {
    ...data,
    temperatureTrend: data.temperatureTrend || [],
    humidityTrend: data.humidityTrend || [],
    spo2Trend: data.spo2Trend || [],
    heartRateTrend: data.heartRateTrend || [],
  }
}
