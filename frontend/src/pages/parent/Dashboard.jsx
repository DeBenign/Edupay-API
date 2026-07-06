// src/pages/parent/Dashboard.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { parentAPI } from '../../api'
import { StatusBadge, Spinner, Alert, EmptyState } from '../../components/ui'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { GraduationCap, Copy, Check, ArrowRight, AlertCircle, BookOpen, Bell } from 'lucide-react'

export default function ParentDashboard() {
  const navigate = useNavigate()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [copied,  setCopied]  = useState(null)

  useEffect(() => {
    parentAPI.dashboard()
      .then(res => setData(res.data.data))
      .catch(() => setError('Could not load your dashboard'))
      .finally(() => setLoading(false))
  }, [])

  const copy = (accountNumber, id) => {
    navigator.clipboard.writeText(accountNumber)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  if (error)   return <Alert type="error" message={error} />

  const { summary, children } = data || {}

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">My Children</h1>
        <p className="page-sub">Track fee payments and account details</p>
      </div>

      {/* Summary strip */}
      {summary?.totalChildren > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{summary.totalChildren}</p>
            <p className="text-xs text-gray-500 mt-0.5">Children</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(summary.totalOwed)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Outstanding</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{summary.fullyPaid}</p>
            <p className="text-xs text-gray-500 mt-0.5">Fully Paid</p>
          </div>
        </div>
      )}

      {/* No children linked */}
      {children?.length === 0 && (
        <div className="card p-8">
          <EmptyState
            icon={BookOpen}
            title="No children linked yet"
            description="Ask your school admin to link your account, or use your school-issued student ID to link your child."
            action={
              <button onClick={() => navigate('/parent/children')} className="btn-primary mt-2">
                Link a child
              </button>
            }
          />
        </div>
      )}

      {/* Child cards */}
      <div className="space-y-4">
        {children?.map(child => (
          <div key={child._id} className="card overflow-hidden">
            {/* Child header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-blue-600">
                    {child.fullName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{child.fullName}</p>
                  <p className="text-xs text-gray-400">{child.class} · ID: {child.studentId}</p>
                </div>
              </div>
              {child.currentTerm && <StatusBadge status={child.currentTerm.status} />}
            </div>

            {/* Current term fees */}
            {child.currentTerm ? (
              <div className="px-5 py-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {child.currentTerm.name}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(child.currentTerm.dueDate)}</span>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600">Paid: <strong className="text-gray-900">{formatCurrency(child.currentTerm.totalPaid)}</strong></span>
                    <span className="text-gray-400">of {formatCurrency(child.currentTerm.amountExpected)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      child.currentTerm.status === 'paid'     ? 'bg-green-500' :
                      child.currentTerm.status === 'partial'  ? 'bg-amber-400' :
                      child.currentTerm.status === 'overpaid' ? 'bg-purple-500' : 'bg-gray-200'
                    }`}
                      style={{ width: `${Math.min((child.currentTerm.totalPaid / child.currentTerm.amountExpected) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Balance / overpayment */}
                {child.currentTerm.balance > 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    <AlertCircle size={14} />
                    Balance remaining: <strong>{formatCurrency(child.currentTerm.balance)}</strong>
                  </div>
                )}
                {child.currentTerm.status === 'paid' && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    ✓ Fully paid — no outstanding balance
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 py-4 text-sm text-gray-400">No fees assigned for this term yet.</div>
            )}

            {/* Account number */}
            {child.accountNumber && (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Pay fees to this account:</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm font-bold text-gray-900">{child.accountNumber}</span>
                    <span className="text-xs text-gray-400 ml-2">· {child.bankName}</span>
                  </div>
                  <button onClick={() => copy(child.accountNumber, child._id)}
                    className="btn-ghost py-1.5 px-2 text-xs gap-1.5">
                    {copied === child._id ? <><Check size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy</>}
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
              <button onClick={() => navigate(`/parent/children/${child._id}/payments`)}
                className="btn-ghost text-xs gap-1.5">
                Payment history <ArrowRight size={13} />
              </button>
              <button onClick={() => navigate(`/parent/children/${child._id}/balance`)}
                className="btn-ghost text-xs gap-1.5">
                All terms <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
