// src/pages/auth/ForcePasswordChange.jsx
// Shown instead of the app while an admin-issued temporary password is still in use.
import { useState } from 'react'
import Logo from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'
import { authAPI } from '../../api'
import { Alert, Field, Spinner } from '../../components/ui'

export default function ForcePasswordChange() {
  const { user, logout, updateUser } = useAuth()
  const [form, setForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.newPassword.length < 8) return setError('New password must be at least 8 characters')
    if (form.newPassword !== form.confirm) return setError('The two new passwords do not match')
    if (form.newPassword === form.currentPassword) return setError('Choose a password different from the temporary one')
    setSaving(true)
    try {
      await authAPI.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      updateUser({ mustChangePassword: false })
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the password')
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo size={56} className="mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Choose a new password</h1>
          <p className="text-sm text-gray-500 mt-1">{user?.fullName}, your administrator reset your password. Set your own to continue.</p>
        </div>
        <div className="card p-6 shadow-sm">
          {error && <div className="mb-4"><Alert type="error" message={error} onClose={() => setError('')} /></div>}
          <form onSubmit={submit} className="space-y-4">
            <Field label="Temporary password" required>
              <input type="password" className="input" required autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} />
            </Field>
            <Field label="New password" required>
              <input type="password" className="input" required minLength={8} autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} />
            </Field>
            <Field label="Confirm new password" required>
              <input type="password" className="input" required minLength={8} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
            </Field>
            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Save and continue'}
            </button>
          </form>
          <button type="button" onClick={logout} className="block mx-auto mt-4 text-xs text-gray-400 hover:underline">Sign out</button>
        </div>
      </div>
    </div>
  )
}