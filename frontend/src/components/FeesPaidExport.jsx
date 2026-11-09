// src/components/FeesPaidExport.jsx
// "Export fees paid": pick a term (and optionally session / class), then download Excel, CSV, or print / save as PDF.
import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { reportAPI } from '../api'
import { Modal, Alert, Spinner } from './ui'
import { downloadFeesPaidCsv, downloadFeesPaidXlsx, printFeesPaid } from '../utils/feesPaidExport'

export default function FeesPaidExport({ defaultFilters = {}, label = 'Export fees paid' }) {
  const [open, setOpen]     = useState(false)
  const [filters, setFilters] = useState({ term: '', academicSession: '', class: '' })
  const [busy, setBusy]     = useState('')
  const [error, setError]   = useState('')
  const [note, setNote]     = useState('')

  const show = () => {
    setFilters({ term: defaultFilters.term || '', academicSession: defaultFilters.academicSession || '', class: '' })
    setError(''); setNote(''); setOpen(true)
  }
  const set = (k) => (e) => setFilters((p) => ({ ...p, [k]: e.target.value }))

  const run = async (kind) => {
    setBusy(kind); setError(''); setNote('')
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => String(v).trim()))
      const data = (await reportAPI.feesPaid(params)).data.data
      if (!data.ledger.length) { setError('No fee records match these filters.'); return }
      if (kind === 'xlsx') await downloadFeesPaidXlsx(data)
      else if (kind === 'csv') downloadFeesPaidCsv(data)
      else printFeesPaid(data)
      setNote(`${data.ledger.length} fee record${data.ledger.length === 1 ? '' : 's'} and ${data.payments.length} payment${data.payments.length === 1 ? '' : 's'} exported.${data.truncated ? ' The list was cut short because it is very large: filter by class or term.' : ''}`)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not export. Please try again.')
    } finally { setBusy('') }
  }

  const Btn = ({ kind, icon: Icon, children }) => (
    <button type="button" className="btn-secondary justify-center gap-2" disabled={!!busy} onClick={() => run(kind)}>
      {busy === kind ? <Spinner size="sm" /> : <Icon size={15} />} {children}
    </button>
  )

  return (
    <>
      <button type="button" className="btn-secondary gap-2" onClick={show}><Download size={15} /> {label}</button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Export fees paid so far" size="md">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Every student's fee for the term: expected, paid, balance and status, plus each payment with its reference. Leave a filter empty to include everything.</p>
          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {note && <Alert type="success" message={note} onClose={() => setNote('')} />}
          <div className="grid grid-cols-3 gap-3">
            <select className="input" value={filters.term} onChange={set('term')}>
              <option value="">All terms</option>
              <option value="first">First Term</option>
              <option value="second">Second Term</option>
              <option value="third">Third Term</option>
            </select>
            <input className="input" placeholder="Session, e.g. 2026/2027" value={filters.academicSession} onChange={set('academicSession')} />
            <input className="input" placeholder="Class (optional)" value={filters.class} onChange={set('class')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Btn kind="xlsx" icon={FileSpreadsheet}>Excel (.xlsx)</Btn>
            <Btn kind="csv" icon={FileText}>CSV</Btn>
            <Btn kind="print" icon={Printer}>Print / PDF</Btn>
          </div>
          <p className="text-xs text-gray-400">In the print window, choose "Save as PDF" as the printer to keep a copy.</p>
        </div>
      </Modal>
    </>
  )
}
