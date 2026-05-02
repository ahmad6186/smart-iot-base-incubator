import { useEffect, useState } from 'react'
import { subscribeToIncubatorSnapshot } from '../services/incubatorService'

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
    return subscribeToIncubatorSnapshot(({ data, error }) => {
      setState((prev) => ({
        ...prev,
        liveData: data?.liveData || null,
        actuators: data?.actuators || null,
        settings: data?.settings || null,
        alerts: data?.alerts || [],
        error: error || null,
        loading: false,
      }))
    })
  }, [])

  return state
}

export default useIncubatorData
