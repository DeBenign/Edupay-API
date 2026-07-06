// src/components/ui/index.jsx
import { statusBadgeClass, statusLabel } from '../../utils/formatters'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

// ─── Status Badge ─────────────────────────────────────────────────────────────
export const StatusBadge = ({ status }) => (
  <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>
)

// ─── Spinner ──────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' }
  return (
    <div className={`animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 ${sizes[size]} ${className}`} />
  )
}

export const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <Spinner size="lg" className="mx-auto mb-3" />
      <p className="text-sm text-gray-500">Loading EduPay...</p>
    </div>
  </div>
)

// ─── Modal ────────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${widths[size]} animate-fade-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5 -mr-1.5">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {Icon && <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
      <Icon size={22} className="text-gray-400" />
    </div>}
    <p className="font-medium text-gray-700 mb-1">{title}</p>
    {description && <p className="text-sm text-gray-400 max-w-xs mb-4">{description}</p>}
    {action}
  </div>
)

// ─── Stat Card ────────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, sub, accent = 'blue', icon: Icon }) => {
  const accents = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        {Icon && <span className={`p-1.5 rounded-lg ${accents[accent]}`}><Icon size={16} /></span>}
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ─── Alert ────────────────────────────────────────────────────────────────────
export const Alert = ({ type = 'info', message, onClose }) => {
  const styles = {
    info:    { bg: 'bg-blue-50  border-blue-200',  text: 'text-blue-800',  Icon: Info },
    success: { bg: 'bg-green-50 border-green-200', text: 'text-green-800', Icon: CheckCircle },
    warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', Icon: AlertTriangle },
    error:   { bg: 'bg-red-50   border-red-200',   text: 'text-red-800',   Icon: AlertCircle },
  }
  const { bg, text, Icon } = styles[type]
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${bg} ${text}`}>
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <p className="flex-1">{message}</p>
      {onClose && <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={14} /></button>}
    </div>
  )
}

// ─── Table Wrapper ────────────────────────────────────────────────────────────
export const Table = ({ headers, children, loading }) => (
  <div className="overflow-x-auto">
    <table className="table-base">
      <thead>
        <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {loading
          ? <tr><td colSpan={headers.length} className="py-12 text-center text-gray-400">
              <Spinner className="mx-auto" />
            </td></tr>
          : children}
      </tbody>
    </table>
  </div>
)

// ─── Pagination ───────────────────────────────────────────────────────────────
export const Pagination = ({ pagination, onChange }) => {
  if (!pagination || pagination.totalPages <= 1) return null
  const { page, totalPages, totalCount } = pagination
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
      <span>{totalCount} record{totalCount !== 1 ? 's' : ''}</span>
      <div className="flex items-center gap-2">
        <button className="btn-secondary py-1.5 px-3" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <span className="px-2">Page {page} of {totalPages}</span>
        <button className="btn-secondary py-1.5 px-3" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  )
}

// ─── Form Field ───────────────────────────────────────────────────────────────
export const Field = ({ label, error, children, required }) => (
  <div>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>}
    {children}
    {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
  </div>
)

// ─── Toast notification ───────────────────────────────────────────────────────
export const Toast = ({ toasts, remove }) => (
  <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    {toasts.map(t => (
      <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-in
        ${t.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'}`}>
        {t.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
        {t.message}
        <button onClick={() => remove(t.id)}><X size={14} /></button>
      </div>
    ))}
  </div>
)
