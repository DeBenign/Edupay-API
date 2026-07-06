// src/pages/admin/Settings.jsx
import { useState, useEffect } from 'react'
import { schoolAPI, authAPI } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Alert, Spinner, Field } from '../../components/ui'
import { Toast } from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import { Building2, Lock } from 'lucide-react'
import { ENV_NAME, BASE_URL } from '../../api/axios'

export default function AdminSettings() {
  const { user, updateUser } = useAuth()
  const { toasts, toast, remove } = useToast()
  const [school,  setSchool]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')
  const [form,    setForm]    = useState({ name: '', address: '', email: '', phone: '' })
  const [pwForm,  setPwForm]  = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwErr,   setPwErr]   = useState('')
  const [pwSaving,setPwSaving]= useState(false)

  useEffect(() => {
    schoolAPI.getmine()
      .then(res => {
        const s = res.data.data.school
        setSchool(s)
        setForm({ name: s.name, address: s.address, email: s.email, phone: s.phone || '' })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSchoolSave = async (e) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      if (school) {
        await schoolAPI.update(school._id, form)
        toast('School profile updated!')
      } else {
        const res = await schoolAPI.create(form)
        setSchool(res.data.data.school)
        updateUser({ schoolId: res.data.data.school._id })
        toast('School created successfully!')
      }
    } catch (er) {
      setErr(er.response?.data?.message || 'Failed to save school')
    } finally { setSaving(false) }
  }

  const handlePwChange = async (e) => {
    e.preventDefault(); setPwErr('')
    if (pwForm.newPassword !== pwForm.confirmPassword) return setPwErr('Passwords do not match')
    setPwSaving(true)
    try {
      await authAPI.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      toast('Password changed successfully!')
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (er) {
      setPwErr(er.response?.data?.message || 'Failed to change password')
    } finally { setPwSaving(false) }
  }

  const set  = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const setPw = (k) => (e) => setPwForm(p => ({ ...p, [k]: e.target.value }))

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <Toast toasts={toasts} remove={remove} />

      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Manage your school profile and account</p>
      </div>

      {/* Server indicator */}
      <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border w-fit
        ${ENV_NAME === 'LIVE' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
        <span className={`w-2 h-2 rounded-full ${ENV_NAME === 'LIVE' ? 'bg-green-500' : 'bg-blue-500'}`} />
        Connected to: {ENV_NAME} — {BASE_URL}
      </div>

      {/* School profile */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
            <Building2 size={18} className="text-blue-600" />
          </div>
          <h2 className="font-semibold text-gray-900">{school ? 'School Profile' : 'Create Your School'}</h2>
        </div>

        {err && <div className="mb-4"><Alert type="error" message={err} /></div>}

        <form onSubmit={handleSchoolSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="School Name" required>
              <input className="input" placeholder="Greenfield Academy" required value={form.name} onChange={set('name')} />
            </Field>
            <Field label="School Email" required>
              <input type="email" className="input" placeholder="info@greenfield.edu.ng" required value={form.email} onChange={set('email')} />
            </Field>
          </div>
          <Field label="Address" required>
            <input className="input" placeholder="12 School Road, Abuja" required value={form.address} onChange={set('address')} />
          </Field>
          <Field label="Phone">
            <input className="input" placeholder="09011223344" value={form.phone} onChange={set('phone')} />
          </Field>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : school ? 'Save Changes' : 'Create School'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center">
            <Lock size={18} className="text-gray-600" />
          </div>
          <h2 className="font-semibold text-gray-900">Change Password</h2>
        </div>

        {pwErr && <div className="mb-4"><Alert type="error" message={pwErr} /></div>}

        <form onSubmit={handlePwChange} className="space-y-4">
          <Field label="Current Password" required>
            <input type="password" className="input" required value={pwForm.currentPassword} onChange={setPw('currentPassword')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="New Password" required>
              <input type="password" className="input" minLength={8} required value={pwForm.newPassword} onChange={setPw('newPassword')} />
            </Field>
            <Field label="Confirm New Password" required>
              <input type="password" className="input" required value={pwForm.confirmPassword} onChange={setPw('confirmPassword')} />
            </Field>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={pwSaving}>
              {pwSaving ? <Spinner size="sm" /> : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}