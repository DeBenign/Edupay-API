// src/pages/platform/Overview.jsx: the EduPay owner's home. Identity, status and billing only. No school revenue.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { schoolAPI, subscriptionAPI } from '../../api'
import { StatCard, Spinner, Alert } from '../../components/ui'
import { ShieldCheck, Building2, CreditCard, Lock, Clock } from 'lucide-react'
import SubscriptionCountdown from '../../components/SubscriptionCountdown'

export default function PlatformOverview() {
  const [data, setData]       = useState(null)
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    Promise.all([schoolAPI.applications('pending,needs_info'), subscriptionAPI.schools()])
      .then(([a, s]) => { setData(a.data.data); setSchools(s.data.data.schools) })
      .catch((err) => setError(err.response?.data?.message || 'Could not load the overview'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  const c = data?.counts || {}
  const waiting = (c.pending || 0) + (c.needs_info || 0)
  const due     = schools.filter((s) => s.status === 'due' && !s.locked).length
  const locked  = schools.filter((s) => s.locked).length
  // Follow-up list: ending within 14 days, in grace, or locked. Most urgent first (the API already sorts by end date).
  const followUp = schools.filter((s) => s.locked || s.status === 'due' || s.daysLeft <= 14)
  const endingSoon = followUp.filter((s) => !s.locked && s.status !== 'due').length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Platform Overview</h1>
        <p className="page-sub">Schools applying to EduPay, and who owes a subscription</p>
      </div>

      {error && <Alert type="error" message={error} />}
      {data && !data.emailConfigured && (
        <Alert type="warning" message="Email is not configured on this server, so verification, approval and reminder emails are not being sent. Set SMTP_HOST, SMTP_USER, SMTP_PASS and EMAIL_FROM." />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Awaiting approval" value={waiting} sub={`${c.pending || 0} new · ${c.needs_info || 0} need info`} accent="amber" icon={ShieldCheck} />
        <StatCard label="Approved schools"  value={c.approved || 0} sub={`${c.suspended || 0} suspended`} accent="green" icon={Building2} />
        <StatCard label="Ending in 14 days" value={endingSoon} sub="follow up now" accent="blue" icon={Clock} />
        <StatCard label="Subscription due"  value={due} sub="in grace period" accent="red" icon={CreditCard} />
        <StatCard label="Locked"            value={locked} sub="payment needed" accent="purple" icon={Lock} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Subscription follow-up</h2>
          <p className="text-xs text-gray-400">Schools ending within 14 days, overdue, or locked</p>
        </div>
        {followUp.length === 0 && <p className="px-5 py-4 text-sm text-gray-400">Nobody needs a follow-up right now.</p>}
        {followUp.map((s) => (
          <div key={s.schoolId} className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-50 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{s.name}</p>
              <p className="text-xs text-gray-400 truncate">{s.phone || s.email}</p>
            </div>
            <SubscriptionCountdown sub={s} />
          </div>
        ))}
      </div>

      <div className="card p-5 flex flex-wrap gap-3">
        <Link to="/platform/approvals" className="btn-primary">Review applications</Link>
        <Link to="/platform/subscriptions" className="btn-secondary">Record a subscription payment</Link>
      </div>
    </div>
  )
}
