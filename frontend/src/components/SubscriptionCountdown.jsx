// src/components/SubscriptionCountdown.jsx
// One countdown chip used by the school admin (banner, Settings) and the platform admin (Subscriptions, Overview).
// The numbers come from the API (daysLeft, overdueDays, lockInDays, phase, tone, countdownLabel),
// so both sides always show the same thing.

const TONES = {
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red:   'bg-red-50 text-red-700 border-red-200',
}

export default function SubscriptionCountdown({ sub, size = 'sm', className = '' }) {
  if (!sub) return null
  const tone = TONES[sub.tone] || TONES.green
  const pad = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs'
  const strong = sub.phase === 'locked' ? 'font-bold' : 'font-semibold'
  return (
    <span className={`inline-flex items-center rounded-full border whitespace-nowrap ${strong} ${pad} ${tone} ${className}`}>
      {sub.countdownLabel}
    </span>
  )
}
