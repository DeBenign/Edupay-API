// src/utils/csv.js
// Small CSV helpers for report exports.

// Quotes values that need it, and stops spreadsheet formula injection:
// a text cell starting with = + - @ would otherwise run as a formula when opened in Excel.
const esc = (v) => {
  let s = v === null || v === undefined ? '' : String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// rows: array of arrays. The BOM makes Excel read the file as UTF-8.
export const toCsv = (rows) => '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'

export const downloadCsv = (filename, csv) => {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}