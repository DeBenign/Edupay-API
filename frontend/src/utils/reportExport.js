// src/utils/reportExport.js
// Builds the bursar report CSV from the class breakdown shown on the Reports page.
import { toCsv } from './csv'

const rate = (collected, expected) => (expected > 0 ? Math.round((collected / expected) * 100) : 0)

// One row per class plus a TOTAL row, so the file matches the table (and its filters)
export const classReportCsv = (classes) => {
  const sum = (k) => classes.reduce((n, x) => n + (x[k] || 0), 0)
  const head = ['Class', 'Students', 'Expected (NGN)', 'Collected (NGN)', 'Outstanding (NGN)',
                'Fully paid', 'Partial', 'Unpaid', 'Overpaid', 'Collection rate (%)']
  const body = classes.map((k) => [k.class, k.totalStudents, k.totalExpected, k.totalCollected, k.totalOutstanding,
                                   k.fullyPaid, k.partialCount, k.unpaidCount, k.overpaidCount, k.rate || 0])
  const total = ['TOTAL', sum('totalStudents'), sum('totalExpected'), sum('totalCollected'), sum('totalOutstanding'),
                 sum('fullyPaid'), sum('partialCount'), sum('unpaidCount'), sum('overpaidCount'),
                 rate(sum('totalCollected'), sum('totalExpected'))]
  return toCsv([head, ...body, total])
}

export const reportFileName = (filters = {}, date = new Date()) =>
  ['edupay-report', filters.term, (filters.academicSession || '').replace(/[^\w-]+/g, '-'), date.toISOString().slice(0, 10)]
    .filter(Boolean).join('_') + '.csv'