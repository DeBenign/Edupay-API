// src/components/layout/DashboardLayout.jsx
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth }   from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import SubscriptionBanner from '../SubscriptionBanner'
import EnvBadge from '../EnvBadge'
import Logo from '../Logo'
import { portalOf } from '../../utils/roles'
import { LayoutDashboard, Users, GraduationCap, CreditCard, FileText, Settings, LogOut, Menu,
         BookOpen, Wallet, RotateCcw, Gift, ShieldCheck, UserCog } from 'lucide-react'

// One menu per portal. "platform" is the EduPay owner (no school). The other three belong to a school.
const NAV = {
  platform: [
    { to: '/platform',               label: 'Overview',      icon: LayoutDashboard },
    { to: '/platform/approvals',     label: 'Approvals',     icon: ShieldCheck },
    { to: '/platform/subscriptions', label: 'Subscriptions', icon: CreditCard },
    { to: '/platform/account',       label: 'Account',       icon: UserCog },
  ],
  admin: [
    { to: '/admin',              label: 'Dashboard',        icon: LayoutDashboard },
    { to: '/admin/students',     label: 'Students',         icon: GraduationCap },
    { to: '/admin/fees',         label: 'Fee Structures',   icon: CreditCard },
    { to: '/admin/overpayments', label: 'Overpayments',     icon: RotateCcw },
    { to: '/admin/staff',        label: 'Staff',            icon: Users },
    { to: '/admin/people',       label: 'People',           icon: Users },
    { to: '/admin/settings',     label: 'Settings',         icon: Settings },
    { to: '/admin/referrals',    label: 'Referral Rewards', icon: Gift },
    { to: '/admin/revenue',      label: 'Revenue',          icon: Wallet },
  ],
  bursar: [
    { to: '/bursar',                label: 'Dashboard',        icon: LayoutDashboard },
    { to: '/bursar/reconciliation', label: 'Live Feed',        icon: Wallet },
    { to: '/bursar/students',       label: 'Students',         icon: GraduationCap },
    { to: '/bursar/reports',        label: 'Reports',          icon: FileText },
    { to: '/bursar/overpayments',   label: 'Overpayments',     icon: CreditCard },
    { to: '/bursar/referrals',      label: 'Referral Rewards', icon: Gift },
    { to: '/bursar/revenue',        label: 'Revenue',          icon: Wallet },
  ],
  parent: [
    { to: '/parent',           label: 'Dashboard',        icon: LayoutDashboard },
    { to: '/parent/children',  label: 'My Children',      icon: BookOpen },
    { to: '/parent/payments',  label: 'Payment History',  icon: CreditCard },
    { to: '/parent/referrals', label: 'Referral Rewards', icon: Gift },
  ],
}

const ROLE_COLOR = { platform: '#0f172a', admin: '#2563eb', bursar: '#059669', parent: '#7c3aed' }
const ROLE_LABEL = { platform: 'Platform Admin', admin: 'Admin Portal', bursar: 'Bursar Portal', parent: 'Parent Portal' }

function Sidebar({ portal, onClose }) {
  const { user, logout } = useAuth()
  const { connected, disabled } = useSocket() || {}
  const navigate = useNavigate()
  const color = ROLE_COLOR[portal]
  const nav = NAV[portal] || []

  const handleLogout = () => { logout(); navigate('/login') }
  const liveText = disabled ? 'Live updates off — refresh to see new payments'
                 : connected ? 'Live — payments updating' : 'Connecting...'

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Logo size={34} />
          <div>
            <p className="font-bold text-gray-900 text-sm leading-none">EduPay</p>
            <p className="text-xs text-gray-400 mt-0.5">{ROLE_LABEL[portal]}</p>
          </div>
        </div>
        <EnvBadge />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === `/${portal}`}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}>
            <Icon size={17} />
            {label}
            {label === 'Live Feed' && !disabled && (
              <span className="ml-auto w-2 h-2 rounded-full bg-green-400 shadow-[0_0_0_2px_#bbf7d0]" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-1">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-gray-300'}`} />
          {liveText}
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
  const portal          = portalOf(user) || 'admin'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-56 flex-shrink-0 flex-col">
        <Sidebar portal={portal} onClose={() => {}} />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-64 flex flex-col bg-white h-full shadow-xl">
            <Sidebar portal={portal} onClose={() => setOpen(false)} />
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
          <SubscriptionBanner /> {children}
        </main>
      </div>
    </div>
  )
}
