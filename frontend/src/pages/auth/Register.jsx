// src/pages/auth/Register.jsx
import { useState } from 'react'
import Logo from '../../components/Logo'
import { Link } from 'react-router-dom'
import { authAPI } from '../../api'
import { Alert, Spinner } from '../../components/ui'

export default function Register() {
  const [form, setForm]       = useState({ fullName: '', email: '', password: '', role: 'admin', phone: '' })
  const [accepted, setAccepted] = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(p => ({...p, [k]: e.target.value}))
  const isSchool = form.role === 'admin'

  const handle = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) return setError('Password must be at least 8 characters')
    if (isSchool && !accepted) return setError('Please confirm you have read how EduPay works')
    setError(''); setLoading(true)
    try {
      const res   = await authAPI.register({ ...form, ...(isSchool && { acceptedTerms: true }) })
      const { token, user } = res.data.data
      localStorage.setItem('token', token)
      localStorage.setItem('edupay_user', JSON.stringify(user))
      // Full load so the app starts fresh with the new session
      window.location.assign(isSchool ? '/admin/settings' : '/parent')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally { setLoading(false) }
  }

  const choice = (role, title, text) => (
    <button type="button" onClick={() => setForm(p => ({ ...p, role }))}
      className={`text-left p-3 rounded-lg border transition-all ${form.role === role ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{text}</p>
    </button>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo size={56} className="mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">EduPay</h1>
          <p className="text-sm text-gray-500 mt-1">School Fee Management</p>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Create your account</h2>

          {error && <div className="mb-4"><Alert type="error" message={error} onClose={() => setError('')} /></div>}

          <form onSubmit={handle} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {choice('admin', 'Register a school', 'For owners and administrators')}
              {choice('parent', "I'm a parent", 'To pay and track fees')}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
              <input className="input" placeholder="Adebayo Johnson" required value={form.fullName} onChange={set('fullName')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input type="email" className="input" placeholder="you@email.com" required value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone number</label>
              <input className="input" placeholder="08012345678" required={isSchool} value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" className="input" placeholder="At least 8 characters" required minLength={8}
                value={form.password} onChange={set('password')} />
            </div>

            {isSchool ? (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                <p className="text-xs text-blue-800">
                  We will email you a link to confirm your address. EduPay then verifies every school before it starts, usually with a phone call, and emails you the decision. You will give your school details next.
                  Bursars are added later by you, from your dashboard.
                </p>
                <label className="flex items-start gap-2 text-xs text-gray-700">
                  <input type="checkbox" className="mt-0.5" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
                  <span>I have read <Link to="/how-it-works" target="_blank" className="text-blue-600 underline">how EduPay pricing, privacy and subscription work</Link>.</span>
                </label>
              </div>
            ) : (
              <p className="text-xs text-gray-500">We will email you a link to confirm your address. Then link your child with the code your school gives you.</p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner size="sm" /> : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>,{' '}
          <Link to="/how-it-works" className="text-blue-600 hover:underline font-medium">How it works</Link>
        </p>
      </div>
    </div>
  )
}
