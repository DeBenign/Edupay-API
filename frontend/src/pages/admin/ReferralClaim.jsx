// src/pages/shared/ReferralClaim.jsx  (used by admin, bursar and parent)
import { useEffect, useState } from 'react'
import { referralAPI } from '../../api'
import { Alert, Spinner } from '../../components/ui'
import { formatCurrency } from '../../utils/formatters'
import { useAuth } from '../../context/AuthContext'

const NETWORKS = ['mtn', 'glo', 'airtel', '9mobile']

function RewardCard({ reward, onDone }) {
  const [type,         setType]         = useState('airtime')
  const [network,      setNetwork]      = useState('mtn')
  const [phone,        setPhone]        = useState('')
  const [plans,        setPlans]        = useState([])
  const [plan,         setPlan]         = useState('')
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [busy,         setBusy]         = useState(false)

  useEffect(() => {
    if (type !== 'data') return
    setLoadingPlans(true); setPlan('')
    referralAPI.dataPlans({ network, maxAmount: reward.amount })
      .then(res => setPlans(res.data.data.plans))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false))
  }, [type, network, reward.amount])

  const canSubmit = phone.trim().length >= 10 && (type === 'airtime' || plan) && !busy

  const submit = async () => {
    setBusy(true)
    let outcome
    try {
      const res = await referralAPI.claimReward(reward._id, {
        phoneNumber: phone, network, rewardType: type,
        ...(type === 'data' && { variationCode: plan }),
      })
      outcome = { type: 'success', text: res.data?.message || 'Done' }
    } catch (err) {
      outcome = { type: 'error', text: err.response?.data?.message || 'Claim failed' }
    }
    setBusy(false)
    onDone(outcome)
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-medium text-gray-900">{formatCurrency(reward.amount)} reward</span>
        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
          {reward.status === 'failed' ? 'Try again' : 'Unclaimed'}
        </span>
      </div>

      <div className="flex gap-2">
        {['airtime', 'data'].map(t => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={`flex-1 text-sm rounded-lg border px-3 py-2 ${type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
            {t === 'airtime' ? 'Airtime' : 'Data bundle'}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} />
        <select className="input" value={network} onChange={e => setNetwork(e.target.value)}>
          {NETWORKS.map(n => <option key={n} value={n}>{n.toUpperCase()}</option>)}
        </select>
      </div>

      {type === 'data' && (
        loadingPlans ? <Spinner size="sm" /> : (
          plans.length === 0
            ? <p className="text-xs text-gray-500">No data plans available for this network within your reward value.</p>
            : (
              <select className="input w-full" value={plan} onChange={e => setPlan(e.target.value)}>
                <option value="">Choose a data plan</option>
                {plans.map(p => <option key={p.code} value={p.code}>{p.name} · {formatCurrency(p.amount)}</option>)}
              </select>
            )
        )
      )}

      <button className="btn-primary w-full" disabled={!canSubmit} onClick={submit}>
        {busy ? <Spinner size="sm" /> : type === 'airtime' ? `Claim ${formatCurrency(reward.amount)} airtime` : 'Claim data bundle'}
      </button>
    </div>
  )
}

export default function ReferralClaim() {

  const { user } = useAuth()
  
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice,  setNotice]  = useState(null)

  const load = async () => {
    try {
      const res = await referralAPI.myRewards()
      setRewards(res.data.data.rewards)
    } catch {
      setNotice({ type: 'error', text: 'Could not load your rewards' })
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDone = (outcome) => { setNotice(outcome); load() }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  const claimable = rewards.filter(r => ['unclaimed', 'failed'].includes(r.status))
  const history   = rewards.filter(r => ['processing', 'claimed'].includes(r.status))

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Referral Rewards</h1>
        <p className="page-sub">
          Earned when a school you referred pays through EduPay. Choose airtime or a data plan up to the reward's value.
        </p>
      </div>

      {user?.referralCode && (
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Your referral code</p>
            <p className="font-mono font-bold text-lg">{user.referralCode}</p>
          </div>
          <button className="btn-secondary text-xs" onClick={() => navigator.clipboard.writeText(user.referralCode)}>Copy</button>
        </div>
      )}
      {notice && <Alert type={notice.type} message={notice.text} onClose={() => setNotice(null)} />}

      {claimable.length === 0 && <p className="text-sm text-gray-500">No rewards to claim right now.</p>}
      {claimable.map(r => <RewardCard key={r._id} reward={r} onDone={handleDone} />)}

      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-2">History</h2>
          {history.map(r => (
            <div key={r._id} className="flex justify-between text-sm py-2 border-b border-gray-100">
              <span>
                {formatCurrency(r.amount)} · {r.rewardType === 'data' ? (r.planName || 'Data') : 'Airtime'}
                {r.phoneNumber ? ` · ${r.phoneNumber}` : ''}
              </span>
              <span className={r.status === 'claimed' ? 'text-green-600' : 'text-amber-600'}>
                {r.status === 'claimed' ? 'Claimed' : 'Processing'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}