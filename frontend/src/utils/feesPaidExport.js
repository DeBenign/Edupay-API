// src/utils/feesPaidExport.js
// "Fees paid so far": the report as an Excel file (3 sheets), a CSV, or a print / save-as-PDF page.
import { toCsv, downloadCsv } from './csv'

const TERM = { first: 'First Term', second: 'Second Term', third: 'Third Term' }
const STATUS = { paid: 'Paid in full', partial: 'Part paid', unpaid: 'Not paid', overpaid: 'Overpaid' }
const dateOnly = (d) => (d ? new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }) : '')
const dateTime = (d) => (d ? new Date(d).toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) : '')
const num = (v) => Number(v || 0)
const money = (v) => num(v).toLocaleString('en-NG')
// +234 803 123 4567 -> 08031234567 (also keeps a leading + from being read as a formula in CSV)
const phoneOut = (v) => { const d = String(v || '').replace(/\D/g, ''); return /^234\d{10}$/.test(d) ? '0' + d.slice(3) : String(v || '') }

export const scopeLabel = (f = {}) =>
  [f.term ? TERM[f.term] : 'All terms', f.academicSession || null, f.class ? `Class: ${f.class}` : null].filter(Boolean).join(' · ')

export const exportFileName = (data, ext, date = new Date()) =>
  ['fees-paid', data.filters?.term, data.filters?.academicSession, data.filters?.class, date.toISOString().slice(0, 10)]
    .filter(Boolean).map((x) => String(x).replace(/[^\w-]+/g, '-')).join('_') + '.' + ext

const LEDGER_HEAD = ['Student ID', 'Student name', 'Class', 'Fee', 'Term', 'Session', 'Due date', 'Expected (NGN)', 'Paid (NGN)', 'Balance (NGN)',
  'Overpaid (NGN)', 'Status', 'Last payment', 'No. of payments', 'Parent', 'Parent phone', 'Parent email']
const ledgerRow = (r) => [r.studentCode, r.studentName, r.class, r.fee, TERM[r.term] || r.term, r.session, dateOnly(r.dueDate), num(r.expected), num(r.paid),
  num(r.balance), num(r.overpayment), STATUS[r.status] || r.status, dateOnly(r.lastPaymentAt), r.paymentCount, r.parentName, phoneOut(r.parentPhone), r.parentEmail]
const totalRow = (t) => ['TOTAL', `${t.students} students`, '', '', '', '', '', t.expected, t.paid, t.outstanding, t.overpaid, `${t.rate}% collected`, '', t.payments, '', '', '']

const PAYMENT_HEAD = ['Date', 'Student ID', 'Student name', 'Class', 'Fee', 'Amount paid by parent (NGN)', 'Applied to fee (NGN)', 'Service charge (NGN)', 'Method', 'Channel', 'Reference', 'Payer', 'Payer bank']
const paymentRow = (p) => [dateTime(p.date), p.studentCode, p.studentName, p.class, p.fee, num(p.amountPaid), num(p.appliedToFee), num(p.serviceCharge), p.method, p.channel, p.reference, p.payer, p.bank]

// ── CSV: the student ledger plus a TOTAL row ─────────────────────────────────
export const feesPaidCsv = (data) => toCsv([LEDGER_HEAD, ...data.ledger.map(ledgerRow), totalRow(data.totals)])
export const downloadFeesPaidCsv = (data) => downloadCsv(exportFileName(data, 'csv'), feesPaidCsv(data))

// ── Excel: Summary, Students, Payments ───────────────────────────────────────
const H = (v) => ({ value: v, fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: '#1F3A5F', wrap: true, alignVertical: 'center' })
const B = (v, extra = {}) => ({ value: v, fontWeight: 'bold', ...extra })
const NGN = '#,##0'
const N = (v, bold = false) => ({ value: num(v), type: Number, format: NGN, ...(bold ? { fontWeight: 'bold' } : {}) })
const S = (v, bold = false) => ({ value: v == null ? '' : String(v), ...(bold ? { fontWeight: 'bold' } : {}) })

export const buildSheets = (data) => {
  const t = data.totals
  const summary = [
    [B(data.school?.name || 'School', { fontSize: 14 })],
    [S(`Fees paid so far: ${scopeLabel(data.filters)}`)],
    [S(`Generated ${dateTime(data.generatedAt)}`)],
    [],
    [H('Measure'), H('Value')],
    [S('Students with fees'), N(t.students)],
    [S('Total expected (NGN)'), N(t.expected)],
    [S('Total paid so far (NGN)', true), N(t.paid, true)],
    [S('Outstanding (NGN)'), N(t.outstanding)],
    [S('Overpaid (NGN)'), N(t.overpaid)],
    [S('Collection rate'), S(`${t.rate}%`)],
    [S('Paid in full'), N(t.paidInFull)],
    [S('Part paid'), N(t.partial)],
    [S('Not paid'), N(t.unpaid)],
    [S('Overpaid'), N(t.overpaidCount)],
    [S('Payments recorded'), N(t.payments)],
    ...(data.truncated ? [[], [S('Note: the list was cut short because it is very large. Filter by class or term to see everything.')]] : []),
  ]
  const money5 = new Set([7, 8, 9, 10])
  const students = [
    LEDGER_HEAD.map(H),
    ...data.ledger.map((r) => ledgerRow(r).map((v, i) => (money5.has(i) ? N(v) : i === 13 ? N(v) : S(v)))),
    totalRow(t).map((v, i) => (money5.has(i) ? N(v, true) : i === 13 ? N(v, true) : S(v, true))),
  ]
  const money6 = new Set([5, 6, 7])
  const payments = [
    PAYMENT_HEAD.map(H),
    ...data.payments.map((p) => paymentRow(p).map((v, i) => (money6.has(i) ? N(v) : S(v)))),
    ['TOTAL', '', '', '', '', data.payments.reduce((s, p) => s + num(p.amountPaid), 0), data.payments.reduce((s, p) => s + num(p.appliedToFee), 0),
      data.payments.reduce((s, p) => s + num(p.serviceCharge), 0)].map((v, i) => (i >= 5 ? N(v, true) : S(v, true))),
  ]
  return [
    { sheet: 'Summary',  data: summary,  columns: [{ width: 34 }, { width: 18 }] },
    { sheet: 'Students', data: students, columns: [14, 26, 10, 22, 12, 12, 13, 15, 14, 14, 14, 14, 13, 11, 22, 15, 26].map((width) => ({ width })), stickyRowsCount: 1 },
    { sheet: 'Payments', data: payments, columns: [20, 14, 26, 10, 22, 18, 16, 14, 18, 10, 30, 24, 18].map((width) => ({ width })), stickyRowsCount: 1 },
  ]
}

