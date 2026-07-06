// src/utils/formatters.js
export const formatCurrency = (n = 0) =>
  `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const formatDateTime = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const formatTimeAgo = (d) => {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return formatDate(d)
}

export const statusBadgeClass = (status) => ({
  paid:     'badge-paid',
  partial:  'badge-partial',
  unpaid:   'badge-unpaid',
  overpaid: 'badge-overpaid',
}[status] || 'badge-unpaid')

export const statusLabel = (status) => ({
  paid:     'Paid',
  partial:  'Partial',
  unpaid:   'Unpaid',
  overpaid: 'Overpaid',
}[status] || status)

export const reconciliationLabel = (status) => ({
  exact:        '✅ Exact',
  underpayment: '⚠️ Underpayment',
  overpayment:  '🔁 Overpayment',
}[status] || status)

export const termLabel = (term) => ({
  first:  'First Term',
  second: 'Second Term',
  third:  'Third Term',
}[term] || term)