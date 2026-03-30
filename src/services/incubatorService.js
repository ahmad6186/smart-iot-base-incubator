import {
  getDocument,
  subscribeToDocument,
  subscribeToCollection,
  getDocuments,
  setDocument,
} from '../firebase/firestore'

const COLLECTION = 'incubator'
const ALERTS_COLLECTION = 'incubator_alerts'
const REPORTS_COLLECTION = 'incubator_reports'

export const subscribeToLiveData = (callback) => {
  return subscribeToDocument(COLLECTION, 'liveData', (doc, error) => {
    if (error || !doc) {
      callback({ data: null, error })
      return
    }
    callback({ data: normalizeLiveData(doc), error: null })
  })
}

export const fetchLiveDataOnce = async () => {
  const result = await getDocument(COLLECTION, 'liveData')
  if (result.success && result.data) {
    return { success: true, data: normalizeLiveData(result.data) }
  }
  return { success: true, data: null }
}

export const subscribeToActuators = (callback) => {
  return subscribeToDocument(COLLECTION, 'actuators', (doc, error) => {
    if (error || !doc) {
      callback(null)
      return
    }
    callback(doc)
  })
}

export const updateActuator = async (name, value) => {
  return setDocument(COLLECTION, 'actuators', { [name]: value }, true)
}

export const updateMode = async (mode) => {
  return setDocument(COLLECTION, 'liveData', { mode }, true)
}

export const updateSetpoints = async (setpoints) => {
  return setDocument(COLLECTION, 'settings', setpoints, true)
}

export const subscribeToSettings = (callback) => {
  return subscribeToDocument(COLLECTION, 'settings', (doc, error) => {
    if (error || !doc) {
      callback(null)
      return
    }
    callback(doc)
  })
}

export const fetchAlerts = async () => {
  let alerts = []
  const docResult = await getDocument(COLLECTION, 'alerts')
  if (docResult.success && docResult.data?.entries) {
    alerts = docResult.data.entries
  }
  if (!alerts.length) {
    const collectionResult = await getDocuments(ALERTS_COLLECTION)
    if (collectionResult.success && collectionResult.data?.length) {
      alerts = collectionResult.data
    }
  }

  return alerts
}

export const subscribeToAlerts = (callback) => {
  const unsubscribes = []

  unsubscribes.push(
    subscribeToCollection(ALERTS_COLLECTION, (docs, error) => {
      if (error) {
        callback([], error)
        return
      }
      callback(docs || [])
    })
  )

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

export const fetchReports = async () => {
  const docResult = await getDocument(COLLECTION, 'reports')
  if (docResult.success && docResult.data?.entries?.length) {
    return docResult.data.entries
  }
  const collectionResult = await getDocuments(REPORTS_COLLECTION)
  if (collectionResult.success && collectionResult.data?.length) {
    return collectionResult.data
  }
  return []
}

const normalizeLiveData = (data) => {
  return {
    ...data,
    temperatureTrend: data.temperatureTrend || [],
    humidityTrend: data.humidityTrend || [],
    spo2Trend: data.spo2Trend || [],
    heartRateTrend: data.heartRateTrend || [],
  }
}
