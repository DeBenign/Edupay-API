const cron = require('node-cron');
const ReferralReward = require('../models/ReferralReward');
const vtu = require('../services/vtu.service');

const runVtuVerify = async () => {
  const stuck = await ReferralReward.find({ status: 'failed' });
  for (const r of stuck) {
    if (!r.vtpassRequestId) continue;
    const result = await vtu.verifyTransaction(r.vtpassRequestId);
    if (result?.content?.transactions?.status === 'delivered') {
      r.status = 'claimed';
      await r.save();
    }
  }
};

// Long-running host: schedules itself. Vercel: /api/cron/vtu calls runVtuVerify instead.
if (!process.env.VERCEL) {
  cron.schedule('*/10 * * * *', () => runVtuVerify().catch((e) => console.error('❌ [CRON] VTU verify failed:', e.message)));
}

module.exports = { runVtuVerify };
