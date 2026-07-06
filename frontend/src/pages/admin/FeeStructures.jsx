// src/pages/admin/FeeStructures.jsx
import { useState, useEffect, useCallback } from 'react'
import { feeAPI } from '../../api'
import { Table, Pagination, EmptyState, Modal, Spinner, Alert, Field, StatusBadge } from '../../components/ui'
import { Toast } from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import { formatDate, formatCurrency, termLabel } from '../../utils/formatters'
import { CreditCard, Plus, RefreshCw, Users } from 'lucide-react'

const INITIAL = { name: '', class: '', amount: '', academicSession: '', term: 'first', dueDate: '' }

export default function AdminFeeStructures() {
  const { toasts, toast, remove } = useToast()
  const [structures, setStructures] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAssign, setShowAssign] = useState(null)
  const [form,       setForm]       = useState(INITIAL)
  const [saving,     setSaving]     = useState(false)
  const [assigning,  setAssigning]  = useState(false)
  const [err,        setErr]        = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await feeAPI.listStructures()
      setStructures(res.data.data.feeStructures)
    } catch { toast('Failed to load fee structures', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await feeAPI.createStructure({ ...form, amount: Number(form.amount) })
      toast('Fee structure created!')
      setShowCreate(false); setForm(INITIAL); load()
    } catch (er) {
      setErr(er.response?.data?.message || 'Failed to create fee structure')
    } finally { setSaving(false) }
  }

  const handleBulkAssign = async (structureId) => {
    setAssigning(true)
    try {
      const res = await feeAPI.assignToClass({ feeStructureId: structureId })
      const { assigned, skipped } = res.data.data
      toast(`Assigned to ${assigned} student(s). ${skipped} already assigned.`)
      setShowAssign(null)
    } catch (er) {
      toast(er.response?.data?.message || 'Bulk assign failed', 'error')
    } finally { setAssigning(false) }
  }

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-5 animate-fade-in">
      <Toast toasts={toasts} remove={remove} />

      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Fee Structures</h1>
          <p className="page-sub">Define school fees per class and term</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="btn-secondary"><RefreshCw size={15} /></button>
          <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> Create Structure</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table loading={loading} headers={['Name', 'Class', 'Amount', 'Term', 'Session', 'Due Date', 'Actions']}>
          {structures.length === 0 && !loading
            ? <tr><td colSpan={7} className="py-12">
                <EmptyState icon={CreditCard} title="No fee structures yet"
                  description="Create your first fee structure to start assigning fees to students"
                  action={<button onClick={() => setShowCreate(true)} className="btn-primary mt-2"><Plus size={14} /> Create Structure</button>} />
              </td></tr>
            : structures.map(s => (
              <tr key={s._id}>
                <td><p className="font-semibold text-gray-900 text-sm">{s.name}</p></td>
                <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{s.class}</span></td>
                <td className="font-bold text-gray-900">{formatCurrency(s.amount)}</td>
                <td className="capitalize text-sm">{termLabel(s.term)}</td>
                <td className="text-sm text-gray-500">{s.academicSession}</td>
                <td className="text-sm text-gray-500">{formatDate(s.dueDate)}</td>
                <td>
                  <button onClick={() => setShowAssign(s)}
                    className="text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded px-3 py-1 hover:bg-blue-100 font-semibold">
                    <Users size={12} className="inline mr-1" />Assign Class
                  </button>
                </td>
              </tr>
            ))
          }
        </Table>
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setErr('') }} title="Create Fee Structure">
        {err && <div className="mb-4"><Alert type="error" message={err} /></div>}
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Structure Name" required>
            <input className="input" placeholder="First Term Fees 2024/2025 - JSS 1" required value={form.name} onChange={set('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Class" required>
              <input className="input" placeholder="JSS 1" required value={form.class} onChange={set('class')} />
            </Field>
            <Field label="Amount (₦)" required>
              <input type="number" className="input" placeholder="50000" required min={1} value={form.amount} onChange={set('amount')} />
            </Field>
            <Field label="Academic Session" required>
              <input className="input" placeholder="2024/2025" required value={form.academicSession} onChange={set('academicSession')} />
            </Field>
            <Field label="Term" required>
              <select className="input" value={form.term} onChange={set('term')}>
                <option value="first">First Term</option>
                <option value="second">Second Term</option>
                <option value="third">Third Term</option>
              </select>
            </Field>
          </div>
          <Field label="Due Date" required>
            <input type="date" className="input" required value={form.dueDate} onChange={set('dueDate')} />
          </Field>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Create Structure'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Assign Modal */}
      <Modal open={!!showAssign} onClose={() => setShowAssign(null)} title="Assign to Entire Class" size="sm">
        {showAssign && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm">
              <p className="font-semibold text-blue-900 mb-1">{showAssign.name}</p>
              <p className="text-blue-700">This will assign <strong>{formatCurrency(showAssign.amount)}</strong> to all active students in <strong>{showAssign.class}</strong>.</p>
              <p className="text-blue-600 text-xs mt-2">Students already assigned will be skipped automatically.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAssign(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleBulkAssign(showAssign._id)} className="btn-primary" disabled={assigning}>
                {assigning ? <Spinner size="sm" /> : `Assign to ${showAssign.class}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}