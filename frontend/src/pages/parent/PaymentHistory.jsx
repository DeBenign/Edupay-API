// src/pages/parent/PaymentHistory.jsx
// Shows payment history across ALL children
import { useState, useEffect } from 'react'
import { parentAPI } from '../../api'
import { Spinner, EmptyState } from '../../components/ui'
import { formatCurrency, formatDateTime, reconciliationLabel } from '../../utils/formatters'
import { CreditCard } from 'lucide-react'

export default function PaymentHistory() {
  const [children, setChildren] = useState([])
  const [selected, setSelected] = useState('')
  const [payments, setPayments] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [loadingP, setLoadingP] = useState(false)
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    parentAPI.children()
      .then(res => {
        const kids = res.data.data.children
        setChildren(kids)
        if (kids.length > 0) setSelected(kids[0]._id)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoadingP(true)
    parentAPI.childPayments(selected, { page, limit: 15 })
      .then(res => {
        setPayments(res.data.data.payments)
        setPagination(res.data.pagination)
      })
      .finally(() => setLoadingP(false))
  }, [selected, page])

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  const icons = { exact: '✅', underpayment: '⚠️', overpayment: '🔁' }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Payment History</h1>
        <p className="page-sub">All fee payments across your children</p>
      </div>

      {children.length === 0
        ? <div className="card"><EmptyState icon={CreditCard} title="No children linked yet" description="Link a child first to view payment history." /></div>
        : <>
            {/* Child selector */}
            {children.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {children.map(c => (
                  <button key={c._id} onClick={() => { setSelected(c._id); setPage(1) }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all
                      ${selected === c._id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                    {c.fullName}
                  </button>
                ))}
              </div>
            )}

            {/* Payment list */}
            <div className="card overflow-hidden">
              {loadingP
                ? <div className="flex justify-center py-12"><Spinner /></div>
                : payments.length === 0
                  ? <EmptyState icon={CreditCard} title="No payments yet" description="Payments will appear here after transfers are made." />
                  : <>
                      <div className="divide-y divide-gray-50">
                        {payments.map(p => (
                          <div key={p._id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/50">
                            <div className="text-xl flex-shrink-0 mt-0.5">{icons[p.reconciliationStatus]}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900 text-sm">
                                  {p.termName || p.term || 'School Fees'}
                                </span>
                                {p.academicSession && (
                                  <span className="text-xs text-gray-400">· {p.academicSession}</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Ref: <span className="font-mono">{p.reference}</span>
                              </p>
                              {p.payerBankName && (
                                <p className="text-xs text-gray-400 mt-0.5">Via {p.payerBankName}</p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {reconciliationLabel(p.reconciliationStatus)}
                                {p.reconciliationStatus === 'underpayment' && p.balanceAfter > 0 &&
                                  ` · Balance left: ${formatCurrency(p.balanceAfter)}`}
                                {p.reconciliationStatus === 'overpayment' &&
                                  ` · Overpaid: ${formatCurrency(p.overpaymentAmount)}`}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-gray-900">+{formatCurrency(p.amountPaid)}</p>
                              <p className="text-xs text-gray-400 mt-1">{formatDateTime(p.processedAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
                          <span>{pagination.totalCount} payment{pagination.totalCount !== 1 ? 's' : ''}</span>
                          <div className="flex gap-2">
                            <button className="btn-secondary py-1.5 px-3" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Prev</button>
                            <span className="px-2 flex items-center">Page {page} of {pagination.totalPages}</span>
                            <button className="btn-secondary py-1.5 px-3" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p+1)}>Next</button>
                          </div>
                        </div>
                      )}
                    </>
              }
            </div>
          </>
      }
    </div>
  )
}