// Creates the EduPay owner account. Public sign-up refuses emails in PLATFORM_ADMIN_EMAILS,
// so this is the only way that account comes into existence.
// Usage:  node src/scripts/createPlatformAdmin.js "Full Name" owner@email.com "StrongPassword"
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { isPlatformAdminEmail } = require('../middleware/platformAdmin.middleware');

(async () => {
  const [fullName, rawEmail, password] = process.argv.slice(2);
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!fullName || !email || !password) { console.error('Usage: node src/scripts/createPlatformAdmin.js "Full Name" email password'); process.exit(1); }
  if (password.length < 8) { console.error('Password must be at least 8 characters'); process.exit(1); }
  if (!isPlatformAdminEmail(email)) { console.error('Add this email to PLATFORM_ADMIN_EMAILS first, then run again'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  if (await User.findOne({ email })) { console.error('An account with this email already exists'); process.exit(1); }
  await User.create({ fullName, email, password, role: 'admin', emailVerified: true, emailVerifiedAt: new Date() });
  console.log(`✅ Platform admin created: ${email}`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
