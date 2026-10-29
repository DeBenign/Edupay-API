// src/pages/platform/Account.jsx: the EduPay owner's own account. No school profile here.
import { useState } from 'react'
import { authAPI } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Alert, Spinner, Field, Toast } from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import EnvBadge from '../../components/EnvBadge'
import { Lock } from 'lucide-react'

export default function PlatformAccount() {
  const { user } = useAuth()
  const { toasts, toast, remove } = useToast()
  const [form, setForm]     = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [err, setErr]       = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (form.newPassword !== form.confirmPassword) return setErr('Passwords do not match')
    setSaving(true)
    try {
      await authAPI.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      toast('Password changed. Other sessions are signed out.')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (er) { setErr(er.response?.data?.message || 'Failed to change password') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <Toast toasts={toasts} remove={remove} />
      <div className="page-header">
        <h1 className="page-title">Account</h1>
        <p className="page-sub">{user?.fullName} · {user?.email}</p>
      </div>

      <EnvBadge variant="banner" />

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center"><Lock size={18} className="text-blue-600" /></div>
          <h2 className="font-semibold text-gray-900">Change password</h2>
        </div>
        {err && <div className="mb-4"><Alert type="error" message={err} /></div>}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Current password" required><input type="password" className="input" required value={form.currentPassword} onChange={set('currentPassword')} /></Field>
          <Field label="New password" required><input type="password" className="input" minLength={8} required value={form.newPassword} onChange={set('newPassword')} /></Field>
          <Field label="Confirm new password" required><input type="password" className="input" minLength={8} required value={form.confirmPassword} onChange={set('confirmPassword')} /></Field>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? <Spinner size="sm" /> : 'Update password'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
