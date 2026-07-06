// src/pages/admin/Students.jsx
import { useState, useEffect, useCallback } from 'react'
import { studentAPI, feeAPI } from '../../api'
import { StatusBadge, Table, Pagination, EmptyState, Modal, Spinner, Alert, Field, StatCard } from '../../components/ui'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { useToast } from '../../hooks/useToast'
import { Toast } from '../../components/ui'
import { GraduationCap, Plus, Search, RefreshCw, Copy, Check, AlertCircle } from 'lucide-react'

const INITIAL_FORM = { fullName: '', studentId: '', class: '', gender: 'male', dateOfBirth: '' }

export default function AdminStudents() {
  const { toasts, toast, remove } = useToast()
  const [students,    setStudents]   = useState([])
  const [pagination,  setPagination] = useState(null)
  const [loading,     setLoading]    = useState(true)
  const [search,      setSearch]     = useState('')
  const [classFilter, setClass]      = useState('')
  const [page,        setPage]       = useState(1)
  const [showEnroll,  setShowEnroll] = useState(false)
  const [form,        setForm]       = useState(INITIAL_FORM)
  const [enrolling,   setEnrolling]  = useState(false)
  const [enrollErr,   setEnrollErr]  = useState('')
  const [accountModal,setAccountModal] = useState(null)
  const [copied,      setCopied]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await studentAPI.list({ page, limit: 15, search, class: classFilter })
      setStudents(res.data.data.students)
      setPagination(res.data.pagination)
    } catch { toast('Failed to load students', 'error') }
    finally { setLoading(false) }
  }, [page, search, classFilter])

  useEffect(() => { load() }, [load])

  const handleEnroll = async (e) => {
    e.preventDefault()
    setEnrolling(true); setEnrollErr('')
    try {
      const res = await studentAPI.enroll(form)
      const student = res.data.data.student
      const warning = res.data.data.warning
      toast(warning ? `${student.fullName} enrolled. Virtual account pending.` : `${student.fullName} enrolled successfully!`)
      setShowEnroll(false); setForm(INITIAL_FORM); load()
    } catch (err) {
      setEnrollErr(err.response?.data?.message || 'Enrollment failed')
    } finally { setEnrolling(false) }
  }

  const showAccount = async (student) => {
    try {
      const res = await studentAPI.getAccount(student._id)
      setAccountModal({ ...res.data.data, studentName: student.fullName, studentId: student.studentId })
    } catch {
      toast('Could not load account details', 'error')
    }
  }

  const retryProvision = async (studentId) => {
    try {
      await studentAPI.retryProvision(studentId)
      toast('Virtual account provisioned successfully!')
      load()
    } catch (err) {
      toast(err.response?.data?.message || 'Provisioning failed', 'error')
    }
  }

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-5 animate-fade-in">
      <Toast toasts={toasts} remove={remove} />

      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Students</h1>
          <p className="page-sub">Manage enrolled students and their payment accounts</p>
        </div>
        <button onClick={() => setShowEnroll(true)} className="btn-primary">
          <Plus size={16} /> Enroll Student
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name or student ID…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <input className="input w-28" placeholder="Class" value={classFilter}
          onChange={e => { setClass(e.target.value); setPage(1) }} />
        <button onClick={load} className="btn-secondary"><RefreshCw size={15} /></button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table loading={loading} headers={['Student', 'Class', 'Virtual Account', 'Status', 'Enrolled', 'Actions']}>
          {students.length === 0 && !loading
            ? <tr><td colSpan={6} className="py-12">
                <EmptyState icon={GraduationCap} title="No students found"
                  description="Enroll your first student to get started"
                  action={<button onClick={() => setShowEnroll(true)} className="btn-primary mt-2"><Plus size={14} /> Enroll Student</button>} />
              </td></tr>
            : students.map(s => (
              <tr key={s._id}>
                <td>
                  <p className="font-semibold text-gray-900">{s.fullName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.studentId}</p>
                </td>
                <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{s.class}</span></td>
                <td>
                  {s.virtualAccount?.accountNumber
                    ? <button onClick={() => showAccount(s)} className="font-mono text-xs text-blue-600 hover:underline">
                        {s.virtualAccount.accountNumber}
                      </button>
                    : <button onClick={() => retryProvision(s._id)}
                        className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 hover:bg-amber-100">
                        ⚠ Retry provision
                      </button>
                  }
                </td>
                <td><StatusBadge status={s.currentStatus || 'unpaid'} /></td>
                <td className="text-xs text-gray-400">{formatDate(s.createdAt)}</td>
                <td>
                  <button onClick={() => showAccount(s)} className="text-xs text-blue-600 hover:underline">
                    View →
                  </button>
                </td>
              </tr>
            ))
          }
        </Table>
        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      {/* Enroll Modal */}
      <Modal open={showEnroll} onClose={() => { setShowEnroll(false); setEnrollErr('') }} title="Enroll New Student" size="md">
        {enrollErr && <div className="mb-4"><Alert type="error" message={enrollErr} /></div>}
        <form onSubmit={handleEnroll} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name" required>
              <input className="input" placeholder="Ade Johnson" required value={form.fullName} onChange={set('fullName')} />
            </Field>
            <Field label="Student ID" required>
              <input className="input" placeholder="GF/2024/001" required value={form.studentId} onChange={set('studentId')} />
            </Field>
            <Field label="Class" required>
              <input className="input" placeholder="JSS 1" required value={form.class} onChange={set('class')} />
            </Field>
            <Field label="Gender" required>
              <select className="input" value={form.gender} onChange={set('gender')}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
          </div>
          <Field label="Date of Birth">
            <input type="date" className="input" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
          </Field>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            💡 A unique Nomba virtual account will be automatically provisioned for this student upon enrollment.
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowEnroll(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={enrolling}>
              {enrolling ? <Spinner size="sm" /> : 'Enroll Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Account Modal */}
      <Modal open={!!accountModal} onClose={() => setAccountModal(null)} title="Virtual Account Details">
        {accountModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Share this account number with parents. Payments reconcile automatically.
            </p>
            <div className="bg-gray-50 rounded-xl p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Student</span>
                <span className="font-semibold">{accountModal.studentName} · {accountModal.studentId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Account Name</span>
                <span className="font-semibold">{accountModal.paymentDetails?.accountName}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-gray-500">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg text-gray-900">
                    {accountModal.paymentDetails?.accountNumber}
                  </span>
                  <button onClick={() => copy(accountModal.paymentDetails?.accountNumber)}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors">
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Bank</span>
                <span className="font-semibold">{accountModal.paymentDetails?.bankName}</span>
              </div>
            </div>
            {accountModal.outstandingFees?.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-700 mb-2">Outstanding Fees</p>
                {accountModal.outstandingFees.map((fee, i) => (
                  <div key={i} className="flex justify-between text-xs text-amber-700">
                    <span>{fee.name}</span>
                    <span className="font-bold">{formatCurrency(fee.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs text-amber-800 font-bold mt-2 pt-2 border-t border-amber-200">
                  <span>Total Outstanding</span>
                  <span>{formatCurrency(accountModal.totalOutstanding)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}