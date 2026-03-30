import { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import LogoutIcon from '@mui/icons-material/Logout'
import DashboardIcon from '@mui/icons-material/Dashboard'
import InsightsIcon from '@mui/icons-material/Insights'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import AssessmentIcon from '@mui/icons-material/Assessment'
import SettingsIcon from '@mui/icons-material/Settings'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import InfoIcon from '@mui/icons-material/Info'
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects'
import { logOut } from '../../firebase/auth'

const drawerWidth = 260

const navItems = [
  { label: 'Dashboard', path: '/home', icon: <DashboardIcon /> },
  { label: 'Features', path: '/features', icon: <EmojiObjectsIcon /> },
  { label: 'Alerts', path: '/alerts', icon: <NotificationsActiveIcon /> },
  { label: 'Reports', path: '/reports', icon: <AssessmentIcon /> },
  { label: 'Settings', path: '/settings', icon: <SettingsIcon /> },
  { label: 'Camera', path: '/camera', icon: <CameraAltIcon /> },
  { label: 'About', path: '/about', icon: <InfoIcon /> },
]

function DashboardLayout({ user }) {
  const theme = useTheme()
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  const handleDrawerToggle = () => {
    setMobileOpen(prev => !prev)
  }

  const handleLogout = async () => {
    await logOut()
    navigate('/login')
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Smart NICU
        </Typography>
        <Typography variant="body2" color="text.secondary">
          IoT Infant Incubator
        </Typography>
      </Box>
      <Divider />
      <List sx={{ flexGrow: 1, py: 2 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            sx={{
              borderRadius: 2,
              mx: 2,
              mb: 1,
              '&.active': {
                background: theme.palette.action.selected,
              },
            }}
            onClick={() => {
              if (isMdDown) handleDrawerToggle()
            }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
          {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {user?.displayName || user?.email}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            NICU Specialist
          </Typography>
        </Box>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          boxShadow: '0 12px 30px rgba(99, 102, 241, 0.25)',
        }}
      >
        <Toolbar>
          {isMdDown && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Smart IoT-Based Infant Incubator
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Real-time neonatal monitoring with AI assistance
            </Typography>
          </Box>
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMdDown ? 'temporary' : 'permanent'}
          open={isMdDown ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: 'none',
              backgroundColor: 'background.paper',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 4 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: { xs: 8, md: 0 },
        }}
      >
        <Toolbar sx={{ display: { xs: 'block', md: 'none' } }} />
        <Outlet />
      </Box>
    </Box>
  )
}

export default DashboardLayout
