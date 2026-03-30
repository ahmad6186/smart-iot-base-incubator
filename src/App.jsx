import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Features from './pages/Features'
import Alerts from './pages/Alerts'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Camera from './pages/Camera'
import About from './pages/About'
import { onAuthChange } from './firebase/auth'
import { Box, CircularProgress } from '@mui/material'
import DashboardLayout from './components/layout/DashboardLayout'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

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

  const protectedElement = user ? <DashboardLayout user={user} /> : <Navigate to="/login" replace />

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/home" replace />} />
      <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/home" replace />} />
      <Route path="/" element={protectedElement}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="dashboard" element={<Home />} />
        <Route path="features" element={<Features />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="camera" element={<Camera />} />
        <Route path="about" element={<About />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/home' : '/login'} replace />} />
    </Routes>
  )
}

export default App
