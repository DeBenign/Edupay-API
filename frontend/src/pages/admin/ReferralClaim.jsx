import { useEffect, useState } from 'react';
import api from '../../api'; // adjust to your actual axios instance export
import { Alert, Spinner, Badge } from '../../components/ui';

const NETWORKS = ['mtn', 'glo', 'airtel', '9mobile'];

export default function ReferralClaim() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [form, setForm] = useState({ phoneNumber: '', network: 'mtn' });
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/referrals/rewards');
    setRewards(data.data.rewards);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const claim = async (rewardId) => {
    setClaiming(rewardId);
    setMessage(null);
    try {
      const { data } = await api.post(`/referrals/rewards/${rewardId}/claim`, form);
      setMessage({ type: 'success', text: data.message || 'Airtime sent!' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Claim failed' });
    } finally { setClaiming(null); }
  };

  if (loading) return <Spinner />;

  const unclaimed = rewards.filter(r => r.status === 'unclaimed');
  const history = rewards.filter(r => r.status !== 'unclaimed');

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Your Referral Rewards</h1>
      {message && <Alert type={message.type} message={message.text} onClose={() => setMessage(null)} />}

      {unclaimed.length === 0 && <p className="text-sm text-gray-500">No unclaimed rewards right now.</p>}

      {unclaimed.map((r) => (
        <div key={r._id} className="card p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-900">₦{r.amount.toLocaleString()} airtime</span>
            <Badge type="warning">Unclaimed</Badge>
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Phone number"
              value={form.phoneNumber}
              onChange={(e) => setForm(p => ({ ...p, phoneNumber: e.target.value }))}
            />
            <select
              className="input"
              value={form.network}
              onChange={(e) => setForm(p => ({ ...p, network: e.target.value }))}
            >
              {NETWORKS.map(n => <option key={n} value={n}>{n.toUpperCase()}</option>)}
            </select>
          </div>
          <button
            className="btn-primary w-full"
            disabled={!form.phoneNumber || claiming === r._id}
            onClick={() => claim(r._id)}
          >
            {claiming === r._id ? <Spinner size="sm" /> : 'Claim Airtime'}
          </button>
        </div>
      ))}

      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-2">History</h2>
          {history.map((r) => (
            <div key={r._id} className="flex justify-between text-sm py-2 border-b border-gray-100">
              <span>₦{r.amount.toLocaleString()}</span>
              <Badge type={r.status === 'claimed' ? 'success' : 'error'}>{r.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}