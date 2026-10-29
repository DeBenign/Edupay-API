// src/pages/platform/Overview.jsx: the EduPay owner's home. Identity, status and billing only. No school revenue.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { schoolAPI, subscriptionAPI } from '../../api'
import { StatCard, Spinner, Alert } from '../../components/ui'
import { ShieldCheck, Building2, CreditCard, Lock } from 'lucide-react'

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Awaiting approval" value={waiting} sub={`${c.pending || 0} new · ${c.needs_info || 0} need info`} accent="amber" icon={ShieldCheck} />
        <StatCard label="Approved schools"  value={c.approved || 0} sub={`${c.suspended || 0} suspended`} accent="green" icon={Building2} />
        <StatCard label="Subscription due"  value={due} sub="in grace period" accent="red" icon={CreditCard} />
        <StatCard label="Locked"            value={locked} sub="payment needed" accent="purple" icon={Lock} />
      </div>

      <div className="card p-5 flex flex-wrap gap-3">
        <Link to="/platform/approvals" className="btn-primary">Review applications</Link>
        <Link to="/platform/subscriptions" className="btn-secondary">Record a subscription payment</Link>
      </div>
    </div>
  )
}
