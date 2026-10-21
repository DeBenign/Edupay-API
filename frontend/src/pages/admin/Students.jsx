// src/pages/admin/Students.jsx
import { useState, useEffect, useCallback } from 'react'
import { studentAPI, feeAPI } from '../../api'
import { StatusBadge, Table, Pagination, EmptyState, Modal, Spinner, Alert, Field, StatCard } from '../../components/ui'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { useToast } from '../../hooks/useToast'
import { Toast } from '../../components/ui'
import { GraduationCap, Plus, Search, RefreshCw, Copy, Check, AlertCircle } from 'lucide-react'

const INITIAL_FORM = { fullName: '', studentId: '', class: '', gender: 'male', dateOfBirth: '' }
const INITIAL_PROMOTE = { fromClass: '', toClass: '', graduate: false, force: false }
const INITIAL_FEE = { name: '', amount: '', reason: '', term: '', academicSession: '', dueDate: '' }

export default function AdminStudents() {
  const { toasts, toast, remove } = useToast()
  const [students,    setStudents]   = useState([])
  const [pagination,  setPagination] = useState(null)
  const [loading,     setLoading]    = useState(true)
  const [search,      setSearch]     = useState('')
  const [classFilter, setClass]      = useState('')
  const [page,        setPage]       = useState(1)
  const [showEnroll,  setShowEnroll] = useState(false)
  const [form,        setForm]       = useState(INITIAL_FORM)
  const [enrolling,   setEnrolling]  = useState(false)
  const [enrollErr,   setEnrollErr]  = useState('')
  const [accountModal,setAccountModal] = useState(null)
  const [copied,      setCopied]     = useState(false)

  const [promoteOpen,    setPromoteOpen]    = useState(false)
const [promoteForm,    setPromoteForm]    = useState(INITIAL_PROMOTE)
const [promotePreview, setPromotePreview] = useState(null)
const [promoting,      setPromoting]      = useState(false)
const [promoteErr,     setPromoteErr]     = useState('')

const [feeModal,  setFeeModal]  = useState(null)
const [feeForm,   setFeeForm]   = useState(INITIAL_FEE)
const [savingFee, setSavingFee] = useState(false)
const [feeErr,    setFeeErr]    = useState('')

const [adjusting,  setAdjusting]  = useState(null)
const [adjForm,    setAdjForm]    = useState({ newAmount: '', reason: '' })
const [adjSaving,  setAdjSaving]  = useState(false)
const [adjErr,     setAdjErr]     = useState('')

const openAdjust = (fee) => {
  setAdjusting({ fee, student: accountModal })
  setAdjForm({ newAmount: String(fee.amountExpected ?? ''), reason: '' })
  setAdjErr('')
}

const submitAdjust = async (e) => {
  e.preventDefault(); setAdjSaving(true); setAdjErr('')
  try {
    await feeAPI.adjustAssignment(adjusting.fee.assignmentId, {
      newAmountExpected: Number(adjForm.newAmount), reason: adjForm.reason,
    })
    toast('Fee adjusted')
    const s = adjusting.student
    setAdjusting(null)
    await showAccount({ _id: s._id, fullName: s.studentName, studentId: s.studentId })
    load()
  } catch (err) {
    setAdjErr(err.response?.data?.message || 'Could not adjust fee')
  } finally { setAdjSaving(false) }
}

const closePromote = () => { setPromoteOpen(false); setPromotePreview(null); setPromoteErr(''); setPromoteForm(INITIAL_PROMOTE) }

const setP = (k) => (e) => {
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
  setPromoteForm(p => ({ ...p, [k]: v })); setPromotePreview(null)
}

const runPromote = async (preview) => {
  setPromoting(true); setPromoteErr('')
  try {
    const { fromClass, toClass, graduate, force } = promoteForm
    const res = await studentAPI.promoteClass({
      fromClass, preview,
      ...(graduate ? { graduate: true, force } : { toClass }),
    })
    if (preview) setPromotePreview(res.data.data)
    else { toast(res.data?.message || 'Done'); closePromote(); load() }
  } catch (err) {
    setPromoteErr(err.response?.data?.message || 'Request failed')
  } finally { setPromoting(false) }
}

const setF = (k) => (e) => setFeeForm(p => ({ ...p, [k]: e.target.value }))
const fmtCode = (c) => (c ? c.replace(/[^A-Z0-9]/gi, '').replace(/^(.{4})(.{4})$/, '$1-$2') : '')
const openFee = (s) => { setFeeModal(s); setFeeForm(INITIAL_FEE); setFeeErr('') }

const submitFee = async (e) => {
  e.preventDefault(); setSavingFee(true); setFeeErr('')
  try {
    const { name, amount, reason, term, academicSession, dueDate } = feeForm
    const res = await feeAPI.addToStudent({
      studentId: feeModal._id, name, amount: Number(amount),
      ...(reason && { reason }), ...(term && { term }),
      ...(academicSession && { academicSession }), ...(dueDate && { dueDate }),
    })
    toast(res.data?.message || 'Fee added')
    setFeeModal(null); load()
  } catch (err) {
    setFeeErr(err.response?.data?.message || 'Could not add fee')
  } finally { setSavingFee(false) }
}

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await studentAPI.list({ page, limit: 15, search, class: classFilter })
      setStudents(res.data.data.students)
      setPagination(res.data.pagination)
    } catch { toast('Failed to load students', 'error') }
    finally { setLoading(false) }
  }, [page, search, classFilter])

  useEffect(() => { load() }, [load])

  const handleEnroll = async (e) => {
    e.preventDefault()
    setEnrolling(true); setEnrollErr('')
    try {
      const res = await studentAPI.enroll(form)
      const student = res.data.data.student
      const warning = res.data.data.warning
      toast(warning ? `${student.fullName} enrolled. Virtual account pending.` : `${student.fullName} enrolled successfully!` , `Parent code: ${fmtCode(student.linkCode)}`)
      setShowEnroll(false); setForm(INITIAL_FORM); load()
    } catch (err) {
      setEnrollErr(err.response?.data?.message || 'Enrollment failed')
    } finally { setEnrolling(false) }
  }

  const newLinkCode = async (id, hasParent) => {
  if (hasParent && !window.confirm('This unlinks the current parent and issues a new code. Continue?')) return
  try {
    const res = await studentAPI.newLinkCode(id, { replaceParent: hasParent })
    setAccountModal(m => ({ ...m, linkCode: res.data.data.linkCode, hasParent: false }))
    toast('New link code issued'); load()
  } catch (err) { toast(err.response?.data?.message || 'Could not issue a code', 'error') }
}

  const showAccount = async (student) => {
    try {
      const res = await studentAPI.getAccount(student._id)
      setAccountModal({ ...res.data.data, studentName: student.fullName, studentId: student.studentId, _id: student._id, linkCode: student.linkCode, hasParent: !!student.parentId })
    } catch {
      toast('Could not load account details', 'error')
    }
  }

  const [retrying, setRetrying] = useState(null)

