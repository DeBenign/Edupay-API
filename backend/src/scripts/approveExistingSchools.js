// One-time: stamp every school created before the approval feature as approved (explicit, for the audit trail).
// Not required for the rollout (a missing `approval` already counts as approved). Dry run by default.
// Usage:  node src/scripts/approveExistingSchools.js          (shows what would change)
//         node src/scripts/approveExistingSchools.js --apply
require('dotenv').config();
const mongoose = require('mongoose');
const School = require('../models/School');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI);
  const legacy = await School.find({ 'approval.status': { $exists: false } }).select('name createdAt');
  console.log(`${legacy.length} school(s) without an approval record`);
  legacy.forEach((s) => console.log(' -', s.name));
  if (apply && legacy.length) {
    const now = new Date();
    await School.updateMany({ _id: { $in: legacy.map((s) => s._id) } }, { $set: {
      'approval.status': 'approved', 'approval.decidedAt': now,
      'approval.history': [{ status: 'approved', at: now, note: 'Existing school, approved when approvals were introduced' }],
    } });
    console.log('✅ Marked as approved');
  } else if (!apply) console.log('Dry run only. Add --apply to write.');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
