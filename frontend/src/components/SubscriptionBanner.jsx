import { useEffect, useState } from 'react'
import { subscriptionAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatDate } from '../utils/formatters'

export default function SubscriptionBanner() {
  const { user } = useAuth()
  const [sub, setSub] = useState(null)

  useEffect(() => {
    if (!['admin', 'bursar'].includes(user?.role) || !user?.schoolId) return
    subscriptionAPI.mine().then(r => setSub(r.data.data.subscription)).catch(() => {})
  }, [user?.role, user?.schoolId])

  if (!sub || (sub.status !== 'due' && sub.daysLeft > 14)) return null
  const due = sub.status === 'due'
  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${due ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
      {sub.locked
        ? `Your EduPay subscription ended on ${formatDate(sub.activeUntil)}. Adding students, fees, staff and cash payments is paused until payment is recorded. Parent payments, balances and reports keep working.`
        : due
          ? `Your EduPay subscription is overdue. Adding students, fees, staff and cash payments pauses on ${formatDate(sub.graceEndsAt)} unless payment is recorded.`
          : `Your ${sub.status === 'pilot' ? 'pilot' : 'subscription'} ends in ${sub.daysLeft} day${sub.daysLeft === 1 ? '' : 's'} (${formatDate(sub.activeUntil)}).`}
        {' '}Pay {formatCurrency(sub.pricePerTerm)} per term ({sub.billableStudents} student{sub.billableStudents === 1 ? '' : 's'} × {formatCurrency(sub.ratePerStudent)}, minimum {formatCurrency(sub.minimum)}) to {sub.payTo.bank} <strong>{sub.payTo.accountNumber}</strong> ({sub.payTo.accountName}).
      {' '}Use your school name as the reference, then let EduPay know so it can be recorded.
    </div>
  )
}