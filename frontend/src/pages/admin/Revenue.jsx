// src/pages/admin/Revenue.jsx  (admin: full access, bursar: view only)
import { useEffect, useState, useCallback } from 'react'
import { revenueAPI, withdrawalAPI, schoolAPI } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Spinner, StatCard, Alert } from '../../components/ui'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function Revenue() {
  const { user }  = useAuth()
  const schoolId  = user?.schoolId
  const isAdmin   = user?.role === 'admin'
  const [revenue,     setRevenue]     = useState(null)
  const [withdrawals, setWithdrawals] = useState([])
  const [bank,        setBank]        = useState({ accountNumber: '', bankCode: '', accountName: '' })
  const [hasBank,     setHasBank]     = useState(false)
  const [amount,      setAmount]      = useState('')
  const [loading,     setLoading]     = useState(true)
  const [busy,        setBusy]        = useState(false)
  const [msg,         setMsg]         = useState(null)

  const load = useCallback(async () => {
    if (!schoolId) return setLoading(false)
    try {
      const [r, w, s] = await Promise.all([
        revenueAPI.school(schoolId),
        withdrawalAPI.historySchool(schoolId),
        schoolAPI.getmine(),
      ])
      setRevenue(r.data.data.revenue)
      setWithdrawals(w.data.data.withdrawals)
      const pb = s.data.data.school.payoutBank || {}
      setBank({ accountNumber: pb.accountNumber || '', bankCode: pb.bankCode || '', accountName: pb.accountName || '' })
      setHasBank(!!pb.accountNumber)
    } catch { setMsg({ type: 'error', text: 'Could not load revenue' }) }
    finally { setLoading(false) }
  }, [schoolId])

  useEffect(() => { load() }, [load])

  const run = async (fn, fallback) => {
    setBusy(true); setMsg(null)
    try { const res = await fn(); setMsg({ type: 'success', text: res.data?.message || fallback }); await load() }
    catch (err) { setMsg({ type: 'error', text: err.response?.data?.message || 'Request failed' }) }
    finally { setBusy(false) }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  if (!schoolId) return <Alert type="error" message="You are not linked to a school yet" />

  const set = (k) => (e) => setBank(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Revenue</h1>
        <p className="page-sub">What your school has collected and what you can withdraw</p>
      </div>

      {msg && <Alert type={msg.type} message={msg.text} onClose={() => setMsg(null)} />}

      {revenue && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total revenue"         value={formatCurrency(revenue.totalRevenue)} />
          <StatCard label="Cash recorded"         value={formatCurrency(revenue.manualRevenue)} />
          <StatCard label="Held for refunds"      value={formatCurrency(revenue.heldForRefunds)} />
          <StatCard label="Withdrawn"             value={formatCurrency(revenue.totalWithdrawn)} />
          <StatCard label="Available to withdraw" value={formatCurrency(revenue.availableToWithdraw)} />
        </div>
      )}
      <p className="text-xs text-gray-400">Cash you record is already in the school's hands. Only money paid online can be withdrawn here.</p>

      {isAdmin && (
        <div className="grid md:grid-cols-2 gap-4">
          <form className="card p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => schoolAPI.update(schoolId, { payoutBank: bank }), 'Payout account saved') }}>
            <h2 className="font-semibold text-gray-900 text-sm">Payout account</h2>
            <input className="input" placeholder="Account number (10 digits)" required value={bank.accountNumber} onChange={set('accountNumber')} />
            <input className="input" placeholder="Bank code (e.g. 058)" required value={bank.bankCode} onChange={set('bankCode')} />
            <input className="input" placeholder="Account name" required value={bank.accountName} onChange={set('accountName')} />
            <button className="btn-secondary w-full" disabled={busy}>Save payout account</button>
          </form>

          <form className="card p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => withdrawalAPI.requestSchool(schoolId, { amount: Number(amount) }), 'Withdrawal requested').then(() => setAmount('')) }}>
            <h2 className="font-semibold text-gray-900 text-sm">Request withdrawal</h2>
            <p className="text-xs text-gray-500">
              {hasBank ? `Money goes to ${bank.accountName} · ${bank.accountNumber}` : 'Save a payout account first.'}
            </p>
            <input className="input" type="number" min="1" placeholder="Amount (₦)" required value={amount} onChange={e => setAmount(e.target.value)} />
            <button className="btn-primary w-full" disabled={busy || !hasBank}>{busy ? <Spinner size="sm" /> : 'Withdraw'}</button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-900 text-sm">Withdrawal history</div>
        {withdrawals.length === 0
          ? <p className="px-5 py-6 text-sm text-gray-400">No withdrawals yet.</p>
          : withdrawals.map(w => (
            <div key={w._id} className="flex justify-between px-5 py-3 text-sm border-b border-gray-50">
              <span>{formatCurrency(w.amount)} · {formatDate(w.createdAt)}</span>
              <span className="capitalize text-gray-500">{w.status}</span>
            </div>
          ))}
      </div>
    </div>
  )
}