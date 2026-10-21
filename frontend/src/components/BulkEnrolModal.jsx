// src/components/BulkEnrollModal.jsx
// Upload a CSV or Excel (.xlsx) list of students, preview the problems, then import.
import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { readSheet } from 'read-excel-file/browser'
import { Upload, Download } from 'lucide-react'
import { studentAPI } from '../api'
import { Modal, Alert, Spinner } from './ui'
import { MAX_ROWS, matrixToRows } from '../utils/studentImport'

const MAX_FILE_BYTES = 2 * 1024 * 1024

const readMatrix = async (file) => {
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is too large (2 MB limit).')
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return new Promise((resolve, reject) =>
      Papa.parse(file, { skipEmptyLines: 'greedy', complete: (r) => resolve(r.data), error: reject }))
  }
  if (name.endsWith('.xlsx')) return readSheet(file)
  throw new Error('Upload a .csv or .xlsx file. For an older .xls file, save it as .xlsx or .csv first.')
}

const downloadTemplate = () => {
  const csv = 'fullName,studentId,class,gender,dateOfBirth\nAde Johnson,DE/2026/001,JSS 1,male,2014-05-12\nBisola Ayeola,DE/2026/002,JSS 1,female,2014-09-03\n'
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url; a.download = 'edupay-students-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function BulkEnrollModal({ open, onClose, onDone }) {
  const inputRef = useRef(null)
  const [rows, setRows]       = useState([])
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  const reset = () => { setRows([]); setPreview(null); setFileName(''); setError(''); setBusy(false); if (inputRef.current) inputRef.current.value = '' }
  const close = () => { reset(); onClose() }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setPreview(null); setBusy(true); setFileName(file.name)
    try {
      const parsed = matrixToRows(await readMatrix(file))
      setRows(parsed)
      const res = await studentAPI.bulkEnroll({ rows: parsed, preview: true })
      setPreview(res.data.data)
    } catch (err) {
      setRows([]); setPreview(null)
      setError(err.response?.data?.message || err.message || 'Could not read that file')
    } finally { setBusy(false) }
  }

  const importNow = async () => {
    setBusy(true); setError('')
    try {
      const res = await studentAPI.bulkEnroll({ rows })
      reset()
      onDone(res.data.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Import failed')
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Import students from a file" size="lg">
      {error && <div className="mb-4"><Alert type="error" message={error} onClose={() => setError('')} /></div>}

      {!preview && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 space-y-1">
            <p>Upload a <b>.csv</b> or <b>.xlsx</b> file with one student per row (up to {MAX_ROWS}). Columns: <span className="font-mono">fullName, studentId, class, gender</span> and optionally <span className="font-mono">dateOfBirth</span>.</p>
            <p>In Excel, format the Student ID column as <b>Text</b> so IDs like 001 keep their zeros. Nothing is saved until you confirm.</p>
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

          {preview.classes?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {preview.classes.map((c) => (
                <span key={c.class} className="text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-1">{c.class}: {c.count}</span>
              ))}
            </div>
          )}

          {preview.invalidCount > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1.5">These rows will be skipped:</p>
              <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50 text-xs">
                {preview.invalid.map((r) => (
                  <div key={`${r.row}-${r.studentId}`} className="px-3 py-2 flex gap-3">
                    <span className="text-gray-400 w-12 flex-shrink-0">Row {r.row}</span>
                    <span className="text-gray-700 flex-1 min-w-0 truncate">{r.fullName || '—'} {r.studentId && `· ${r.studentId}`}</span>
                    <span className="text-red-600 text-right">{r.reason}</span>
                  </div>
                ))}
              </div>
              {preview.invalidCount > preview.invalid.length && (
                <p className="text-xs text-gray-400 mt-1">Showing the first {preview.invalid.length} of {preview.invalidCount}.</p>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400">Virtual accounts are created in the background after the import, a few seconds apart. Any that fail show a retry button in the Students table.</p>

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" className="btn-secondary" disabled={busy} onClick={reset}>Choose another file</button>
            <button type="button" className="btn-primary" disabled={busy || preview.validCount === 0} onClick={importNow}>
              {busy ? <Spinner size="sm" /> : `Import ${preview.validCount} student${preview.validCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}