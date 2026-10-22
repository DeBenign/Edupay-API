// Test helper: move a school's subscription dates so you can try the lock.
//
// Run from the backend folder. The school can be given by name, email or id.
//   node src/scripts/setPilotEnd.js "De-Benign Schools"                      dry run, shows what would change
//   node src/scripts/setPilotEnd.js "De-Benign Schools" --yes                pilot ended 10 days ago (past the 7-day grace): LOCKED
//   node src/scripts/setPilotEnd.js "De-Benign Schools" --days-ago 3 --yes   ended 3 days ago: inside the grace period
//   node src/scripts/setPilotEnd.js "De-Benign Schools" --restore --yes      pilot ends in 120 days again
// Every mode clears paidUntil and any extension, so the dates you set are the ones that count.
require('dotenv').config();
const mongoose = require('mongoose');
const School = require('../models/School');
const { accessOf } = require('../services/subscriptionAccess.service');

const DAY_MS = 24 * 60 * 60 * 1000;

const parseArgs = (argv) => {
  const args = { query: null, yes: false, restore: false, daysAgo: 10 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes') args.yes = true;
    else if (a === '--restore') args.restore = true;
    else if (a === '--days-ago') args.daysAgo = Number(argv[++i]);
    else if (!a.startsWith('--') && !args.query) args.query = a;
    else throw new Error(`Unknown option: ${a}`);
  }
  if (!args.query) throw new Error('Give the school name, email or id');
  if (!Number.isFinite(args.daysAgo) || args.daysAgo < 0) throw new Error('--days-ago must be a number of 0 or more');
  return args;
};

// The new dates
const plan = ({ restore, daysAgo }, now = Date.now()) => ({
  'subscription.pilotEndsAt': new Date(restore ? now + 120 * DAY_MS : now - daysAgo * DAY_MS),
  'subscription.paidUntil': null,
  'subscription.extendedUntil': null,
});

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : 'none');
const describe = (school) => {
  const a = accessOf(school);
  const state = a.locked ? 'LOCKED' : a.inGrace ? 'in grace period' : 'open';
  return `pilot ends ${fmt(school.subscription?.pilotEndsAt)}, paid until ${fmt(school.subscription?.paidUntil)}, ` +
         `extended to ${fmt(school.subscription?.extendedUntil)} → ${state}`;
};

const findSchools = async (q) => {
  if (mongoose.isValidObjectId(q)) {
    const byId = await School.findById(q);
    if (byId) return [byId];
  }
  const rx = new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  return School.find({ $or: [{ name: rx }, { email: rx }] });
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Database: ${mongoose.connection.name} on ${mongoose.connection.host}`);

  const found = await findSchools(args.query);
  if (found.length === 0) { console.error(`No school matches "${args.query}"`); process.exit(1); }
  if (found.length > 1) {
    console.error('More than one school matches. Use the email or id instead:');
    found.forEach((s) => console.error(`  ${s._id}  ${s.name}  ${s.email}`));
    process.exit(1);
  }

  const school = found[0];
  const update = plan(args);
  console.log(`School:  ${school.name} (${school.email})`);
  console.log(`Now:     ${describe(school)}`);

  if (!args.yes) {
    console.log(`Would set the pilot end to ${fmt(update['subscription.pilotEndsAt'])} and clear payments and extensions.`);
    console.log('Dry run only. Add --yes to apply.');
    process.exit(0);
  }

  await School.updateOne({ _id: school._id }, { $set: update });
  console.log(`After:   ${describe(await School.findById(school._id))}`);
  console.log('Note: the running server caches lock status for up to a minute.');
  process.exit(0);
};

if (require.main === module) main().catch((err) => { console.error(err.message); process.exit(1); });

module.exports = { parseArgs, plan };