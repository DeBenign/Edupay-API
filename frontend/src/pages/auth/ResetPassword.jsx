// src/pages/auth/ResetPassword.jsx: the page the emailed reset link opens
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authAPI } from '../../api'
import { Alert, Spinner } from '../../components/ui'
import { GraduationCap, CheckCircle2 } from 'lucide-react'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 8) return setError('Password must be at least 8 characters')
    if (password !== confirm) return setError('The two passwords do not match')
    setLoading(true); setError('')
    try {
      await authAPI.resetPassword(token, password)
      localStorage.removeItem('token'); localStorage.removeItem('edupay_user')   // every older session is signed out
      setDone(true)
    } catch (err) { setError(err.response?.data?.message || 'Could not reset the password') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-200">
            <GraduationCap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Choose a new password</h1>
        </div>
        <div className="card p-6">
          {done ? (
            <div className="text-center space-y-3">
              <CheckCircle2 size={36} className="text-green-600 mx-auto" />
              <p className="text-sm text-gray-700">Password updated. Other devices were signed out.</p>
              <Link to="/login" className="btn-primary w-full inline-flex justify-center">Sign in</Link>
            </div>
          ) : !token ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-600">This reset link is not complete.</p>
              <Link to="/forgot-password" className="btn-secondary w-full inline-flex justify-center">Ask for a new link</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <Alert type="error" message={error} onClose={() => setError('')} />}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                <input type="password" className="input" placeholder="At least 8 characters" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                <input type="password" className="input" required value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Update password'}</button>
              <p className="text-xs text-center text-gray-400">Link expired or already used? <Link to="/forgot-password" className="text-blue-600 hover:underline">Ask for a new one</Link>.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
