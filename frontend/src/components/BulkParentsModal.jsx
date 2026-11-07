// src/components/BulkParentsModal.jsx
// Upload a CSV or Excel (.xlsx) list of parents, preview the problems, import, then download the temporary passwords (shown once).
import { useState, useRef } from 'react'
import { Upload, Download } from 'lucide-react'
import { peopleAPI } from '../api'
import { Modal, Alert, Spinner } from './ui'
import { MAX_ROWS, matrixToRows } from '../utils/parentImport'
import { readSheetFile } from '../utils/readSheetFile'
import { toCsv, downloadCsv } from '../utils/csv'

const downloadTemplate = () => downloadCsv('edupay-parents-template.csv', toCsv([
  ['fullName', 'email', 'phone', 'childStudentIds'],
  ['Ngozi Okafor', 'ngozi.okafor@example.com', '08031234567', 'DE/2026/001; DE/2026/014'],
  ['Tunde Adeyemi', 'tunde.adeyemi@example.com', '08059876543', 'DE/2026/002'],
]))

export default function BulkParentsModal({ open, onClose, onDone }) {
  const inputRef = useRef(null)
  const [rows, setRows]       = useState([])
  const [preview, setPreview] = useState(null)
  const [result, setResult]   = useState(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  const reset = () => { setRows([]); setPreview(null); setResult(null); setFileName(''); setError(''); setBusy(false); if (inputRef.current) inputRef.current.value = '' }
  const close = () => {
    if (result && !result.saved && !window.confirm('The temporary passwords will not be shown again. Close without downloading them?')) return
    const done = !!result; reset(); onClose(); if (done) onDone?.()
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setPreview(null); setBusy(true); setFileName(file.name)
    try {
      const parsed = matrixToRows(await readSheetFile(file))
      setRows(parsed)
      const res = await peopleAPI.bulkParents({ rows: parsed, preview: true })
      setPreview(res.data.data)
    } catch (err) {
      setRows([]); setPreview(null)
      setError(err.response?.data?.message || err.message || 'Could not read that file')
    } finally { setBusy(false) }
  }

  const importNow = async () => {
    setBusy(true); setError('')
    try {
      const res = await peopleAPI.bulkParents({ rows })
      setResult(res.data.data); setPreview(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Import failed')
    } finally { setBusy(false) }
  }

  const downloadCredentials = () => {
    downloadCsv('parent-credentials.csv', toCsv([
      ['fullName', 'email', 'temporaryPassword', 'childrenLinked'],
      ...result.credentials.map((c) => [c.fullName, c.email, c.tempPassword, c.childrenLinked]),
    ]))
    setResult((r) => ({ ...r, saved: true }))
  }

  return (
    <Modal open={open} onClose={close} title="Import parents from a file" size="lg">
      {error && <div className="mb-4"><Alert type="error" message={error} onClose={() => setError('')} /></div>}

      {!preview && !result && (
        <div className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 text-xs text-violet-700 space-y-1">
            <p>Upload a <b>.csv</b> or <b>.xlsx</b> file with one parent per row (up to {MAX_ROWS}). Columns: <span className="font-mono">fullName, email</span> and optionally <span className="font-mono">phone, childStudentIds</span>.</p>
            <p>Put the children's Student IDs in <span className="font-mono">childStudentIds</span> (separate several with <b>;</b>) to link them straight away. Each parent gets a temporary password and must change it at first login. Nothing is saved until you confirm.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={downloadTemplate}><Download size={15} /> Download template</button>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Spinner size="sm" /> : <><Upload size={15} /> Choose file</>}
            </button>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.txt" className="hidden" onChange={handleFile} />
          </div>
          {fileName && busy && <p className="text-xs text-gray-400">Reading {fileName}…</p>}
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-xl font-black text-gray-900">{preview.total}</p><p className="text-xs text-gray-400">in file</p></div>
            <div className="bg-green-50 rounded-lg p-3"><p className="text-xl font-black text-green-600">{preview.validCount}</p><p className="text-xs text-gray-400">ready to import</p></div>
            <div className="bg-red-50 rounded-lg p-3"><p className="text-xl font-black text-red-500">{preview.invalidCount}</p><p className="text-xs text-gray-400">with problems</p></div>
          </div>
          <p className="text-xs text-gray-500">{preview.childrenToLink} child{preview.childrenToLink === 1 ? '' : 'ren'} will be linked to their parent.</p>

          {preview.invalidCount > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1.5">These rows will be skipped:</p>
              <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50 text-xs">
                {preview.invalid.map((r) => (
                  <div key={`${r.row}-${r.email}`} className="px-3 py-2 flex gap-3">
                    <span className="text-gray-400 w-12 flex-shrink-0">Row {r.row}</span>
                    <span className="text-gray-700 flex-1 min-w-0 truncate">{r.fullName || '—'} {r.email && `· ${r.email}`}</span>
                    <span className="text-red-600 text-right">{r.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.childWarnings?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1.5">These children will not be linked (the parent is still created):</p>
              <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50 text-xs">
                {preview.childWarnings.map((w, i) => (
                  <div key={i} className="px-3 py-2 flex gap-3">
                    <span className="text-gray-400 w-12 flex-shrink-0">Row {w.row}</span>
                    <span className="text-gray-700 flex-1 font-mono">{w.studentId}</span>
                    <span className="text-amber-700 text-right">{w.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" className="btn-secondary" disabled={busy} onClick={reset}>Choose another file</button>
            <button type="button" className="btn-primary" disabled={busy || preview.validCount === 0} onClick={importNow}>
              {busy ? <Spinner size="sm" /> : `Create ${preview.validCount} parent${preview.validCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <Alert type="success" message={`${result.createdCount} parent account${result.createdCount === 1 ? '' : 's'} created, ${result.linkedChildren} child${result.linkedChildren === 1 ? '' : 'ren'} linked.${result.failedCount ? ` ${result.failedCount} row(s) skipped.` : ''}`} />
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            Download the temporary passwords now. They are shown once and cannot be recovered. Each parent must change theirs at first login.
          </div>
          <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50 text-xs">
            {result.credentials.map((c) => (
              <div key={c.email} className="px-3 py-2 flex gap-3 items-center">
                <span className="text-gray-700 flex-1 min-w-0 truncate">{c.fullName}<span className="text-gray-400"> · {c.email}</span></span>
                <span className="font-mono font-semibold select-all">{c.tempPassword}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-secondary" onClick={downloadCredentials}><Download size={15} /> Download passwords (CSV)</button>
            <button type="button" className="btn-primary" onClick={close}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
