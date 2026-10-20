require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../src/models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({ $or: [{ referralCode: null }, { referralCode: { $exists: false } }] }).select('fullName');
  for (const u of users) {
    const prefix = (u.fullName || 'USER').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'USER';
    await User.updateOne({ _id: u._id }, { $set: { referralCode: `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}` } });
  }
  console.log(`Backfilled ${users.length} users`);
  process.exit(0);
})();