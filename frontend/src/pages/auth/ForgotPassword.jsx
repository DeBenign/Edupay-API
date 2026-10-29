// src/pages/auth/ForgotPassword.jsx
import { useState } from 'react'
import Logo from '../../components/Logo'
import { Link } from 'react-router-dom'
import { authAPI } from '../../api'
import { Alert, Spinner } from '../../components/ui'
import { MailCheck } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try { await authAPI.forgotPassword(email); setDone(true) }
    catch (err) { setError(err.response?.data?.message || 'Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo size={56} className="mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Forgot your password?</h1>
          <p className="text-sm text-gray-500 mt-1">We will email you a link to choose a new one.</p>
        </div>
        <div className="card p-6">
          {done ? (
            <div className="text-center space-y-3">
              <MailCheck size={36} className="text-blue-600 mx-auto" />
              <p className="text-sm text-gray-700">If an account exists for <strong className="break-all">{email}</strong>, a reset link is on its way. It works for 1 hour.</p>
              <p className="text-xs text-gray-400">Nothing there? Check spam, or ask again in a minute.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <Alert type="error" message={error} onClose={() => setError('')} />}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input type="email" className="input" placeholder="you@email.com" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Send reset link'}</button>
            </form>
          )}
        </div>
        <p className="text-center text-sm text-gray-500 mt-4"><Link to="/login" className="text-blue-600 hover:underline font-medium">Back to sign in</Link></p>
      </div>
    </div>
  )
}
