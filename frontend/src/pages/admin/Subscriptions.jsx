import { useEffect, useState, useCallback } from 'react'
import { subscriptionAPI } from '../../api'
import { Spinner, Alert } from '../../components/ui'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function Subscriptions() {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    try { setSchools((await subscriptionAPI.schools()).data.data.schools) }
    catch (err) { setMsg({ type: 'error', text: err.response?.status === 403 ? 'Platform admin only' : 'Could not load subscriptions' }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const record = async (s) => {
    const amount = window.prompt(`Amount received from ${s.name} (₦)`, String(s.amountDue))
    if (!amount) return
    const reference = window.prompt('Bank transfer reference')
    if (!reference) return
    try {
      await subscriptionAPI.record(s.schoolId, { amount: Number(amount), reference: reference.trim(), terms: 1 })
      setMsg({ type: 'success', text: 'Payment recorded' }); load()
    } catch (err) { setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to record payment' }) }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header"><h1 className="page-title">Subscriptions</h1><p className="page-sub">Schools, their status and payments</p></div>
      {msg && <Alert type={msg.type} message={msg.text} onClose={() => setMsg(null)} />}
      <div className="card overflow-hidden">
        {schools.map(s => (
          <div key={s.schoolId} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 text-sm">
            <div>
              <p className="font-semibold text-gray-900">{s.name}</p>
              <p className="text-xs text-gray-400">{s.declaredStudents} declared · {s.enrolledStudents} enrolled · bills {s.billableStudents} · {s.phone || s.email}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={s.status === 'due' ? 'text-red-600' : s.status === 'active' ? 'text-green-600' : 'text-amber-600'}>
                {s.status} · until {formatDate(s.activeUntil)}
              </span>
              <button className="text-xs text-blue-600 hover:underline" onClick={() => record(s)}>Record {formatCurrency(s.amountDue)}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}