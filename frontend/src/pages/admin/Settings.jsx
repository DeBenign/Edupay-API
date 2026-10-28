// src/pages/admin/Settings.jsx
import { useState, useEffect } from 'react'
import { schoolAPI, authAPI, subscriptionAPI } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Alert, Spinner, Field, Toast } from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { Building2, Lock, Gift } from 'lucide-react'
import { ENV_NAME, BASE_URL } from '../../api/axios'

export default function AdminSettings() {
  const { user, updateUser } = useAuth()
  const { toasts, toast, remove } = useToast()
  const [school,   setSchool]   = useState(null)
  const [sub,      setSub]      = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')
  const [form,     setForm]     = useState({ name: '', address: '', email: '', phone: '', applicantPosition: '', referralCode: '' })
  const [pwForm,   setPwForm]   = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwErr,    setPwErr]    = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const loadSub = () => subscriptionAPI.mine().then(r => setSub(r.data.data.subscription)).catch(() => {})

  useEffect(() => {
    schoolAPI.getmine()
      .then(res => {
        const s = res.data.data.school
        setSchool(s)
        setForm({ name: s.name, address: s.address, email: s.email, phone: s.phone || '', applicantPosition: s.applicantPosition || '', referralCode: '' })
        loadSub()
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSchoolSave = async (e) => {
    e.preventDefault(); setSaving(true); setErr('')
    const { referralCode, ...profile } = form
    try {
      if (school) {
        await schoolAPI.update(school._id, profile)
        toast('School profile updated!')
      } else {
        const res = await schoolAPI.create({ ...profile, ...(referralCode.trim() && { referralCode: referralCode.trim() }) })
        setSchool(res.data.data.school)
        // Reload the session: the school now exists but is awaiting EduPay approval
        const me = await authAPI.me()
        updateUser(me.data.data.user)
        toast('Application submitted. EduPay will verify your school.')
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

  const toggleDiscount = async (e) => {
  const next = e.target.checked
  try {
    await schoolAPI.update(school._id, { earlyPaymentDiscountEnabled: next })
    setSchool(s => ({ ...s, earlyPaymentDiscountEnabled: next }))
    toast(next ? 'Early-payment discount is on' : 'Early-payment discount is off')
  } catch (er) { toast(er.response?.data?.message || 'Could not update', 'error') }
}

  const copy = (text) => { navigator.clipboard.writeText(text); toast('Copied') }
  const set   = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const setPw = (k) => (e) => setPwForm(p => ({ ...p, [k]: e.target.value }))

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <Toast toasts={toasts} remove={remove} />

      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Manage your school profile and account</p>
      </div>

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
          <h2 className="font-semibold text-gray-900">{school ? 'School Profile' : 'Register Your School'}</h2>
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
          <Field label={school ? 'Phone' : 'School phone (EduPay will call this number)'} required={!school}>
            <input className="input" placeholder="09011223344" required={!school} value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="Your position at the school" required={!school}>
            <input className="input" placeholder="Proprietor, Principal, Bursar..." required={!school} value={form.applicantPosition} onChange={set('applicantPosition')} />
          </Field>
          {!school && (
            <Field label="Referral code (optional)">
              <input className="input" placeholder="Code from the person or school that referred you"
                value={form.referralCode} onChange={set('referralCode')} />
            </Field>
          )}
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : school ? 'Save Changes' : 'Submit for approval'}
            </button>
          </div>
        </form>
      </div>

      {school && (
        <div className="card p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Early-payment discount</h2>
          <p className="text-sm text-gray-500">
            Offer parents 10% off when their first payment on a term fee covers at least 90% of it and is made on or before the due date.
            Your school absorbs the difference. Off by default.
          </p>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={!!school.earlyPaymentDiscountEnabled} onChange={toggleDiscount} />
            {school.earlyPaymentDiscountEnabled ? 'On' : 'Off'}
          </label>
        </div>
      )}


      {/* Referral codes */}
      {school && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <Gift size={18} className="text-purple-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Referral codes</h2>
          </div>
          <p className="text-sm text-gray-500">
            Share a code with another school. When that school signs up with it and pays through EduPay, you are rewarded.
          </p>
          {[
            school.referralCode && { label: 'School code (earns 30 days of waived service charges)', code: school.referralCode },
            user?.referralCode  && { label: 'Your personal code (earns an airtime or data reward)', code: user.referralCode },
          ].filter(Boolean).map(({ label, code }) => (
            <div key={code} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-mono font-bold text-gray-900">{code}</p>
              </div>
              <button className="btn-secondary text-xs" onClick={() => copy(code)}>Copy</button>
            </div>
          ))}
        </div>
      )}

      {/* Subscription */}
     {sub && (
      <div className="card p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Subscription</h2>
        <p className="text-sm text-gray-600">
          {sub.status === 'pilot'  && `Free pilot until ${formatDate(sub.activeUntil)}.`}
          {sub.status === 'active' && `Paid until ${formatDate(sub.activeUntil)}.`}
          {sub.status === 'due' && !sub.locked && `Your subscription is overdue. Adding students, fees, staff and cash payments pauses on ${formatDate(sub.graceEndsAt)}.`}
          {sub.locked && 'Your subscription has ended. Adding students, fees, staff and cash payments is paused until payment is recorded.'}
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Students enrolled</span><span>{sub.enrolledStudents}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Billed for (highest active count this term)</span><span>{sub.billableStudents}</span></div>
          <div className="flex justify-between font-semibold"><span>Per term</span><span>{formatCurrency(sub.amountDue)}</span></div>
          <p className="text-xs text-gray-400">{sub.billableStudents} × {formatCurrency(sub.ratePerStudent)}, minimum {formatCurrency(sub.minimum)}</p>
        </div>
        <p className="text-xs text-gray-500">
          {sub.payTo ? `Pay to ${sub.payTo.bank} ${sub.payTo.accountNumber} (${sub.payTo.accountName}). Use your school name as the reference.` : 'Contact EduPay for the payment details.'}
          {' '}Billing is automatic from the students enrolled in EduPay. You do not need to declare a count.
        </p>
      </div>
    )}
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