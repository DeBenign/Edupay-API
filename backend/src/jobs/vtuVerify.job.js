const cron = require('node-cron');
const ReferralReward = require('../models/ReferralReward');
const vtu = require('../services/vtu.service');

cron.schedule('*/10 * * * *', async () => {
  const stuck = await ReferralReward.find({ status: 'failed' });
  for (const r of stuck) {
    if (!r.vtpassRequestId) continue;
    const result = await vtu.verifyTransaction(r.vtpassRequestId);
    if (result?.content?.transactions?.status === 'delivered') {
      r.status = 'claimed';
      await r.save();
    }
  }
});