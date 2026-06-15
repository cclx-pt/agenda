import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import * as authService from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    authService
      .fetchMe()
      .then((u) => active && setUser(u))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const requestCode = useCallback((email) => authService.requestCode(email), [])

  const verifyCode = useCallback(async (email, code) => {
    const data = await authService.verifyCode(email, code)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    hasRole: (...roles) => !!user && roles.includes(user.role),
    canViewPrivate:
      !!user &&
      (user.role === 'admin' || user.role === 'visitante' || user.canViewPrivate === true),
    requestCode,
    verifyCode,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
