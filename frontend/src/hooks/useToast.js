// src/hooks/useToast.js
import { useState, useCallback } from 'react'

export const useToast = () => {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(p => [...p, { id, message, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
  }, [])

  const remove = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), [])

  return { toasts, toast, remove }
}
