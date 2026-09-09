import { useEffect, useState } from 'react';
import api from '../../api';
import { Spinner, StatCard } from '../../components/ui';

export default function Revenue({ scope = 'school', schoolId }) {
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = scope === 'platform' ? '/reports/platform-revenue' : `/reports/school-revenue/${schoolId}`;
    api.get(url).then(({ data }) => setRevenue(data.data.revenue)).finally(() => setLoading(false));
  }, [scope, schoolId]);

  if (loading) return <Spinner />;
  if (!revenue) return <p className="text-sm text-gray-500">No revenue data yet.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {scope === 'platform' ? (
        <>
          <StatCard label="Total Volume" value={`₦${revenue.totalVolume.toLocaleString()}`} />
          <StatCard label="Platform Fees Earned" value={`₦${revenue.totalPlatformFees.toLocaleString()}`} />
          <StatCard label="Transactions" value={revenue.transactionCount} />
        </>
      ) : (
        <>
          <StatCard label="Total Collected" value={`₦${revenue.totalCollected.toLocaleString()}`} />
          <StatCard label="Net Revenue" value={`₦${revenue.netRevenue.toLocaleString()}`} />
          <StatCard label="Platform Fees Deducted" value={`₦${revenue.platformFees.toLocaleString()}`} />
        </>
      )}
    </div>
  );
}