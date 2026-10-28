// src/components/VerifyEmailGate.jsx
// Shown instead of the app until the user confirms their email. The API enforces the same rule (403 EMAIL_NOT_VERIFIED).
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { Alert, Spinner } from './ui'
import { MailCheck, LogOut } from 'lucide-react'

export default function VerifyEmailGate() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)

  const check = useCallback(async () => {
    try { const me = await authAPI.me(); updateUser(me.data.data.user) } catch { /* ignore */ }
  }, [updateUser])

  useEffect(() => {                      // verified in another tab or on your phone? this screen notices
    const t = setInterval(check, 15000)
    return () => clearInterval(t)
  }, [check])
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const resend = async () => {
    setBusy(true); setMsg(null)
    try {
      const res = await authAPI.resendVerification()
      setMsg({ type: res.data.data?.sent === false ? 'error' : 'success', text: res.data.message })
      setWait(60)
    } catch (err) {
      const retry = err.response?.data?.retryAfter
      if (retry) setWait(retry)
      setMsg({ type: 'error', text: err.response?.data?.message || 'Could not send the email' })
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="card p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 text-blue-600 bg-blue-50"><MailCheck size={24} /></div>
          <h1 className="text-lg font-semibold text-gray-900">Check your email</h1>
          <p className="text-sm text-gray-500 mt-2">We sent a verification link to <strong className="text-gray-800 break-all">{user.email}</strong>. Open it to continue. It works for 24 hours.</p>
          <p className="text-xs text-gray-400 mt-2">Not there? Check your spam folder.</p>
        </div>
        {msg && <Alert type={msg.type} message={msg.text} onClose={() => setMsg(null)} />}
        <div className="flex gap-3 justify-center flex-wrap">
          <button className="btn-primary" onClick={resend} disabled={busy || wait > 0}>
            {busy ? <Spinner size="sm" /> : wait > 0 ? `Resend in ${wait}s` : 'Resend email'}
          </button>
          <button className="btn-secondary" onClick={check}>I have verified</button>
          <button className="btn-secondary" onClick={() => { logout(); navigate('/login') }}><LogOut size={14} /> Sign out</button>
        </div>
      </div>
    </div>
  )
}