export const downloadFeesPaidXlsx = async (data) => {
  const { default: writeExcelFile } = await import('write-excel-file/browser')   // loaded only when needed
  await writeExcelFile(buildSheets(data)).toFile(exportFileName(data, 'xlsx'))
}

// ── Print / save as PDF ──────────────────────────────────────────────────────
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export const printHtml = (data) => {
  const t = data.totals
  const head = ['Student ID', 'Student', 'Class', 'Fee', 'Expected', 'Paid', 'Balance', 'Status', 'Last payment']
  const rows = data.ledger.map((r) => `<tr><td>${esc(r.studentCode)}</td><td>${esc(r.studentName)}</td><td>${esc(r.class)}</td><td>${esc(r.fee)}</td>
    <td class="n">${money(r.expected)}</td><td class="n">${money(r.paid)}</td><td class="n">${money(r.balance)}</td><td>${esc(STATUS[r.status] || r.status)}</td><td>${esc(dateOnly(r.lastPaymentAt))}</td></tr>`).join('')
  const pay = data.payments.map((p) => `<tr><td>${esc(dateTime(p.date))}</td><td>${esc(p.studentName)}<br><span class="m">${esc(p.studentCode)} · ${esc(p.class)}</span></td><td>${esc(p.fee)}</td>
    <td class="n">${money(p.appliedToFee)}</td><td>${esc(p.method)}</td><td class="m">${esc(p.reference)}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(exportFileName(data, 'pdf').replace(/\.pdf$/, ''))}</title><style>
  @page { size: A4 landscape; margin: 12mm }
  body { font: 11px/1.4 Arial, Helvetica, sans-serif; color: #111 }
  h1 { font-size: 18px; margin: 0 0 2px } h2 { font-size: 13px; margin: 18px 0 6px } .m { color: #666; font-size: 10px }
  .sum { display: flex; gap: 18px; margin: 10px 0 4px; flex-wrap: wrap } .sum div { border: 1px solid #ccc; border-radius: 6px; padding: 6px 12px } .sum b { display: block; font-size: 14px }
  table { width: 100%; border-collapse: collapse } th { background: #1F3A5F; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px }
  td { padding: 4px 6px; border-bottom: 1px solid #ddd; vertical-align: top } tr { page-break-inside: avoid } .n { text-align: right; white-space: nowrap }
  tfoot td { font-weight: bold; border-top: 2px solid #1F3A5F } thead { display: table-header-group } .pb { page-break-before: always }
  </style></head><body>
  <h1>${esc(data.school?.name || 'School')}: fees paid so far</h1>
  <div class="m">${esc(scopeLabel(data.filters))} · Generated ${esc(dateTime(data.generatedAt))}</div>
  <div class="sum"><div><b>₦${money(t.expected)}</b>Expected</div><div><b>₦${money(t.paid)}</b>Paid so far</div><div><b>₦${money(t.outstanding)}</b>Outstanding</div>
  <div><b>${t.rate}%</b>Collected</div><div><b>${t.paidInFull} / ${t.partial} / ${t.unpaid}</b>Paid / Part / Unpaid</div></div>
  ${data.truncated ? '<p class="m">This list was cut short because it is very large. Filter by class or term to see everything.</p>' : ''}
  <h2>Students (${data.ledger.length})</h2>
  <table><thead><tr>${head.map((h) => `<th${['Expected', 'Paid', 'Balance'].includes(h) ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>
  <tfoot><tr><td colspan="4">TOTAL</td><td class="n">${money(t.expected)}</td><td class="n">${money(t.paid)}</td><td class="n">${money(t.outstanding)}</td><td colspan="2"></td></tr></tfoot></table>
  ${data.payments.length ? `<h2 class="pb">Payments received (${data.payments.length})</h2>
  <table><thead><tr><th>Date</th><th>Student</th><th>Fee</th><th class="n">Applied to fee</th><th>Method</th><th>Reference</th></tr></thead><tbody>${pay}</tbody></table>` : ''}
  </body></html>`
}

// A hidden iframe avoids pop-up blockers. In the print dialog the person can choose "Save as PDF".
export const printFeesPaid = (data) => {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentWindow.document
  doc.open(); doc.write(printHtml(data)); doc.close()
  const go = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 60000) }
  if (doc.readyState === 'complete') setTimeout(go, 100); else frame.onload = () => setTimeout(go, 100)
}
