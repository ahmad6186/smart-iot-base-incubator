import { auth } from '../firebase/config'

const DEFAULT_API_BASE = 'http://localhost:8000'

const stripTrailingSlash = (value) => value.replace(/\/+$/, '')

export const apiBase =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_API_URL
    ? stripTrailingSlash(import.meta.env.VITE_BACKEND_API_URL)
    : DEFAULT_API_BASE

export const apiRequest = async (
  path,
  { method = 'GET', body, signal, authRequired = true, headers = {} } = {}
) => {
  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  }

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json'
  }

  if (authRequired) {
    const user = auth.currentUser
    if (!user) {
      throw new Error('You must be signed in to continue.')
    }
    requestHeaders.Authorization = `Bearer ${await user.getIdToken()}`
  }

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    throw new Error(payload?.error || `Backend API error (${response.status})`)
  }

  return payload
}

export const asResult = async (operation) => {
  try {
    const response = await operation()
    return { success: true, data: response?.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export default {
  apiBase,
  apiRequest,
  asResult,
}
