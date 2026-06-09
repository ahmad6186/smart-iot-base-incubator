import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import Alerts from './pages/Alerts'
import Reports from './pages/Reports'
import Camera from './pages/Camera'
import { onAuthChange } from './firebase/auth'
import { getCurrentUserProfile } from './services/userService'
import { Box, CircularProgress } from '@mui/material'
import DashboardLayout from './components/layout/DashboardLayout'
import { AuthProvider } from './context/AuthContext'
import UserManagement from './pages/UserManagement'

function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      setLoading(true)
      setUser(currentUser)

      if (currentUser) {
        const profileResult = await getCurrentUserProfile()
        if (profileResult.success) {
          setProfile(profileResult.data)
        } else {
          console.error('Failed to load user profile:', profileResult.error)
          setProfile(null)
        }
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const isAdmin = profile?.role?.toLowerCase() === 'admin'

  const authContextValue = useMemo(
    () => ({
      user,
      profile,
      isAdmin,
      loading,
    }),
    [user, profile, loading, isAdmin]
  )

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <CircularProgress sx={{ color: 'white' }} />
      </Box>
    )
  }

  const protectedElement = user ? (
    <DashboardLayout user={user} profile={profile} />
  ) : (
    <Navigate to="/login" replace />
  )

  return (
    <AuthProvider value={authContextValue}>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/home" replace />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/" element={protectedElement}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="dashboard" element={<Home />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="reports" element={<Reports />} />
          <Route
            path="users"
            element={isAdmin ? <UserManagement /> : <Navigate to="/home" replace />}
          />
          <Route path="camera" element={<Camera />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? '/home' : '/login'} replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
