// src/pages/auth/VerifyEmail.jsx: the page the emailed link opens
import { useEffect, useRef, useState } from 'react'
import Logo from '../../components/Logo'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../../components/ui'
import { CheckCircle2, XCircle } from 'lucide-react'

const HOME = { admin: '/admin', bursar: '/bursar', parent: '/parent' }

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const [state, setState] = useState('working')   // working | ok | failed
  const [message, setMessage] = useState('')
  const started = useRef(false)                    // the link works once: never call it twice (React strict mode)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const token = params.get('token') || ''
    authAPI.verifyEmail(token)
      .then(async () => {
        setState('ok')
        if (localStorage.getItem('token')) {         // already signed in here: refresh the session now
          try { const me = await authAPI.me(); updateUser(me.data.data.user) } catch { /* the next page load refreshes it */ }
        }
      })
      .catch((err) => { setState('failed'); setMessage(err.response?.data?.message || 'This link could not be verified.') })
  }, [params, updateUser])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <Logo size={56} className="mb-4" />
        <div className="card p-6 space-y-3">
          {state === 'working' && (<><div className="flex justify-center"><Spinner /></div><p className="text-sm text-gray-500">Verifying your email...</p></>)}
          {state === 'ok' && (
            <>
              <CheckCircle2 size={36} className="text-green-600 mx-auto" />
              <h1 className="text-lg font-semibold text-gray-900">Email verified</h1>
              <p className="text-sm text-gray-500">Thank you. Your address is confirmed.</p>
              {user
                ? <button className="btn-primary w-full" onClick={() => navigate(HOME[user.role] || '/')}>Continue</button>
                : <Link to="/login" className="btn-primary w-full inline-flex justify-center">Sign in</Link>}
            </>
          )}
          {state === 'failed' && (
            <>
              <XCircle size={36} className="text-red-500 mx-auto" />
              <h1 className="text-lg font-semibold text-gray-900">Link not valid</h1>
              <p className="text-sm text-gray-500">{message}</p>
              <Link to="/login" className="btn-secondary w-full inline-flex justify-center">Sign in to get a new link</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
