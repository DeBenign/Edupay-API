// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('edupay_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('edupay_token')
    if (!token) { setLoading(false); return }

    authAPI.me()
      .then(res => { setUser(res.data.data.user); setLoading(false) })
      .catch(() => {
        localStorage.removeItem('edupay_token')
        localStorage.removeItem('edupay_user')
        setUser(null)
        setLoading(false)
      })
  }, [])

  const login = useCallback(async (email, password) => {
    const res  = await authAPI.login({ email, password })
    const { user, token } = res.data.data
    localStorage.setItem('edupay_token', token)
    localStorage.setItem('edupay_user',  JSON.stringify(user))
    setUser(user)
    return user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('edupay_token')
    localStorage.removeItem('edupay_user')
    setUser(null)
  }, [])

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem('edupay_user', JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
