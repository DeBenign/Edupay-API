// src/components/layout/DashboardLayout.jsx
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth }   from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { ENV_NAME }  from '../../api/axios'
import { LayoutDashboard, Users, GraduationCap, CreditCard,
         FileText, Bell, Settings, LogOut, Menu, BookOpen, Wallet } from 'lucide-react'

const NAV = {
  admin:  [
    { to: '/admin',          label: 'Dashboard',      icon: LayoutDashboard },
    { to: '/admin/students', label: 'Students',       icon: GraduationCap },
    { to: '/admin/fees',     label: 'Fee Structures', icon: CreditCard },
    { to: '/admin/staff',    label: 'Staff',          icon: Users },
    { to: '/admin/settings', label: 'Settings',       icon: Settings },
  ],
  bursar: [
    { to: '/bursar',               label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/bursar/reconciliation',label: 'Live Feed',    icon: Wallet },
    { to: '/bursar/students',      label: 'Students',     icon: GraduationCap },
    { to: '/bursar/reports',       label: 'Reports',      icon: FileText },
    { to: '/bursar/overpayments',  label: 'Overpayments', icon: CreditCard },
  ],
  parent: [
    { to: '/parent',          label: 'Dashboard',      icon: LayoutDashboard },
    { to: '/parent/children', label: 'My Children',    icon: BookOpen },
    { to: '/parent/payments', label: 'Payment History',icon: CreditCard },
  ],
}

const ROLE_COLOR = { admin: '#2563eb', bursar: '#059669', parent: '#7c3aed' }
const ROLE_LABEL = { admin: 'Admin Portal', bursar: 'Bursar Portal', parent: 'Parent Portal' }
const ROLE_USER  = { admin: 'Adebayo J.', bursar: 'Ngozi B.', parent: 'Mrs. Funke' }

function Sidebar({ role, onClose }) {
  const { user, logout } = useAuth()
  const { connected }    = useSocket() || {}
  const navigate         = useNavigate()
  const color            = ROLE_COLOR[role]
  const nav              = NAV[role] || []

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div style={{ background: color }} className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-base shadow-sm">
            🎓
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-none">EduPay</p>
            <p className="text-xs text-gray-400 mt-0.5">{ROLE_LABEL[role]}</p>
          </div>
        </div>
        {/* Server badge */}
        <div className={`mt-2.5 flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md w-fit
          ${ENV_NAME === 'LIVE' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ENV_NAME === 'LIVE' ? 'bg-green-500' : 'bg-blue-500'}`} />
          {ENV_NAME}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === `/${role}`}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}>
            <Icon size={17} />
            {label}
            {label === 'Live Feed' && (
              <span className="ml-auto w-2 h-2 rounded-full bg-green-400 shadow-[0_0_0_2px_#bbf7d0]" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-1">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-gray-300'}`} />
          {connected ? 'Live — payments updating' : 'Connecting...'}
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div style={{ background: color }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user?.fullName?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="nav-item w-full text-red-500 hover:bg-red-50">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  )
}

export default function DashboardLayout({ children }) {
  const { user }        = useAuth()
  const [open, setOpen] = useState(false)
  const role            = user?.role || 'admin'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-56 flex-shrink-0 flex-col">
        <Sidebar role={role} onClose={() => {}} />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-64 flex flex-col bg-white h-full shadow-xl">
            <Sidebar role={role} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={() => setOpen(true)} className="btn-ghost p-2">
            <Menu size={20} />
          </button>
          <span className="font-bold text-sm text-gray-900">EduPay</span>
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}