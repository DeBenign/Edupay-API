// src/pages/admin/Overpayments.jsx
import { useState, useEffect, useCallback } from 'react'
import { paymentAPI } from '../../api'
import { Table, EmptyState, Toast } from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import { formatCurrency } from '../../utils/formatters'
import { CreditCard, RefreshCw } from 'lucide-react'

export default function AdminOverpayments() {
  const { toasts, toast, remove } = useToast()
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await paymentAPI.overpayments()
      setItems(res.data.data.overpayments)
    } catch { toast('Failed to load overpayments', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Asks for a bank code only when the payer's bank could not be detected automatically
  const approveRefund = async (assignmentId, bankCode) => {
    setBusy(assignmentId)
    try {
      await paymentAPI.approveRefund(assignmentId, bankCode ? { bankCode } : {})
      toast('Refund sent')
      await load()
    } catch (err) {
      const msg = err.response?.data?.message || 'Refund failed'
      if (msg.includes('bankCode') && !bankCode) {
        const code = window.prompt("Couldn't detect the payer's bank. Enter the bank code (for example 058):")
        if (code?.trim()) return await approveRefund(assignmentId, code.trim())
      }
      toast(msg, 'error')
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Toast toasts={toasts} remove={remove} />

      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Overpayments</h1>
          <p className="page-sub">Excess payments waiting for a parent's decision or your approval</p>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={15} /></button>
      </div>

      <div className="card overflow-hidden">
        <Table loading={loading} headers={['Student', 'Class', 'Fee', 'Amount', 'Status', 'Action']}>
          {items.length === 0 && !loading
            ? <tr><td colSpan={6} className="py-12">
                <EmptyState icon={CreditCard} title="No overpayments"
                  description="Nothing is waiting for a decision or a refund approval" />
              </td></tr>
            : items.map(o => (
              <tr key={o.assignmentId}>
                <td>
                  <p className="font-semibold text-gray-900">{o.student?.fullName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{o.student?.studentId}</p>
                </td>
                <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{o.student?.class}</span></td>
                <td className="text-sm">{o.fee}{o.term ? ` (${o.term} term)` : ''}</td>
                <td className="font-semibold">{formatCurrency(o.amount)}</td>
                <td className="text-xs">
                  {o.resolution === 'refund_requested'
                    ? <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">Refund requested</span>
                    : <span className="text-gray-500">Waiting for parent</span>}
                </td>
                <td>
                  {o.resolution === 'refund_requested' && (
                    <button onClick={() => approveRefund(o.assignmentId)} disabled={busy === o.assignmentId}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                      {busy === o.assignmentId ? 'Sending…' : 'Approve refund'}
                    </button>
                  )}
                </td>
              </tr>
            ))
          }
        </Table>
      </div>
    </div>
  )
}