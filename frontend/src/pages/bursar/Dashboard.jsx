// src/pages/bursar/Dashboard.jsx
import { useState, useEffect, useCallback } from 'react'
import { reportAPI } from '../../api'
import { useSocket } from '../../context/SocketContext'
import { StatCard, Spinner, EmptyState, Alert } from '../../components/ui'
import { formatCurrency, formatTimeAgo, reconciliationLabel } from '../../utils/formatters'
import { TrendingUp, AlertTriangle, Users, Wallet, RefreshCw, Zap } from 'lucide-react'

const MAX_FEED = 50

export default function BursarDashboard() {
  const { on, off }           = useSocket() || {}
  const [summary, setSummary] = useState(null)
  const [feed,    setFeed]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const loadSummary = useCallback(async () => {
    try {
      const [sumRes, recentRes] = await Promise.all([
        reportAPI.schoolSummary(),
        reportAPI.recentPayments({ limit: 20 }),
      ])
      setSummary(sumRes.data.data)
      // Seed feed with recent payments from DB on first load
      const recent = recentRes.data.data?.payments || []
      setFeed(prev => {
        const existingRefs = new Set(prev.map(e => e.reference))
        const newOnes = recent
          .filter(p => !existingRefs.has(p.reference))
          .map(p => ({
            reference:            p.reference,
            studentName:          p.studentId?.fullName || '—',
            studentCode:          p.studentId?.studentId || '—',
            class:                p.studentId?.class || '—',
            amountPaid:           p.amountPaid,
            reconciliationStatus: p.reconciliationStatus,
            balanceAfter:         p.balanceAfter,
            overpayment:          p.overpaymentAmount,
            feeName:              p.feeAssignmentId?.feeStructureId?.name,
            processedAt:          p.processedAt,
            source:               p.source,
          }))
        return [...prev, ...newOnes].slice(0, MAX_FEED)
      })
    } catch { setError('Could not load dashboard data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSummary() }, [loadSummary])

  // Live Socket.io payments
  useEffect(() => {
    if (!on) return
    const handler = (event) => {
      setFeed(prev => [event, ...prev].slice(0, MAX_FEED))
      loadSummary()
    }
    on('payment:reconciled', handler)
    return () => off?.('payment:reconciled', handler)
  }, [on, off, loadSummary])

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  const c = summary?.collection || {}

  const dotColor = {
    exact:        'bg-green-400',
    underpayment: 'bg-amber-400',
    overpayment:  'bg-purple-400',
  }
  const tagColor = {
    exact:        'bg-green-50 text-green-700',
    underpayment: 'bg-amber-50 text-amber-700',
    overpayment:  'bg-purple-50 text-purple-700',
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Bursar Dashboard</h1>
          <p className="page-sub">{summary?.school?.name || 'School'} · Live reconciliation</p>
        </div>
        <button onClick={loadSummary} className="btn-secondary gap-2">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Collected"  value={formatCurrency(c.totalCollected)}  sub={`${c.fullyPaid || 0} fully paid`}          accent="green"  icon={TrendingUp} />
        <StatCard label="Outstanding"      value={formatCurrency(c.totalOutstanding)} sub={`${c.partialCount || 0} partial payments`}  accent="amber"  icon={AlertTriangle} />
        <StatCard label="Total Students"   value={c.totalStudents || 0}              sub="enrolled this term"                         accent="blue"   icon={Users} />
        <StatCard label="Overpayments"     value={formatCurrency(c.totalOverpaid)}   sub={`${c.overpaidCount || 0} to review`}        accent="purple" icon={Wallet} />
      </div>

      {/* Collection progress */}
      {c.totalExpected > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Collection Progress</p>
            <span className="text-sm font-bold text-blue-600">
              {Math.round((c.totalCollected / c.totalExpected) * 100)}%
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700"
              style={{ width: `${Math.min((c.totalCollected / c.totalExpected) * 100, 100)}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{formatCurrency(c.totalCollected)} collected</span>
            <span>{formatCurrency(c.totalExpected)} expected</span>
          </div>
          {/* Status breakdown */}
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100 text-center">
            {[
              { label: 'Paid',     value: c.fullyPaid    || 0, color: 'text-green-600' },
              { label: 'Partial',  value: c.partialCount || 0, color: 'text-amber-600' },
              { label: 'Unpaid',   value: c.unpaidCount  || 0, color: 'text-red-500'   },
              { label: 'Overpaid', value: c.overpaidCount|| 0, color: 'text-purple-600' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className={`text-xl font-black ${color}`}>{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live feed */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <Zap size={16} className="text-blue-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Live Payment Feed</h2>
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_0_3px_#bbf7d0] inline-block" />
            <span className="text-xs bg-green-50 text-green-700 border border-green-100 rounded-full px-2 py-0.5 font-bold">LIVE</span>
          </div>
          <span className="text-xs text-gray-400">{feed.length} event{feed.length !== 1 ? 's' : ''}</span>
        </div>

        {feed.length === 0
          ? <EmptyState icon={Zap} title="Waiting for payments"
              description="Inbound transfers appear here instantly as they are reconciled." />
          : <div className="divide-y divide-gray-50">
              {feed.map((event, i) => (
                <div key={`${event.reference}-${i}`}
                  className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                  {/* Status dot */}
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dotColor[event.reconciliationStatus] || 'bg-gray-300'}`} />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-gray-900">{event.studentName}</p>
                      <span className="text-xs text-gray-400">· {event.studentCode}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tagColor[event.reconciliationStatus]}`}>
                        {reconciliationLabel(event.reconciliationStatus)}
                      </span>
                      {i === 0 && (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5 font-bold">NEW</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {event.feeName || `Class ${event.class}`}
                      {event.source && ` · via ${event.source}`}
                    </p>
                    {event.reconciliationStatus === 'underpayment' && event.balanceAfter > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5 font-medium">
                        Balance: {formatCurrency(event.balanceAfter)}
                      </p>
                    )}
                    {event.reconciliationStatus === 'overpayment' && (
                      <p className="text-xs text-purple-600 mt-0.5 font-medium">
                        Overpaid by {formatCurrency(event.overpayment)} — review required
                      </p>
                    )}
                  </div>

                  {/* Amount + time */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">
                      +{formatCurrency(event.amountPaid)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatTimeAgo(event.processedAt || event.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}