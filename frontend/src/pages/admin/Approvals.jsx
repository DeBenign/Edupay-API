// src/pages/admin/Approvals.jsx: EduPay owner reviews school applications.
// Shows identity and contact details only. No student counts, no revenue.
import { useEffect, useState, useCallback } from 'react'
import { schoolAPI } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Spinner, Alert, Modal, Field } from '../../components/ui'
import { formatDate } from '../../utils/formatters'

const TABS = [['pending', 'Pending'], ['email', 'Waiting for email'], ['needs_info', 'Needs info'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['suspended', 'Suspended']]
const COUNT_KEY = { email: 'waitingForEmail' }
const ACTIONS = {
  approve:   { label: 'Approve',  call: 'approve',     field: 'verificationNote', placeholder: 'How did you verify? e.g. Called the principal on 0803... from the school signboard', cta: 'Approve school', cls: 'btn-primary' },
  reject:    { label: 'Reject',   call: 'reject',      field: 'reason',  placeholder: 'Reason (shown to the applicant)', cta: 'Reject application', cls: 'btn-secondary' },
  info:      { label: 'Ask for more information', call: 'requestInfo', field: 'message', placeholder: 'What do you need from them? (shown to the applicant)', cta: 'Send back', cls: 'btn-secondary' },
  suspend:   { label: 'Suspend',  call: 'suspend',     field: 'reason',  placeholder: 'Reason (shown to the school)', cta: 'Suspend school', cls: 'btn-secondary' },
  reinstate: { label: 'Reinstate', call: 'reinstate',  field: 'note',    placeholder: 'Note (optional)', cta: 'Reinstate school', cls: 'btn-primary', optional: true },
}
const ALLOWED = { pending: ['approve', 'info', 'reject'], needs_info: ['approve', 'reject'], approved: ['suspend'], suspended: ['reinstate'], rejected: [] }

export default function Approvals() {
  const { user } = useAuth()
  const [tab, setTab] = useState('pending')
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [open, setOpen] = useState(null)       // the application being reviewed
  const [action, setAction] = useState(null)
  const [text, setText] = useState('')
  const [called, setCalled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [emailConfigured, setEmailConfigured] = useState(true)
  const [signups, setSignups] = useState([])
  const [signupRole, setSignupRole] = useState('admin')
  const [signup, setSignup] = useState(null)       // the unverified sign-up being reviewed
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'email') {
        const r = (await schoolAPI.unverifiedSignups(signupRole)).data.data
        setSignups(r.signups); setEmailConfigured(r.emailConfigured)
        setCounts((c) => ({ ...c, waitingForEmail: r.counts.admin }))
      } else {
        const r = (await schoolAPI.applications(tab)).data.data
        setRows(r.applications); setCounts(r.counts); setEmailConfigured(r.emailConfigured)
      }
    } catch (err) { setMsg({ type: 'error', text: err.response?.status === 403 ? 'Platform admin only' : 'Could not load applications' }) }
    finally { setLoading(false) }
  }, [tab, signupRole])
  useEffect(() => { load() }, [load])

  const close = () => { setOpen(null); setAction(null); setText(''); setCalled(false); setSignup(null); setNote('') }
  const verifyByHand = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      const res = await schoolAPI.verifyEmailManually(signup._id, note)
      setMsg({ type: 'success', text: res.data.message }); close(); load()
    } catch (err) { setMsg({ type: 'error', text: err.response?.data?.message || 'Action failed' }) }
    finally { setBusy(false) }
  }
  const submit = async (e) => {
    e.preventDefault()
    const cfg = ACTIONS[action]; setBusy(true)
    try {
      const body = { [cfg.field]: text, ...(action === 'approve' && { verifiedByCall: called }) }
      const res = await schoolAPI[cfg.call](open._id, body)
      setMsg({ type: 'success', text: res.data.message }); close(); load()
    } catch (err) { setMsg({ type: 'error', text: err.response?.data?.message || 'Action failed' }) }
    finally { setBusy(false) }
  }

  if (!user?.isPlatformAdmin) return <Alert type="error" message="Platform admin only" />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">School applications</h1>
        <p className="text-sm text-gray-500 mt-1">Verify each school before it starts. Call a number you found yourself (signboard, official listing), not only the one in the application.</p>
      </div>
      {msg && <Alert type={msg.type} message={msg.text} onClose={() => setMsg(null)} />}
      {!emailConfigured && (
        <Alert type="error" message="Email is not configured on this server, so nobody can verify their address or receive decisions. Use the Waiting for email tab to verify people by hand until it is fixed." />
      )}

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border ${tab === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
            {label} <span className="opacity-70">{counts[COUNT_KEY[key] || key] || 0}</span>
          </button>
        ))}
      </div>

      {tab === 'email' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            People who signed up but have not confirmed their email. This list is usually empty within minutes; it fills up when email is down.
            Verify someone by hand only after you have confirmed who they are, for example by phone. It is recorded with your name and reason.
            A school still needs your call and approval.
          </p>
          <div className="flex gap-2">
            {[['admin', 'School admins'], ['parent', 'Parents']].map(([r, label]) => (
              <button key={r} onClick={() => setSignupRole(r)}
                className={`px-3 py-1 rounded-full text-xs border ${signupRole === r ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>{label}</button>
            ))}
          </div>
          {loading ? <div className="flex justify-center py-10"><Spinner /></div> : signups.length === 0 ? (
            <div className="card p-8 text-center text-sm text-gray-500">Nobody is waiting.</div>
          ) : signups.map((u) => (
            <button key={u._id} onClick={() => setSignup(u)} className="card p-4 w-full text-left hover:border-blue-200 transition-all">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{u.fullName}</p>
                  <p className="text-xs text-gray-500 mt-0.5 break-all">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">{formatDate(u.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'email' ? null : loading ? <div className="flex justify-center py-10"><Spinner /></div> : rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">Nothing here.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <button key={s._id} onClick={() => setOpen(s)} className="card p-4 w-full text-left hover:border-blue-200 transition-all">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.createdBy?.fullName} · {s.applicantPosition || 'position not given'}</p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">{formatDate(s.approval?.submittedAt || s.createdAt)}</p>
              </div>
              {s.wasReferred && <p className="text-xs text-blue-600 mt-2">Came with a referral code</p>}
            </button>
          ))}
        </div>
      )}

      <Modal open={!!signup} onClose={close} title={signup ? `Verify ${signup.fullName}` : ''}>
        {signup && (
          <form onSubmit={verifyByHand} className="space-y-3 text-sm">
            <dl className="grid grid-cols-3 gap-y-2">
              <dt className="text-gray-400">Email</dt><dd className="col-span-2 break-all">{signup.email}</dd>
              <dt className="text-gray-400">Phone</dt><dd className="col-span-2">{signup.phone || 'Not given'}</dd>
              <dt className="text-gray-400">Signed up</dt><dd className="col-span-2">{formatDate(signup.createdAt)}</dd>
            </dl>
            <Field label="Why are you verifying this address yourself?" required>
              <textarea className="input" rows={3} required minLength={5} placeholder="e.g. Confirmed by phone on 0803..., mail provider was down"
                value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? <Spinner size="sm" /> : 'Mark email verified'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!open} onClose={close} title={open ? open.name : ''}>
        {open && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-3 gap-y-2">
              <dt className="text-gray-400">Applicant</dt><dd className="col-span-2">{open.createdBy?.fullName} ({open.applicantPosition || 'no position'})</dd>
              <dt className="text-gray-400">Applicant email</dt><dd className="col-span-2 break-all">{open.createdBy?.email}</dd>
              <dt className="text-gray-400">Applicant phone</dt><dd className="col-span-2">{open.createdBy?.phone || 'Not given'}</dd>
              <dt className="text-gray-400">School phone</dt><dd className="col-span-2">{open.phone || 'Not given'}</dd>
              <dt className="text-gray-400">School email</dt><dd className="col-span-2 break-all">{open.email}</dd>
              <dt className="text-gray-400">Address</dt><dd className="col-span-2">{open.address}</dd>
              <dt className="text-gray-400">Status</dt><dd className="col-span-2">{open.approval?.status || 'approved'}</dd>
            </dl>
            {open.approval?.history?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">History</p>
                <ul className="space-y-1 text-xs text-gray-600">
                  {open.approval.history.map((h, i) => <li key={i}>{formatDate(h.at)}: {h.status}{h.note ? ` (${h.note})` : ''}</li>)}
                </ul>
              </div>
            )}

            {!action ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {(ALLOWED[open.approval?.status || 'approved'] || []).map((a) => (
                  <button key={a} className={ACTIONS[a].cls} onClick={() => setAction(a)}>{ACTIONS[a].label}</button>
                ))}
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3 border-t border-gray-100 pt-3">
                <Field label={ACTIONS[action].label} required={!ACTIONS[action].optional}>
                  <textarea className="input" rows={3} minLength={ACTIONS[action].optional ? undefined : 5} required={!ACTIONS[action].optional}
                    placeholder={ACTIONS[action].placeholder} value={text} onChange={(e) => setText(e.target.value)} />
                </Field>
                {action === 'approve' && (
                  <label className="flex items-start gap-2 text-xs text-gray-700">
                    <input type="checkbox" className="mt-0.5" checked={called} onChange={(e) => setCalled(e.target.checked)} />
                    <span>I verified this school by calling a phone number I trust. Approving starts the school&apos;s 120-day free pilot.</span>
                  </label>
                )}
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn-secondary" onClick={() => { setAction(null); setText('') }}>Back</button>
                  <button type="submit" className="btn-primary" disabled={busy || (action === 'approve' && !called)}>{busy ? <Spinner size="sm" /> : ACTIONS[action].cta}</button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