const retryProvision = async (studentId) => {
  if (retrying) return
  setRetrying(studentId)
  try {
    const res = await studentAPI.retryProvision(studentId)
    const warning = res.data?.data?.warning
    if (warning) toast(`Partially provisioned: ${warning}`, 'error')
    else toast('Virtual accounts provisioned successfully!')
    load()
  } catch (err) {
    toast(err.response?.data?.message || 'Provisioning failed', 'error')
  } finally {
    setRetrying(null)
  }
}
  const copy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(text); setTimeout(() => setCopied(false), 2000)
  }

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-5 animate-fade-in">
      <Toast toasts={toasts} remove={remove} />

      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Students</h1>
          <p className="page-sub">Manage enrolled students and their payment accounts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPromoteOpen(true)} className="btn-secondary">Promote class</button>
          <button onClick={() => setShowEnroll(true)} className="btn-primary"><Plus size={16} /> Enroll Student</button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name or student ID…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <input className="input w-28" placeholder="Class" value={classFilter}
          onChange={e => { setClass(e.target.value); setPage(1) }} />
        <button onClick={load} className="btn-secondary"><RefreshCw size={15} /></button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table loading={loading} headers={['Student', 'Class', 'Virtual Account', 'Status', 'Enrolled', 'Actions']}>
          {students.length === 0 && !loading
            ? <tr><td colSpan={6} className="py-12">
                <EmptyState icon={GraduationCap} title="No students found"
                  description="Enroll your first student to get started"
                  action={<button onClick={() => setShowEnroll(true)} className="btn-primary mt-2"><Plus size={14} /> Enroll Student</button>} />
              </td></tr>
            : students.map(s => (
              <tr key={s._id}>
                <td>
                  <p className="font-semibold text-gray-900">{s.fullName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.studentId}</p>
                </td>
                <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{s.class}</span></td>
                <td>
                  {(() => {
                    const nomba = s.virtualAccounts?.nomba?.accountNumber
                    const paystack = s.virtualAccounts?.paystack?.accountNumber
                    const missing = !nomba && !paystack ? 'Provision' : !nomba ? '+ Nomba' : !paystack ? '+ Paystack' : null
                    return (
                      <div className="flex items-center gap-2">
                        {nomba || paystack
                          ? <button onClick={() => showAccount(s)} className="font-mono text-xs text-blue-600 hover:underline">
                              {nomba || paystack}{nomba && paystack ? ' +1' : ''}
                            </button>
                          : <span className="text-xs text-gray-400">Pending</span>}
                        {missing && (
                          <button onClick={() => retryProvision(s._id)} disabled={retrying === s._id}
                            className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100 disabled:opacity-50">
                            {retrying === s._id ? '…' : missing}
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </td>
                <td>
                  {s.currentStatus
                    ? <StatusBadge status={s.currentStatus} />
                    : <span className="text-xs text-gray-400">No fee assigned</span>}
                </td>
                <td className="text-xs text-gray-400">{formatDate(s.createdAt)}</td>
                <td className="space-x-3 whitespace-nowrap">
                  <button onClick={() => showAccount(s)} className="text-xs text-blue-600 hover:underline">View →</button>
                  <button onClick={() => openFee(s)} className="text-xs text-gray-500 hover:underline">+ Fee</button>
                </td>
              </tr>
            ))
          }
        </Table>
        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      {/* Enroll Modal */}
      <Modal open={showEnroll} onClose={() => { setShowEnroll(false); setEnrollErr('') }} title="Enroll New Student" size="md">
        {enrollErr && <div className="mb-4"><Alert type="error" message={enrollErr} /></div>}
        <form onSubmit={handleEnroll} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name" required>
              <input className="input" placeholder="Ade Johnson" required value={form.fullName} onChange={set('fullName')} />
            </Field>
            <Field label="Student ID" required>
              <input className="input" placeholder="GF/2024/001" required value={form.studentId} onChange={set('studentId')} />
            </Field>
            <Field label="Class" required>
              <input className="input" placeholder="JSS 1" required value={form.class} onChange={set('class')} />
            </Field>
            <Field label="Gender" required>
              <select className="input" value={form.gender} onChange={set('gender')}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
          </div>
          <Field label="Date of Birth">
            <input type="date" className="input" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
          </Field>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            💡 Nomba and Paystack virtual accounts will be automatically provisioned for this student upon enrollment.
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowEnroll(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={enrolling}>
              {enrolling ? <Spinner size="sm" /> : 'Enroll Student'}
            </button>
          </div>
        </form>
      </Modal>

     {/* Account Modal */}
    
      <Modal open={!!accountModal} onClose={() => setAccountModal(null)} title="Virtual Account Details">
        {accountModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Share these account numbers with parents. Payments reconcile automatically.
            </p>

            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Student</span>
              <span className="font-semibold">{accountModal.studentName} · {accountModal.studentId}</span>
            </div>

             <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
                <p className="text-xs text-gray-500">Parent link code</p>
                {accountModal.linkCode
                  ? <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-lg">{fmtCode(accountModal.linkCode)}</span>
                      <button className="btn-secondary text-xs" onClick={() => copy(fmtCode(accountModal.linkCode))}>Copy</button>
                    </div>
                  : <p className="text-gray-500">{accountModal.hasParent ? 'Linked to a parent.' : 'No active code.'}</p>}
                <button className="text-xs text-blue-600 hover:underline" onClick={() => newLinkCode(accountModal._id, accountModal.hasParent)}>
                  {accountModal.hasParent ? 'Unlink parent and issue new code' : 'Issue a new code'}
                </button>
              </div>
            {accountModal.paymentOptions?.map((opt) => (
              <div key={opt.gateway} className="bg-gray-50 rounded-xl p-5 space-y-3">
                <div className="flex justify-between text-xs uppercase tracking-wide text-gray-400 font-semibold">
                  <span>{opt.gateway}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Account Name</span>
                  <span className="font-semibold">{opt.accountName}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-500">Account Number</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg text-gray-900">{opt.accountNumber}</span>
                    <button onClick={() => copy(opt.accountNumber)} className="p-1.5 hover:bg-gray-200 rounded transition-colors">
                      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Bank</span>
                  <span className="font-semibold">{opt.bankName}</span>
                </div>
              </div>
            ))}

          {accountModal.paymentOptions?.length === 0 && (
            <p className="text-sm text-gray-500">No online account yet. Payments are recorded manually by the bursar.</p>
          )}

           {accountModal.outstandingFees?.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-amber-700">Outstanding Fees</p>
                {accountModal.outstandingFees.map((fee) => (
                  <div key={fee.assignmentId} className="text-xs text-amber-700 space-y-1">
                    <div className="flex justify-between">
                      <span>{fee.name} <button type="button" onClick={() => openAdjust(fee)} className="ml-2 text-blue-600 hover:underline">Adjust</button></span>
                      <span className="font-bold">{formatCurrency(fee.balance)}</span>
                    </div>
                    {Object.entries(fee.amountToPay || {}).map(([gw, p]) => (
                      <div key={gw} className="flex justify-between pl-3 text-amber-800">
                        <span className="capitalize">Transfer via {gw}</span>
                        <span className="font-bold">
                          {formatCurrency(p.totalAmountToPay)}
                          {p.platformFee > 0 && ` (incl. ${formatCurrency(p.platformFee)} service charge)`}
                        </span>
                      </div>
                    ))}
                    {fee.earlyPayment && Object.entries(fee.earlyPayment.amountToPay).map(([gw, p]) => (
                    <div key={`early-${gw}`} className="flex justify-between pl-3 text-green-700">
                      <span className="capitalize">Pay by {formatDate(fee.earlyPayment.deadline)} via {gw}</span>
                      <span className="font-bold">{formatCurrency(p.totalAmountToPay)} (save {formatCurrency(p.youSave)})</span>
                    </div>
                  ))}
                  </div>
                ))}
                <div className="flex justify-between text-xs text-amber-800 font-bold pt-2 border-t border-amber-200">
                  <span>Total Outstanding</span>
                  <span>{formatCurrency(accountModal.totalOutstanding)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Promote Class Modal */}
      <Modal open={promoteOpen} onClose={closePromote} title="Promote Class" size="md">
        {promoteErr && <div className="mb-4"><Alert type="error" message={promoteErr} /></div>}
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            💡 Promote the highest class first (graduate the last class, then JSS 2 → JSS 3, then JSS 1 → JSS 2). Old fee records stay on each student's account.
          </div>
          <Field label="From class" required>
            <input className="input" placeholder="JSS 1" value={promoteForm.fromClass} onChange={setP('fromClass')} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={promoteForm.graduate} onChange={setP('graduate')} />
            Graduating class (deactivate these students instead of moving them)
          </label>
          {promoteForm.graduate ? (
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input type="checkbox" checked={promoteForm.force} onChange={setP('force')} />
              Graduate even students who still owe fees
            </label>
          ) : (
            <Field label="To class" required>
              <input className="input" placeholder="JSS 2" value={promoteForm.toClass} onChange={setP('toClass')} />
            </Field>
          )}

          {promotePreview && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 space-y-2">
              <p>
                <b>{promotePreview.count}</b> student(s) will {promotePreview.action === 'graduate' ? 'graduate' : `move to ${promotePreview.toClass}`}
                {promotePreview.matchedLabels?.length > 1 && ` (matched: ${promotePreview.matchedLabels.join(', ')})`}
              </p>
              {promotePreview.withOutstandingBalance > 0 && (
                <p className="text-amber-700">{promotePreview.withOutstandingBalance} still owe fees. Their old fee records stay on their account.</p>
              )}
              {promotePreview.skippedOwing?.length > 0 && (
                <p className="text-red-600">Skipped (still owing): {promotePreview.skippedOwing.map(s => s.fullName).join(', ')}</p>
              )}
              {promotePreview.warnings?.map((w, i) => <p key={i} className="text-amber-700">⚠ {w}</p>)}
              <ul className="max-h-32 overflow-y-auto list-disc pl-4">
                {promotePreview.students.map(s => <li key={s._id}>{s.fullName} · {s.studentId}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-secondary" onClick={closePromote}>Cancel</button>
            {!promotePreview ? (
              <button className="btn-primary" onClick={() => runPromote(true)}
                disabled={promoting || !promoteForm.fromClass || (!promoteForm.graduate && !promoteForm.toClass)}>
                {promoting ? <Spinner size="sm" /> : 'Preview'}
              </button>
            ) : (
              <button className="btn-primary" onClick={() => runPromote(false)} disabled={promoting}>
                {promoting ? <Spinner size="sm" /> : `Confirm (${promotePreview.count})`}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Hardship Adjusting Modal */}
      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title={`Adjust fee: ${adjusting?.student?.studentName || ''}`} size="sm">
        {adjErr && <div className="mb-4"><Alert type="error" message={adjErr} /></div>}
        <form onSubmit={submitAdjust} className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
            Changing a fee for one student is recorded with your name and the reason below.
            {adjusting?.fee?.totalPaid > 0 && ` ₦${adjusting.fee.totalPaid.toLocaleString()} has already been paid.`}
          </div>
          <Field label="New amount (₦)" required>
            <input type="number" min={1} className="input" required value={adjForm.newAmount}
              onChange={e => setAdjForm(p => ({ ...p, newAmount: e.target.value }))} />
          </Field>
          <Field label="Reason" required>
            <input className="input" placeholder="e.g. Approved hardship, parent applied on 12 Sept" required
              value={adjForm.reason} onChange={e => setAdjForm(p => ({ ...p, reason: e.target.value }))} />
          </Field>
          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-secondary" onClick={() => setAdjusting(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={adjSaving}>{adjSaving ? <Spinner size="sm" /> : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Add Fee Modal */}
      <Modal open={!!feeModal} onClose={() => setFeeModal(null)} title={`Add fee: ${feeModal?.fullName || ''}`} size="md">
        {feeErr && <div className="mb-4"><Alert type="error" message={feeErr} /></div>}
        <form onSubmit={submitFee} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fee name" required>
              <input className="input" placeholder="Uniform" required value={feeForm.name} onChange={setF('name')} />
            </Field>
            <Field label="Amount (₦)" required>
              <input type="number" min="1" className="input" required value={feeForm.amount} onChange={setF('amount')} />
            </Field>
          </div>
          <Field label="Reason (optional)">
            <input className="input" placeholder="e.g. Excursion to museum" value={feeForm.reason} onChange={setF('reason')} />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Term">
              <select className="input" value={feeForm.term} onChange={setF('term')}>
                <option value="">Latest</option>
                <option value="first">First</option>
                <option value="second">Second</option>
                <option value="third">Third</option>
              </select>
            </Field>
            <Field label="Session">
              <input className="input" placeholder="2025/2026" value={feeForm.academicSession} onChange={setF('academicSession')} />
            </Field>
            <Field label="Due date">
              <input type="date" className="input" value={feeForm.dueDate} onChange={setF('dueDate')} />
            </Field>
          </div>
          <p className="text-xs text-gray-400">Leave term, session and due date blank to use this student's latest term.</p>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-secondary" onClick={() => setFeeModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={savingFee}>
              {savingFee ? <Spinner size="sm" /> : 'Add Fee'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}