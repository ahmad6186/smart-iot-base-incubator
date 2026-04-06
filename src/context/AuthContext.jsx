import { createContext, useContext } from 'react'

const AuthContext = createContext({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
})

export const AuthProvider = ({ value, children }) => {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

export default AuthContext
