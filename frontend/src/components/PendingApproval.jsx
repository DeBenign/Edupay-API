// src/components/PendingApproval.jsx
// Shown instead of the dashboard while a school is not approved. Backend enforces the same rule (403).
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { schoolAPI, authAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { Alert, Spinner, Field } from './ui'
import { Clock, PhoneCall, CheckCircle2, XCircle, PauseCircle, MessageCircleQuestion, LogOut } from 'lucide-react'

const COPY = {
  pending:    { icon: Clock, tone: 'text-amber-600 bg-amber-50', title: 'Application received', text: 'EduPay is verifying your school. We usually call the school on a number we can confirm independently, so please keep your phone on.' },
  needs_info: { icon: MessageCircleQuestion, tone: 'text-blue-600 bg-blue-50', title: 'EduPay needs a little more information', text: '' },
  rejected:   { icon: XCircle, tone: 'text-red-600 bg-red-50', title: 'Application not approved', text: '' },
  suspended:  { icon: PauseCircle, tone: 'text-red-600 bg-red-50', title: 'School account suspended', text: '' },
}

export default function PendingApproval() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const status = user.approvalStatus
  const copy = COPY[status] || COPY.pending
  const Icon = copy.icon
  const isAdmin = user.role === 'admin'

  const [school, setSchool] = useState(null)
  const [form, setForm] = useState({ name: '', address: '', email: '', phone: '', applicantPosition: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [checking, setChecking] = useState(false)

  const refresh = useCallback(async () => {
    setChecking(true)
    try { const me = await authAPI.me(); updateUser(me.data.data.user) } catch { /* keep current screen */ }
    finally { setChecking(false) }
  }, [updateUser])

  useEffect(() => {
    schoolAPI.getmine().then(r => {
      const s = r.data.data.school; setSchool(s)
      setForm({ name: s.name, address: s.address, email: s.email, phone: s.phone || '', applicantPosition: s.applicantPosition || '' })
    }).catch(() => {})
    const t = setInterval(refresh, 30000)   // pick up the decision without a manual refresh
    return () => clearInterval(t)
  }, [refresh])

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const resubmit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      await schoolAPI.update(school._id, form)
      await schoolAPI.resubmit()
      await refresh()
    } catch (er) { setErr(er.response?.data?.message || 'Could not resubmit') }
    finally { setBusy(false) }
  }
  const signOut = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="card p-6 text-center">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 ${copy.tone}`}><Icon size={24} /></div>
          <h1 className="text-lg font-semibold text-gray-900">{isAdmin ? copy.title : 'Your school is not active yet'}</h1>
          {isAdmin ? (
            <>
              {copy.text && <p className="text-sm text-gray-500 mt-2">{copy.text}</p>}
              {status === 'needs_info' && user.approvalMessage && <p className="text-sm text-gray-800 bg-blue-50 border border-blue-100 rounded-lg p-3 mt-3 text-left">{user.approvalMessage}</p>}
              {(status === 'rejected' || status === 'suspended') && (
                <p className="text-sm text-gray-800 bg-red-50 border border-red-100 rounded-lg p-3 mt-3 text-left">
                  {user.approvalReason || 'No reason was recorded.'}
                  <span className="block text-xs text-gray-500 mt-2">If you think this is a mistake, contact EduPay with your school name and the phone number you registered.</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 mt-2">Your school&apos;s EduPay account is {status === 'pending' ? 'awaiting approval' : 'not active'}. Please speak to your school administrator.</p>
          )}
        </div>

        {isAdmin && status === 'pending' && (
          <div className="card p-5">
            <p className="text-sm font-medium text-gray-900 mb-3">What happens next</p>
            <ol className="space-y-3 text-sm text-gray-600">
              <li className="flex gap-3"><CheckCircle2 size={18} className="text-green-600 shrink-0" /> You applied{school ? ` for ${school.name}` : ''}.</li>
              <li className="flex gap-3"><PhoneCall size={18} className="text-amber-600 shrink-0" /> EduPay verifies your school, usually by phone.</li>
              <li className="flex gap-3"><Clock size={18} className="text-gray-400 shrink-0" /> Once approved, your 120-day free pilot starts and you can enrol students. We will email you the decision.</li>
            </ol>
          </div>
        )}

        {isAdmin && status === 'needs_info' && school && (
          <form onSubmit={resubmit} className="card p-5 space-y-3">
            <p className="text-sm font-medium text-gray-900">Update your details and resubmit</p>
            {err && <Alert type="error" message={err} />}
            <Field label="School name" required><input className="input" required value={form.name} onChange={set('name')} /></Field>
            <Field label="Address" required><input className="input" required value={form.address} onChange={set('address')} /></Field>
            <Field label="School email" required><input type="email" className="input" required value={form.email} onChange={set('email')} /></Field>
            <Field label="School phone" required><input className="input" required value={form.phone} onChange={set('phone')} /></Field>
            <Field label="Your position at the school" required><input className="input" required value={form.applicantPosition} onChange={set('applicantPosition')} /></Field>
            <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner size="sm" /> : 'Save and resubmit'}</button>
          </form>
        )}

        <div className="flex gap-3 justify-center">
          <button className="btn-secondary" onClick={refresh} disabled={checking}>{checking ? <Spinner size="sm" /> : 'Check status'}</button>
          <button className="btn-secondary" onClick={signOut}><LogOut size={14} /> Sign out</button>
        </div>
      </div>
    </div>
  )
}
