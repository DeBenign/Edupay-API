// src/pages/bursar/StudentDetail.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { studentAPI, paymentAPI, feeAPI } from '../../api'
import { StatusBadge, Spinner, EmptyState, Alert, Modal, Field } from '../../components/ui'
import { Toast } from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDateTime, formatDate, reconciliationLabel } from '../../utils/formatters'
import { ArrowLeft, Copy, Check, RefreshCw, Plus } from 'lucide-react'

export default function BursarStudentDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { toasts, toast, remove } = useToast()

  const [student,     setStudent]     = useState(null)
  const [assignments, setAssignments] = useState([])
  const [payments,    setPayments]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [copied,      setCopied]      = useState(false)
  const [syncing,     setSyncing]     = useState(false)
  const [showManual,  setShowManual]  = useState(false)
  const [manualForm,  setManualForm]  = useState({ amountPaid: '', reference: '', narration: '' })
  const [paying,      setPaying]      = useState(false)
  const [payErr,      setPayErr]      = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [sRes, pRes] = await Promise.all([
        studentAPI.get(id),
        paymentAPI.getStudentHistory(id, { limit: 50 }),
      ])
      setStudent(sRes.data.data.student)
      setAssignments(sRes.data.data.feeAssignments || [])
      setPayments(pRes.data.data.payments || [])
    } catch { toast('Failed to load student', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await paymentAPI.syncStudent(id)
      const { processed, skipped } = res.data.data
      toast(`Sync complete — ${processed} new, ${skipped} already recorded`)
      load()
    } catch { toast('Sync failed', 'error') }
    finally { setSyncing(false) }
  }

  const handleManualPayment = async (e) => {
    e.preventDefault(); setPaying(true); setPayErr('')
    try {
      await paymentAPI.manualEntry({
        studentId:  id,
        amountPaid: Number(manualForm.amountPaid),
        reference:  manualForm.reference,
        narration:  manualForm.narration,
      })
      toast('Payment recorded successfully!')
      setShowManual(false)
      setManualForm({ amountPaid: '', reference: '', narration: '' })
      load()
    } catch (er) {
      setPayErr(er.response?.data?.message || 'Failed to record payment')
    } finally { setPaying(false) }
  }

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  if (!student) return <Alert type="error" message="Student not found" />

  const totalExpected  = assignments.reduce((s, a) => s + a.amountExpected, 0)
  const totalPaid      = assignments.reduce((s, a) => s + a.totalPaid, 0)
  const totalBalance   = assignments.reduce((s, a) => s + a.balance, 0)
  const totalOverpaid  = assignments.reduce((s, a) => s + a.overpayment, 0)
  const progressPct    = totalExpected > 0 ? Math.min((totalPaid / totalExpected) * 100, 100) : 0

  const icons  = { exact: '✅', underpayment: '⚠️', overpayment: '🔁' }
  const colors = {
    exact:        'bg-green-50 text-green-700 border-green-100',
    underpayment: 'bg-amber-50 text-amber-700 border-amber-100',
    overpayment:  'bg-purple-50 text-purple-700 border-purple-100',
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Toast toasts={toasts} remove={remove} />

      <button onClick={() => navigate(-1)} className="btn-ghost text-sm gap-2 -ml-2">
        <ArrowLeft size={16} /> Back to Students
      </button>

      {/* Student header card */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Avatar + info */}
          <div className="flex items-center gap-4 flex-1">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0
              ${student.gender === 'male' ? 'bg-blue-50' : 'bg-pink-50'}`}>
              {student.gender === 'male' ? '👦' : '👧'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">{student.fullName}</h2>
                <StatusBadge status={assignments[0]?.status || 'unpaid'} />
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                {student.studentId} · Class {student.class}
              </p>
              {student.parentId && (
                <p className="text-xs text-gray-400 mt-1">
                  Parent: {student.parentId.fullName} · {student.parentId.phone || student.parentId.email}
                </p>
              )}
            </div>
          </div>

          {/* Financial summary */}
          <div className="flex gap-5 sm:border-l sm:pl-5 border-gray-100">
            {[
              ['Expected',   formatCurrency(totalExpected),  'text-gray-900'],
              ['Paid',       formatCurrency(totalPaid),      'text-green-600'],
              ['Balance',    formatCurrency(totalBalance),   'text-amber-600'],
              ['Overpaid',   formatCurrency(totalOverpaid),  'text-purple-600'],
            ].map(([l, v, c]) => (
              <div key={l} className="text-center">
                <p className={`text-base font-black ${c}`}>{v}</p>
                <p className="text-xs text-gray-400 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        {totalExpected > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Payment progress</span>
              <span className="font-semibold text-gray-600">{Math.round(progressPct)}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${
                progressPct === 100 ? 'bg-green-500' : 'bg-blue-500'
              }`} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-50">
          <button onClick={() => setShowManual(true)} className="btn-primary text-xs gap-2">
            <Plus size={13} /> Record Payment
          </button>
          <button onClick={handleSync} disabled={syncing} className="btn-secondary text-xs gap-2">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Transactions'}
          </button>
        </div>
      </div>

      {/* Virtual account */}
      {student.virtualAccount?.accountNumber && (
        <div className="card p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            Virtual Account (Payment Account)
          </p>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-xl font-black text-gray-900">
                {student.virtualAccount.accountNumber}
              </span>
              <span className="text-sm text-gray-400 ml-3">· {student.virtualAccount.bankName}</span>
              <p className="text-xs text-gray-400 mt-1">{student.virtualAccount.accountName}</p>
            </div>
            <button onClick={() => copy(student.virtualAccount.accountNumber)}
              className="btn-secondary text-xs gap-2">
              {copied ? <><Check size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
        </div>
      )}

      {/* Fee assignments */}
      {assignments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-900 text-sm">
            Fee Assignments ({assignments.length})
          </div>
          <div className="divide-y divide-gray-50">
            {assignments.map(a => (
              <div key={a._id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{a.feeStructureId?.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.feeStructureId?.term} term · {a.feeStructureId?.academicSession} · Due {formatDate(a.feeStructureId?.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(a.totalPaid)}</p>
                    <p className="text-xs text-gray-400">of {formatCurrency(a.amountExpected)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-semibold text-gray-900 text-sm">Payment History</span>
          <span className="text-xs text-gray-400">{payments.length} record{payments.length !== 1 ? 's' : ''}</span>
        </div>
        {payments.length === 0
          ? <EmptyState icon={RefreshCw} title="No payments yet"
              description="Payments appear here after webhook events or manual entry." />
          : <div className="divide-y divide-gray-50">
              {payments.map(p => (
                <div key={p._id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/50">
                  <span className="text-lg flex-shrink-0 mt-0.5">{icons[p.reconciliationStatus]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors[p.reconciliationStatus]}`}>
                        {reconciliationLabel(p.reconciliationStatus)}
                      </span>
                      <span className="text-xs font-mono text-gray-400">{p.reference}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded capitalize
                        ${p.source === 'webhook' ? 'bg-blue-50 text-blue-600' :
                          p.source === 'manual'  ? 'bg-gray-100 text-gray-500' :
                                                   'bg-amber-50 text-amber-600'}`}>
                        {p.source}
                      </span>
                    </div>
                    {p.payerAccountName && (
                      <p className="text-xs text-gray-400">
                        From: {p.payerAccountName}{p.payerBankName ? ` · ${p.payerBankName}` : ''}
                      </p>
                    )}
                    {p.narration && <p className="text-xs text-gray-400 italic mt-0.5">{p.narration}</p>}
                    <p className="text-xs text-gray-300 mt-1">
                      Balance: {formatCurrency(p.balanceBefore)} → {formatCurrency(p.balanceAfter)}
                      {p.overpaymentAmount > 0 && ` · Overpaid: ${formatCurrency(p.overpaymentAmount)}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900">+{formatCurrency(p.amountPaid)}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(p.processedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Manual Payment Modal */}
      <Modal open={showManual} onClose={() => { setShowManual(false); setPayErr('') }}
        title="Record Manual Payment" size="sm">
        {payErr && <div className="mb-4"><Alert type="error" message={payErr} /></div>}
        <form onSubmit={handleManualPayment} className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
            ⚠️ Use for cash or cheque payments only. Bank transfers reconcile automatically via webhook.
          </div>
          <Field label="Amount Paid (₦)" required>
            <input type="number" className="input" placeholder="20000" required min={1}
              value={manualForm.amountPaid}
              onChange={e => setManualForm(p => ({...p, amountPaid: e.target.value}))} />
          </Field>
          <Field label="Payment Reference" required>
            <input className="input" placeholder="e.g. CASH-2024-001" required
              value={manualForm.reference}
              onChange={e => setManualForm(p => ({...p, reference: e.target.value}))} />
          </Field>
          <Field label="Narration">
            <input className="input" placeholder="e.g. Cash payment at school office"
              value={manualForm.narration}
              onChange={e => setManualForm(p => ({...p, narration: e.target.value}))} />
          </Field>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => setShowManual(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={paying}>
              {paying ? <Spinner size="sm" /> : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}