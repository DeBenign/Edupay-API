import { useState } from 'react';
import api from '../../api';
import { Alert, Spinner } from '../../components/ui';

export default function WithdrawalRequest({ schoolId }) {
  const [form, setForm] = useState({ amount: '', accountNumber: '', bankCode: '', accountName: '', gateway: 'paystack' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.post(`/withdrawals/schools/${schoolId}`, form);
      setMessage({ type: 'success', text: data.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Withdrawal failed' });
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="card p-6 max-w-md space-y-4">
      <h2 className="font-semibold text-gray-900">Request Withdrawal</h2>
      {message && <Alert type={message.type} message={message.text} onClose={() => setMessage(null)} />}
      <input className="input" placeholder="Amount (₦)" type="number" required
        value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
      <input className="input" placeholder="Account number" required
        value={form.accountNumber} onChange={e => setForm(p => ({ ...p, accountNumber: e.target.value }))} />
      <input className="input" placeholder="Bank code" required
        value={form.bankCode} onChange={e => setForm(p => ({ ...p, bankCode: e.target.value }))} />
      <input className="input" placeholder="Account name" required
        value={form.accountName} onChange={e => setForm(p => ({ ...p, accountName: e.target.value }))} />
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? <Spinner size="sm" /> : 'Request Withdrawal'}
      </button>
    </form>
  );
}