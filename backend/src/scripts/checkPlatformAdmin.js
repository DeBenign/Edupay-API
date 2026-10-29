// Explains why an account is (or is not) treated as the EduPay owner.
// Usage:  node src/scripts/checkPlatformAdmin.js owner@email.com
// Run it with the SAME .env your server uses (local .env, or `vercel env pull` for production).
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { isPlatformAdminEmail } = require('../middleware/platformAdmin.middleware');

(async () => {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email) { console.error('Usage: node src/scripts/checkPlatformAdmin.js owner@email.com'); process.exit(1); }

  const list = (process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const host = (process.env.MONGO_URI || '').split('@').pop().split('/')[0] || '(MONGO_URI missing)';
  console.log(`Database host        : ${host}`);
  console.log(`PLATFORM_ADMIN_EMAILS: ${list.length ? list.join(', ') : '(EMPTY)'}`);
  console.log(`Email in the list    : ${isPlatformAdminEmail(email) ? 'YES' : 'NO'}`);

  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email }).select('+password');
  if (!user) console.log('Account in database  : NOT FOUND (run createPlatformAdmin.js)');
  else {
    console.log(`Account in database  : found, role=${user.role}, schoolId=${user.schoolId || 'none'}, active=${user.isActive}, emailVerified=${user.emailVerified}`);
    console.log(`Login would return   : isPlatformAdmin=${isPlatformAdminEmail(email)}`);
  }

  console.log('\nWhat the screen will do:');
  if (!list.length || !isPlatformAdminEmail(email)) {
    console.log(' - This process does NOT treat the email as owner. Add it to PLATFORM_ADMIN_EMAILS.');
    console.log(' - Then RESTART the server (local) or REDEPLOY (Vercel): the list is read once at startup.');
  } else {
    console.log(' - This .env treats the email as owner. If the app still shows "Register Your School",');
    console.log('   the server answering your browser is a different one (other .env, or not restarted/redeployed).');
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
