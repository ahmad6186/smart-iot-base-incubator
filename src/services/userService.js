import { apiRequest, asResult } from './apiClient'

export const getCurrentUserProfile = async () => {
  return asResult(() => apiRequest('/api/users/me'))
}

export const ensureCurrentUserProfile = async () => {
  return asResult(() => apiRequest('/api/users/me', { method: 'POST' }))
}

export const fetchUsers = async () => {
  return asResult(() => apiRequest('/api/users'))
}

export const createUserAsAdmin = async ({ email, password, displayName, role = 'Parent' }) => {
  return asResult(() =>
    apiRequest('/api/users', {
      method: 'POST',
      body: { email, password, displayName, role },
    })
  )
}

export const updateUserRole = async (uid, role) => {
  return asResult(() =>
    apiRequest(`/api/users/${encodeURIComponent(uid)}/role`, {
      method: 'PATCH',
      body: { role },
    })
  )
}

export default {
  getCurrentUserProfile,
  ensureCurrentUserProfile,
  fetchUsers,
  createUserAsAdmin,
  updateUserRole,
}
