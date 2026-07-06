// src/pages/parent/ChildBalance.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { parentAPI } from '../../api'
import { Spinner, EmptyState } from '../../components/ui'
import { StatusBadge } from '../../components/ui'
import { formatCurrency, formatDate, termLabel } from '../../utils/formatters'
import { ArrowLeft, CreditCard } from 'lucide-react'

export default function ChildBalance() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    parentAPI.childBalance(studentId)
      .then(res => setData(res.data.data))
      .finally(() => setLoading(false))
  }, [studentId])

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  if (!data)   return null

  const { student, summary, terms } = data

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={() => navigate(-1)} className="btn-ghost text-sm gap-2 -ml-2">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="page-header">
        <h1 className="page-title">{student.fullName} — Fee Balance</h1>
        <p className="page-sub">{student.class} · {student.studentId}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Expected', value: formatCurrency(summary.totalExpected), color: 'text-gray-900' },
          { label: 'Total Paid',     value: formatCurrency(summary.totalPaid),     color: 'text-green-600' },
          { label: 'Balance',        value: formatCurrency(summary.totalBalance),  color: 'text-amber-600' },
          { label: 'Overpaid',       value: formatCurrency(summary.totalOverpaid), color: 'text-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Per-term breakdown */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-900 text-sm">
          Term Breakdown
        </div>
        {terms.length === 0
          ? <EmptyState icon={CreditCard} title="No fee assignments yet" />
          : <div className="divide-y divide-gray-50">
              {terms.map(term => (
                <div key={term._id} className="px-5 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{term.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {termLabel(term.term)} · {term.academicSession}
                      </p>
                    </div>
                    <StatusBadge status={term.status} />
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>Paid: <strong>{formatCurrency(term.totalPaid)}</strong></span>
                      <span>of {formatCurrency(term.amountExpected)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all
                        ${term.status === 'paid' ? 'bg-green-500' :
                          term.status === 'partial' ? 'bg-amber-400' :
                          term.status === 'overpaid' ? 'bg-purple-500' : 'bg-gray-200'}`}
                        style={{ width: `${Math.min((term.totalPaid / term.amountExpected) * 100, 100)}%` }} />
                    </div>
                  </div>

                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    {term.balance > 0     && <span className="text-amber-600 font-semibold">Balance: {formatCurrency(term.balance)}</span>}
                    {term.overpayment > 0 && <span className="text-purple-600 font-semibold">Overpaid: {formatCurrency(term.overpayment)}</span>}
                    {term.dueDate && <span>Due: {formatDate(term.dueDate)}</span>}
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}