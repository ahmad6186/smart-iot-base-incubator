import { useEffect, useState } from 'react'
import {
  subscribeToLiveData,
  subscribeToActuators,
  subscribeToSettings,
  subscribeToAlerts,
} from '../services/incubatorService'

const initialState = {
  liveData: null,
  actuators: null,
  settings: null,
  alerts: [],
  loading: true,
  error: null,
}

function useIncubatorData() {
  const [state, setState] = useState(initialState)

  useEffect(() => {
    const unsubscribes = []

    unsubscribes.push(
      subscribeToLiveData(({ data, error }) => {
        setState((prev) => ({
          ...prev,
          liveData: data,
          error: error || prev.error,
          loading: false,
        }))
      })
    )

    unsubscribes.push(
      subscribeToActuators((data) => {
        setState((prev) => ({
          ...prev,
          actuators: data,
        }))
      })
    )

    unsubscribes.push(
      subscribeToSettings((data) => {
        setState((prev) => ({
          ...prev,
          settings: data,
        }))
      })
    )

    unsubscribes.push(
      subscribeToAlerts((data) => {
        setState((prev) => ({
          ...prev,
          alerts: data || [],
        }))
      })
    )

    return () => {
      unsubscribes.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') unsubscribe()
      })
    }
  }, [])

  return state
}

export default useIncubatorData
