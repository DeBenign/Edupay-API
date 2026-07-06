// src/pages/auth/Register.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../../api'
import { GraduationCap } from 'lucide-react'
import { Alert, Spinner } from '../../components/ui'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm]       = useState({ fullName: '', email: '', password: '', role: 'admin', phone: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(p => ({...p, [k]: e.target.value}))

  const handle = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) return setError('Password must be at least 8 characters')
    setError(''); setLoading(true)
    try {
      const res   = await authAPI.register(form)
      const { token, user } = res.data.data
      localStorage.setItem('edupay_token', token)
      localStorage.setItem('edupay_user', JSON.stringify(user))
      navigate(user.role === 'admin' ? '/admin' : '/parent')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-200">
            <GraduationCap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">EduPay</h1>
          <p className="text-sm text-gray-500 mt-1">School Fee Management</p>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Create your account</h2>

          {error && <div className="mb-4"><Alert type="error" message={error} onClose={() => setError('')} /></div>}

          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
              <input className="input" placeholder="Adebayo Johnson" required value={form.fullName} onChange={set('fullName')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input type="email" className="input" placeholder="admin@greenfield.edu.ng" required value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone number</label>
              <input className="input" placeholder="08012345678" value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <select className="input" value={form.role} onChange={set('role')}>
                <option value="admin">School Admin</option>
                <option value="parent">Parent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" className="input" placeholder="At least 8 characters" required minLength={8}
                value={form.password} onChange={set('password')} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner size="sm" /> : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
