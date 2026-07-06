// src/pages/auth/Login.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { GraduationCap, Eye, EyeOff } from 'lucide-react'
import { Alert, Spinner } from '../../components/ui'

export default function Login() {
  const { login }    = useAuth()
  const navigate     = useNavigate()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [show, setShow]       = useState(false)

  const roleRoutes = { admin: '/admin', bursar: '/bursar', parent: '/parent' }

  const handle = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const user = await login(form.email, form.password)
      navigate(roleRoutes[user.role] || '/admin')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-200">
            <GraduationCap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">EduPay</h1>
          <p className="text-sm text-gray-500 mt-1">School Fee Management</p>
        </div>

        <div className="card p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Sign in to your account</h2>

          {error && <div className="mb-4"><Alert type="error" message={error} onClose={() => setError('')} /></div>}

          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input type="email" className="input" placeholder="you@school.edu.ng" required
                value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Password</label>
              </div>
              <div className="relative">
                <input type={show ? 'text' : 'password'} className="input pr-10" placeholder="••••••••" required
                  value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? <Spinner size="sm" /> : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          New school?{' '}
          <Link to="/register" className="text-blue-600 hover:underline font-medium">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
