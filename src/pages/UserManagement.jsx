import { useEffect, useState } from 'react'
import {
  Stack,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import PageHeader from '../components/common/PageHeader'
import { createUserAsAdmin } from '../firebase/auth'
import { getDocuments, setUserRole } from '../firebase/firestore'

const roleOptions = [
  { label: 'Parent (monitor only)', value: 'Parent' },
  { label: 'Admin (full control)', value: 'Admin' },
]

const initialFormState = {
  name: '',
  email: '',
  password: '',
  role: 'Parent',
}

function UserManagement() {
  const [form, setForm] = useState(initialFormState)
  const [formLoading, setFormLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [roleUpdating, setRoleUpdating] = useState(null)

  const loadUsers = async () => {
    setUsersLoading(true)
    const result = await getDocuments('users')
    if (result.success) {
      setUsers(result.data)
    } else {
      setStatus({ type: 'error', message: result.error || 'Failed to load users.' })
    }
    setUsersLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleFormChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    if (status?.type !== 'info') {
      setStatus(null)
    }
  }

  const handleCreateUser = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setStatus(null)

    const result = await createUserAsAdmin({
      email: form.email,
      password: form.password,
      displayName: form.name,
      role: form.role,
    })

    if (result.success) {
      setStatus({
        type: 'success',
        message: 'User created successfully. Share the credentials securely with the parent.',
      })
      setForm(initialFormState)
      await loadUsers()
    } else {
      setStatus({
        type: 'error',
        message: result.error || 'Could not create the user. Please try again.',
      })
    }

    setFormLoading(false)
  }

  const handleRoleChange = async (uid, newRole) => {
    setRoleUpdating(uid)
    const result = await setUserRole(uid, newRole)
    if (result.success) {
      setUsers((prev) => prev.map((user) => (user.id === uid ? { ...user, role: newRole } : user)))
      setStatus({ type: 'info', message: 'Role updated.' })
    } else {
      setStatus({
        type: 'error',
        message: result.error || 'Failed to update role.',
      })
    }
    setRoleUpdating(null)
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="User Management"
        subtitle="Admins can provision accounts and assign roles to control access."
      />
      {status && (
        <Alert severity={status.type} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent component="form" onSubmit={handleCreateUser}>
              <Stack spacing={2}>
                <Typography variant="h6">Create New Account</Typography>
                <TextField
                  label="Full Name"
                  value={form.name}
                  onChange={handleFormChange('name')}
                  required
                />
                <TextField
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={handleFormChange('email')}
                  required
                />
                <TextField
                  label="Temporary Password"
                  type="password"
                  value={form.password}
                  onChange={handleFormChange('password')}
                  required
                  helperText="Share securely with the parent; they can change it later."
                />
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    label="Role"
                    value={form.role}
                    onChange={handleFormChange('role')}
                  >
                    {roleOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button type="submit" variant="contained" disabled={formLoading}>
                  {formLoading ? 'Creating...' : 'Create Account'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">Existing Users</Typography>
                <Tooltip title="Refresh">
                  <span>
                    <IconButton onClick={loadUsers} disabled={usersLoading}>
                      <RefreshIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
              {usersLoading ? (
                <Stack alignItems="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </Stack>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Select
                            size="small"
                            value={user.role || 'Parent'}
                            onChange={(event) => handleRoleChange(user.id, event.target.value)}
                            disabled={roleUpdating === user.id}
                          >
                            {roleOptions.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.value}
                              </MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell>
                          {user.createdAt?.seconds
                            ? new Date(user.createdAt.seconds * 1000).toLocaleDateString()
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!users.length && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" color="text.secondary">
                            No users found.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  )
}

export default UserManagement
