// src/App.jsx — Complete wiring of all pages
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth }   from './context/AuthContext'
import { SocketProvider }          from './context/SocketContext'
import { PageLoader }              from './components/ui'
import DashboardLayout             from './components/layout/DashboardLayout'

// ─── Auth ─────────────────────────────────────────────────────────────────────
import Login    from './pages/auth/Login'
import Register from './pages/auth/Register'

// ─── Admin ────────────────────────────────────────────────────────────────────
import AdminDashboard    from './pages/admin/Dashboard'
import AdminStudents     from './pages/admin/Students'
import AdminFeeStructures from './pages/admin/FeeStructures'
import AdminStaff        from './pages/admin/Staff'
import AdminSettings     from './pages/admin/Settings'

// ─── Bursar ───────────────────────────────────────────────────────────────────
import BursarDashboard    from './pages/bursar/Dashboard'
import BursarStudents     from './pages/bursar/Students'
import BursarStudentDetail from './pages/bursar/StudentDetail'
import BursarReports      from './pages/bursar/Reports'
import BursarOverpayments from './pages/bursar/Overpayments'

// ─── Parent ───────────────────────────────────────────────────────────────────
import ParentDashboard    from './pages/parent/Dashboard'
import ParentChildren     from './pages/parent/Children'
import ParentPaymentHistory from './pages/parent/PaymentHistory'
import ChildBalance       from './pages/parent/ChildBalance'
import ChildPayments      from './pages/parent/ChildPayments'

// ─── Protected route ──────────────────────────────────────────────────────────
const Protected = ({ children, roles }) => {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user)   return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={`/${user.role}`} replace />
  return children
}

// ─── Layout wrapper ───────────────────────────────────────────────────────────
const WithLayout = ({ children }) => (
  <SocketProvider>
    <DashboardLayout>{children}</DashboardLayout>
  </SocketProvider>
)

// ─── Root redirect based on role ──────────────────────────────────────────────
const RootRedirect = () => {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user)   return <Navigate to="/login" replace />
  return <Navigate to={`/${user.role}`} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Public ──────────────────────────────────────────────────────── */}
          <Route path="/"         element={<RootRedirect />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ── Admin ───────────────────────────────────────────────────────── */}
          <Route path="/admin" element={
            <Protected roles={['admin']}>
              <WithLayout><AdminDashboard /></WithLayout>
            </Protected>
          }/>
          <Route path="/admin/students" element={
            <Protected roles={['admin']}>
              <WithLayout><AdminStudents /></WithLayout>
            </Protected>
          }/>
          <Route path="/admin/fees" element={
            <Protected roles={['admin']}>
              <WithLayout><AdminFeeStructures /></WithLayout>
            </Protected>
          }/>
          <Route path="/admin/staff" element={
            <Protected roles={['admin']}>
              <WithLayout><AdminStaff /></WithLayout>
            </Protected>
          }/>
          <Route path="/admin/settings" element={
            <Protected roles={['admin']}>
              <WithLayout><AdminSettings /></WithLayout>
            </Protected>
          }/>

          {/* ── Bursar ──────────────────────────────────────────────────────── */}
          <Route path="/bursar" element={
            <Protected roles={['bursar']}>
              <WithLayout><BursarDashboard /></WithLayout>
            </Protected>
          }/>
          <Route path="/bursar/reconciliation" element={
            <Protected roles={['bursar']}>
              <WithLayout><BursarDashboard /></WithLayout>
            </Protected>
          }/>
          <Route path="/bursar/students" element={
            <Protected roles={['bursar']}>
              <WithLayout><BursarStudents /></WithLayout>
            </Protected>
          }/>
          <Route path="/bursar/students/:id" element={
            <Protected roles={['bursar']}>
              <WithLayout><BursarStudentDetail /></WithLayout>
            </Protected>
          }/>
          <Route path="/bursar/reports" element={
            <Protected roles={['bursar']}>
              <WithLayout><BursarReports /></WithLayout>
            </Protected>
          }/>
          <Route path="/bursar/overpayments" element={
            <Protected roles={['bursar']}>
              <WithLayout><BursarOverpayments /></WithLayout>
            </Protected>
          }/>

          {/* ── Parent ──────────────────────────────────────────────────────── */}
          <Route path="/parent" element={
            <Protected roles={['parent']}>
              <WithLayout><ParentDashboard /></WithLayout>
            </Protected>
          }/>
          <Route path="/parent/children" element={
            <Protected roles={['parent']}>
              <WithLayout><ParentChildren /></WithLayout>
            </Protected>
          }/>
          <Route path="/parent/payments" element={
            <Protected roles={['parent']}>
              <WithLayout><ParentPaymentHistory /></WithLayout>
            </Protected>
          }/>
          <Route path="/parent/children/:studentId/balance" element={
            <Protected roles={['parent']}>
              <WithLayout><ChildBalance /></WithLayout>
            </Protected>
          }/>
          <Route path="/parent/children/:studentId/payments" element={
            <Protected roles={['parent']}>
              <WithLayout><ChildPayments /></WithLayout>
            </Protected>
          }/>

          {/* ── Fallback ────────────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}