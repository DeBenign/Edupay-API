// src/pages/parent/ChildPayments.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { parentAPI } from '../../api'
import { Spinner, EmptyState } from '../../components/ui'
import { formatCurrency, formatDateTime, reconciliationLabel } from '../../utils/formatters'
import { ArrowLeft, CreditCard } from 'lucide-react'

export default function ChildPayments() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const [data,       setData]       = useState(null)
  const [payments,   setPayments]   = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)

  useEffect(() => {
    setLoading(true)
    parentAPI.childPayments(studentId, { page, limit: 15 })
      .then(res => {
        setData(res.data.data.student)
        setPayments(res.data.data.payments)
        setPagination(res.data.pagination)
      })
      .finally(() => setLoading(false))
  }, [studentId, page])

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  const icons = { exact: '✅', underpayment: '⚠️', overpayment: '🔁' }
  const colors = {
    exact:        'bg-green-50 text-green-700',
    underpayment: 'bg-amber-50 text-amber-700',
    overpayment:  'bg-purple-50 text-purple-700',
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={() => navigate(-1)} className="btn-ghost text-sm gap-2 -ml-2">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="page-header">
        <h1 className="page-title">{data?.fullName} — Payment History</h1>
        <p className="page-sub">{data?.studentId} · {pagination?.totalCount || 0} payment{(pagination?.totalCount || 0) !== 1 ? 's' : ''}</p>
      </div>

      <div className="card overflow-hidden">
        {payments.length === 0
          ? <EmptyState icon={CreditCard} title="No payments yet"
              description="Payments will appear here after bank transfers are made to the student's account." />
          : <>
              <div className="divide-y divide-gray-50">
                {payments.map(p => (
                  <div key={p._id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                    {/* Status icon */}
                    <div className={`text-lg flex-shrink-0 mt-0.5`}>{icons[p.reconciliationStatus]}</div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[p.reconciliationStatus]}`}>
                          {reconciliationLabel(p.reconciliationStatus)}
                        </span>
                        {p.termName && <span className="text-xs text-gray-500">{p.termName}</span>}
                      </div>
                      <p className="text-xs text-gray-400">
                        Ref: <span className="font-mono">{p.reference}</span>
                      </p>
                      {p.payerAccountName && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          From: {p.payerAccountName}
                          {p.payerBankName && ` · ${p.payerBankName}`}
                        </p>
                      )}
                      {p.narration && (
                        <p className="text-xs text-gray-400 mt-0.5 italic">{p.narration}</p>
                      )}
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                        <span>Before: {formatCurrency(p.balanceBefore)}</span>
                        <span>→</span>
                        <span className={p.balanceAfter === 0 ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                          After: {formatCurrency(p.balanceAfter)}
                        </span>
                        {p.overpaymentAmount > 0 && (
                          <span className="text-purple-600 font-semibold">
                            Overpaid: {formatCurrency(p.overpaymentAmount)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount + time */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-900">+{formatCurrency(p.amountPaid)}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDateTime(p.processedAt)}</p>
                      <span className="text-xs text-gray-300 capitalize">{p.source}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
                  <span>{pagination.totalCount} total</span>
                  <div className="flex gap-2">
                    <button className="btn-secondary py-1.5 px-3" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Previous</button>
                    <span className="px-2 flex items-center">Page {page} of {pagination.totalPages}</span>
                    <button className="btn-secondary py-1.5 px-3" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p+1)}>Next</button>
                  </div>
                </div>
              )}
            </>
        }
      </div>
    </div>
  )
}