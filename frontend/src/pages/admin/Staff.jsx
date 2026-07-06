// src/pages/admin/Staff.jsx
import { useState } from 'react'
import { authAPI } from '../../api'
import { Alert, Modal, Field, Spinner } from '../../components/ui'
import { Toast } from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import { Users, Plus } from 'lucide-react'

const INITIAL = { fullName: '', email: '', password: '', role: 'bursar', phone: '' }

export default function AdminStaff() {
  const { toasts, toast, remove } = useToast()
  const [show,   setShow]   = useState(false)
  const [form,   setForm]   = useState(INITIAL)
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await authAPI.createStaff(form)
      toast(`${form.role} account created for ${form.fullName}!`)
      setShow(false); setForm(INITIAL)
    } catch (er) {
      setErr(er.response?.data?.message || 'Failed to create staff account')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Toast toasts={toasts} remove={remove} />

      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Staff Management</h1>
          <p className="page-sub">Create bursar and parent accounts</p>
        </div>
        <button onClick={() => setShow(true)} className="btn-primary"><Plus size={16} /> Add Staff</button>
      </div>

      {/* Info cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { role: 'Bursar', desc: 'Can view all student payments, run reconciliation, generate reports, and record manual payments. Full read/write access to payment data.', color: 'emerald', icon: '💼' },
          { role: 'Parent', desc: 'Can view only their linked children. Can see account numbers, payment history, and balance per term. Self-service child linking via student ID.', color: 'violet', icon: '👨‍👩‍👧' },
        ].map(({ role, desc, color, icon }) => (
          <div key={role} className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{icon}</span>
              <span className="font-bold text-gray-900">{role}</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            <button onClick={() => { setForm(p => ({ ...p, role: role.toLowerCase() })); setShow(true) }}
              className="btn-secondary mt-4 text-xs">
              + Create {role} Account
            </button>
          </div>
        ))}
      </div>

      {/* Create Staff Modal */}
      <Modal open={show} onClose={() => { setShow(false); setErr('') }} title="Create Staff Account">
        {err && <div className="mb-4"><Alert type="error" message={err} /></div>}
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Role" required>
            <select className="input" value={form.role} onChange={set('role')}>
              <option value="bursar">Bursar</option>
              <option value="parent">Parent</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name" required>
              <input className="input" placeholder="Ngozi Bursar" required value={form.fullName} onChange={set('fullName')} />
            </Field>
            <Field label="Phone">
              <input className="input" placeholder="08012345678" value={form.phone} onChange={set('phone')} />
            </Field>
          </div>
          <Field label="Email Address" required>
            <input type="email" className="input" placeholder="ngozi@greenfield.edu.ng" required value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Password" required>
            <input type="password" className="input" placeholder="At least 8 characters" required minLength={8} value={form.password} onChange={set('password')} />
          </Field>
          {form.role === 'parent' && (
            <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 text-xs text-violet-700">
              💡 After creating a parent account, the parent can self-link their child by logging in and using the "Link Child" feature with the school-issued student ID.
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShow(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : `Create ${form.role}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}