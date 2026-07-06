// src/pages/bursar/Students.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { studentAPI, paymentAPI } from '../../api'
import { StatusBadge, Table, Pagination, EmptyState, Spinner, Modal } from '../../components/ui'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { Search, GraduationCap, RefreshCw, Copy, Check } from 'lucide-react'

export default function BursarStudents() {
  const navigate = useNavigate()
  const [students,  setStudents]  = useState([])
  const [pagination,setPagination]= useState(null)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [classFilter, setClass]   = useState('')
  const [page,      setPage]      = useState(1)
  const [account,   setAccount]   = useState(null)   // modal state
  const [copied,    setCopied]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await studentAPI.list({ page, limit: 20, search, class: classFilter })
      setStudents(res.data.data.students)
      setPagination(res.data.pagination)
    } catch { /* handled by interceptor */ }
    finally { setLoading(false) }
  }, [page, search, classFilter])

  useEffect(() => { load() }, [load])

  const showAccount = async (student) => {
    try {
      const res = await studentAPI.getAccount(student._id)
      setAccount({ ...res.data.data, studentName: student.fullName })
    } catch {}
  }

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Students</h1>
        <p className="page-sub">Payment status across all enrolled students</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name or student ID…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <input className="input w-32" placeholder="Class" value={classFilter}
          onChange={e => { setClass(e.target.value); setPage(1) }} />
        <button onClick={load} className="btn-secondary"><RefreshCw size={15} /></button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table loading={loading} headers={['Student', 'Class', 'Account Number', 'Fee Status', 'Last Payment', 'Actions']}>
          {students.length === 0 && !loading
            ? <tr><td colSpan={6} className="py-12">
                <EmptyState icon={GraduationCap} title="No students found" description="Try adjusting your search or filters" />
              </td></tr>
            : students.map(s => (
              <tr key={s._id}>
                <td>
                  <p className="font-medium text-gray-900">{s.fullName}</p>
                  <p className="text-xs text-gray-400">{s.studentId}</p>
                </td>
                <td className="font-mono text-xs">{s.class}</td>
                <td>
                  {s.virtualAccount?.accountNumber
                    ? <button onClick={() => showAccount(s)}
                        className="font-mono text-xs text-blue-600 hover:underline">
                        {s.virtualAccount.accountNumber}
                      </button>
                    : <span className="text-xs text-amber-600">Pending</span>
                  }
                </td>
                <td><StatusBadge status={s.currentStatus || 'unpaid'} /></td>
                <td className="text-xs text-gray-500">{formatDate(s.lastPaymentAt)}</td>
                <td>
                  <button onClick={() => navigate(`/bursar/students/${s._id}`)}
                    className="text-xs text-blue-600 hover:underline">View →</button>
                </td>
              </tr>
            ))
          }
        </Table>
        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      {/* Account modal */}
      <Modal open={!!account} onClose={() => setAccount(null)} title="Payment Account Details">
        {account && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Parents should transfer fees to this dedicated account. Payments reconcile automatically.
            </p>
            <div className="bg-gray-50 rounded-xl p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Account Name</span>
                <span className="font-semibold">{account.paymentDetails?.accountName}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-gray-500">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900">{account.paymentDetails?.accountNumber}</span>
                  <button onClick={() => copy(account.paymentDetails?.accountNumber)}
                    className="p-1 hover:bg-gray-200 rounded">
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Bank</span>
                <span className="font-semibold">{account.paymentDetails?.bankName}</span>
              </div>
            </div>
            {account.totalOutstanding > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700">
                Outstanding balance: <strong>{formatCurrency(account.totalOutstanding)}</strong>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
