// src/utils/dueState.js
// "Due in 3 days" / "Overdue by 5 days" for a fee's due date, counted in Lagos calendar days.
const DAY = 24 * 60 * 60 * 1000
const lagosDay = (d) => { const t = new Date(new Date(d).getTime() + 3600000); t.setUTCHours(0, 0, 0, 0); return t.getTime() }
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

export const dueState = (dueDate, now = Date.now()) => {
  if (!dueDate) return null
  const diff = Math.round((lagosDay(dueDate) - lagosDay(now)) / DAY)
  if (diff < 0)   return { days: diff, label: `Overdue by ${plural(-diff, 'day')}`, className: 'text-red-600 font-semibold' }
  if (diff === 0) return { days: 0, label: 'Due today', className: 'text-red-600 font-semibold' }
  if (diff <= 3)  return { days: diff, label: `Due in ${plural(diff, 'day')}`, className: 'text-amber-600 font-semibold' }
  return { days: diff, label: `Due in ${plural(diff, 'day')}`, className: 'text-gray-500' }
}
