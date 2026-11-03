// src/hooks/usePricing.js
// One place that loads the live pricing numbers (GET /subscriptions/pricing) for every public page.
// While loading, or if the backend cannot be reached, it returns the standard rates so a page never breaks.
import { useEffect, useState } from 'react'
import api from '../api/axios'

export const PRICING_FALLBACK = {
  subscription: {
    ratePerStudent: 300, minimum: 30000, pilotDays: 90, termDays: 120, graceDays: 7,
    examples: [50, 100, 300, 500, 1000].map((students) => ({ students, perTerm: Math.max(30000, students * 300) })),
  },
  serviceCharge: {
    rate: 0.015, flat: 100, cap: 2000, flatWaivedAtOrBelow: 2500,
    examples: [
      { schoolFee: 1000, parentPays: 1015, charge: 15, schoolReceives: 1000 },
      { schoolFee: 10000, parentPays: 10254, charge: 254, schoolReceives: 10000 },
      { schoolFee: 100000, parentPays: 101624, charge: 1624, schoolReceives: 100000 },
    ],
  },
  onlineSubscriptionPayments: false,
  contact: { whatsapp: null, phone: null, email: null },
}

export const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`
export const pct = (r) => `${(r * 100).toFixed(1).replace(/\.0$/, '')}%`

export default function usePricing() {
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    api.get('/subscriptions/pricing')
      .then((r) => { if (alive) setData(r.data.data) })
      .catch(() => { console.warn('Pricing: could not load live numbers, showing standard rates') })
    return () => { alive = false }
  }, [])
  return { data: data || PRICING_FALLBACK, live: Boolean(data) }
}