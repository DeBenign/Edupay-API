// src/pages/admin/Dashboard.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportAPI, studentAPI, feeAPI, schoolAPI } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { StatCard, Spinner, Alert, EmptyState } from '../../components/ui'
import { formatCurrency } from '../../utils/formatters'
import { GraduationCap, CreditCard, Users, TrendingUp, Plus, ArrowRight, Building2 } from 'lucide-react'

export default function AdminDashboard() {
  const { user, updateUser } = useAuth()
  const navigate             = useNavigate()
  const [summary,  setSummary]  = useState(null)
  const [school,   setSchool]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [schoolRes, sumRes] = await Promise.allSettled([
          schoolAPI.getmine(),
          reportAPI.schoolSummary(),
        ])
        if (schoolRes.status === 'fulfilled') setSchool(schoolRes.value.data.data.school)
        if (sumRes.status   === 'fulfilled') setSummary(sumRes.value.data.data)
      } catch { setError('Could not load dashboard') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  const c = summary?.collection || {}
  const noSchool = !user?.schoolId

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-sub">Welcome back, {user?.fullName?.split(' ')[0]}</p>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Setup prompt — no school yet */}
      {noSchool && (
        <div className="card p-6 border-2 border-dashed border-blue-200 bg-blue-50">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 size={20} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 mb-1">Set up your school</p>
              <p className="text-sm text-gray-600 mb-4">
                Before enrolling students or assigning fees, create your school profile.
              </p>
              <button onClick={() => navigate('/admin/settings')} className="btn-primary">
                Create school profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {!noSchool && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students"   value={c.totalStudents  || 0} accent="blue"   icon={GraduationCap} />
          <StatCard label="Fully Paid"       value={c.fullyPaid      || 0} accent="green"  icon={TrendingUp} />
          <StatCard label="Total Collected"  value={formatCurrency(c.totalCollected)} accent="green" icon={CreditCard} />
          <StatCard label="Outstanding"      value={formatCurrency(c.totalOutstanding)} accent="amber" icon={Users} />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Enroll a student',    sub: 'Add a new student and provision their payment account', icon: GraduationCap, to: '/admin/students', color: 'blue' },
          { label: 'Create fee structure',sub: 'Define fees for a class and term',                      icon: CreditCard,    to: '/admin/fees',     color: 'emerald' },
          { label: 'Manage staff',        sub: 'Add bursars and set up staff accounts',                 icon: Users,         to: '/admin/staff',    color: 'violet' },
        ].map(({ label, sub, icon: Icon, to, color }) => (
          <button key={to} onClick={() => navigate(to)}
            className="card p-5 text-left hover:shadow-md transition-all group">
            <div className={`w-9 h-9 rounded-lg bg-${color}-50 flex items-center justify-center mb-3`}>
              <Icon size={18} className={`text-${color}-600`} />
            </div>
            <p className="font-semibold text-gray-900 text-sm mb-1">{label}</p>
            <p className="text-xs text-gray-400">{sub}</p>
            <div className={`flex items-center gap-1 text-xs text-${color}-600 mt-3 opacity-0 group-hover:opacity-100 transition-opacity`}>
              Get started <ArrowRight size={12} />
            </div>
          </button>
        ))}
      </div>

      {/* School info */}
      {school && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm">School Profile</h2>
            <button onClick={() => navigate('/admin/settings')} className="text-xs text-blue-600 hover:underline">Edit</button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div><p className="text-gray-400 text-xs mb-0.5">Name</p><p className="font-medium">{school.name}</p></div>
            <div><p className="text-gray-400 text-xs mb-0.5">Email</p><p className="font-medium">{school.email}</p></div>
            <div><p className="text-gray-400 text-xs mb-0.5">Address</p><p className="font-medium">{school.address}</p></div>
          </div>
        </div>
      )}
    </div>
  )
}
