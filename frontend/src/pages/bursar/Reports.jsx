// src/pages/bursar/Reports.jsx
import { useState, useEffect } from 'react'
import { reportAPI } from '../../api'
import { StatCard, Table, EmptyState, Spinner, Alert } from '../../components/ui'
import { StatusBadge } from '../../components/ui'
import { formatCurrency, formatDate, termLabel } from '../../utils/formatters'
import { FileText, Download, Filter, TrendingUp, AlertTriangle, Users, Wallet } from 'lucide-react'

export default function BursarReports() {
  const [summary,  setSummary]  = useState(null)
  const [classes,  setClasses]  = useState([])
  const [filters,  setFilters]  = useState({ term: '', academicSession: '' })
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [sumRes, clsRes] = await Promise.all([
          reportAPI.schoolSummary(filters),
          reportAPI.classBreakdown(filters),
        ])
        setSummary(sumRes.data.data)
        setClasses(clsRes.data.data?.classes || [])
      } catch { setError('Could not load report data') }
      finally { setLoading(false) }
    }
    load()
  }, [filters])

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  const c = summary?.collection || {}

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">School-wide collection and payment analysis</p>
        </div>
        <button className="btn-secondary gap-2">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Filters */}
      <div className="flex gap-3">
        <select className="input w-44" value={filters.term} onChange={e => setFilters(p => ({...p, term: e.target.value}))}>
          <option value="">All Terms</option>
          <option value="first">First Term</option>
          <option value="second">Second Term</option>
          <option value="third">Third Term</option>
        </select>
        <input className="input w-44" placeholder="e.g. 2024/2025"
          value={filters.academicSession} onChange={e => setFilters(p => ({...p, academicSession: e.target.value}))} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Expected"   value={formatCurrency(c.totalExpected)}   accent="blue"   icon={TrendingUp} />
        <StatCard label="Total Collected"  value={formatCurrency(c.totalCollected)}  accent="green"  icon={Wallet} />
        <StatCard label="Outstanding"      value={formatCurrency(c.totalOutstanding)} accent="amber"  icon={AlertTriangle} />
        <StatCard label="Overpayments"     value={formatCurrency(c.totalOverpaid)}   accent="purple" icon={Users} />
      </div>

      {/* Collection rate */}
      {c.totalExpected > 0 && (
        <div className="card p-5">
          <div className="flex justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Overall Collection Rate</p>
            <p className="text-sm font-bold text-blue-600">
              {Math.round((c.totalCollected / c.totalExpected) * 100)}%
            </p>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min((c.totalCollected / c.totalExpected) * 100, 100)}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-4 mt-4 text-center">
            {[
              { label: 'Fully Paid',  value: c.fullyPaid    || 0, color: 'text-green-600' },
              { label: 'Partial',     value: c.partialCount || 0, color: 'text-amber-600' },
              { label: 'Unpaid',      value: c.unpaidCount  || 0, color: 'text-red-600' },
              { label: 'Overpaid',    value: c.overpaidCount|| 0, color: 'text-purple-600' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Class breakdown */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Breakdown by Class</h2>
        </div>
        {classes.length === 0
          ? <EmptyState icon={FileText} title="No data available" description="Data will appear once fees are assigned and payments received" />
          : <Table headers={['Class', 'Students', 'Collected', 'Outstanding', 'Rate']}>
              {classes.map((cls, i) => (
                <tr key={i}>
                  <td className="font-medium">{cls.class}</td>
                  <td>{cls.totalStudents}</td>
                  <td className="text-green-700 font-medium">{formatCurrency(cls.totalCollected)}</td>
                  <td className="text-amber-700 font-medium">{formatCurrency(cls.totalOutstanding)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-16">
                        <div className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(cls.rate || 0, 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{cls.rate || 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
        }
      </div>
    </div>
  )
}
