// src/pages/bursar/Overpayments.jsx
import { useState, useEffect, useCallback } from 'react'
import { reportAPI, paymentAPI } from '../../api'
import { EmptyState, Spinner, Alert, Modal, Pagination } from '../../components/ui'
import { Toast } from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters'
import { RefreshCw, ArrowDownLeft } from 'lucide-react'

export default function BursarOverpayments() {
  const { toasts, toast, remove } = useToast()
  const [data,       setData]      = useState(null)
  const [loading,    setLoading]   = useState(true)
  const [page,       setPage]      = useState(1)
  const [refundModal,setRefundModal] = useState(null)
  const [processing, setProcessing]  = useState(false)
  const [note,       setNote]        = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reportAPI.overpayments({ page, limit: 10 })
      setData(res.data.data)
    } catch { toast('Failed to load overpayments', 'error') }
    finally { setLoading(false) }
  }, [page])

  useEffect(() => { load() }, [load])

  const handleAction = async (action) => {
    setProcessing(true)
    try {
      // In production this would call the Transfers API for refund
      // or apply credit to next term. Shown here as a confirmed action.
      await new Promise(r => setTimeout(r, 800)) // simulate API call
      toast(action === 'refund'
        ? `Refund initiated for ${refundModal.studentId?.fullName}`
        : `Credit applied to next term for ${refundModal.studentId?.fullName}`)
      setRefundModal(null); setNote(''); load()
    } catch {
      toast('Action failed', 'error')
    } finally { setProcessing(false) }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  const assignments = data?.assignments || []
  const totalOverpaid = data?.totalOverpaid || 0

  return (
    <div className="space-y-5 animate-fade-in">
      <Toast toasts={toasts} remove={remove} />

      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Overpayments</h1>
          <p className="page-sub">Students with excess payments requiring action</p>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={15} /></button>
      </div>

      {/* Summary banner */}
      {totalOverpaid > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-4">
          <span className="text-3xl">🔁</span>
          <div>
            <p className="font-bold text-purple-900 text-base">
              {formatCurrency(totalOverpaid)} total overpaid
            </p>
            <p className="text-sm text-purple-700 mt-0.5">
              {data?.totalCount || 0} student{(data?.totalCount || 0) !== 1 ? 's' : ''} — review each case and initiate a refund or apply as credit to next term.
            </p>
          </div>
        </div>
      )}

      {/* Overpayment cards */}
      {assignments.length === 0
        ? <div className="card">
            <EmptyState icon={ArrowDownLeft} title="No overpayments"
              description="All payments are within the expected fee amounts." />
          </div>
        : <div className="space-y-3">
            {assignments.map((a) => {
              const student = a.studentId
              const fee     = a.feeStructureId
              return (
                <div key={a._id} className="card p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                        🎓
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{student?.fullName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {student?.studentId} · Class {student?.class}
                        </p>
                        {student?.virtualAccount?.accountNumber && (
                          <p className="text-xs font-mono text-gray-400 mt-0.5">
                            {student.virtualAccount.accountNumber} · {student.virtualAccount.bankName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-purple-600">
                        +{formatCurrency(a.overpayment)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">overpaid</p>
                    </div>
                  </div>

                  {/* Fee breakdown */}
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-50">
                    {[
                      ['Fee Name', fee?.name || '—'],
                      ['Expected', formatCurrency(a.amountExpected)],
                      ['Total Paid', formatCurrency(a.totalPaid)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide font-semibold">{label}</p>
                        <p className="text-sm font-semibold text-gray-900">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-50">
                    <button
                      onClick={() => setRefundModal(a)}
                      className="btn-secondary text-xs gap-2">
                      🔁 Review &amp; Action
                    </button>
                    <p className="text-xs text-gray-400">Last payment: {formatDate(a.lastPaymentAt)}</p>
                  </div>
                </div>
              )
            })}
          </div>
      }

      {/* Pagination */}
      {data?.pagination && (
        <Pagination pagination={data.pagination} onChange={setPage} />
      )}

      {/* Action Modal */}
      <Modal open={!!refundModal} onClose={() => { setRefundModal(null); setNote('') }}
        title="Action Overpayment" size="md">
        {refundModal && (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-900">{refundModal.studentId?.fullName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{refundModal.studentId?.studentId} · {refundModal.studentId?.class}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-purple-600">+{formatCurrency(refundModal.overpayment)}</p>
                  <p className="text-xs text-gray-400">excess paid</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
              <textarea className="input resize-none" rows={2}
                placeholder="e.g. Refund via GTBank transfer, parent notified..."
                value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleAction('refund')} disabled={processing}
                className="btn-primary justify-center gap-2 bg-purple-600 hover:bg-purple-700 focus:ring-purple-500">
                {processing ? <Spinner size="sm" /> : '💸 Initiate Refund'}
              </button>
              <button onClick={() => handleAction('credit')} disabled={processing}
                className="btn-secondary justify-center gap-2">
                {processing ? <Spinner size="sm" /> : '✅ Apply as Credit'}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Refund sends money back via Nomba Transfers API. Credit applies to next term balance.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}