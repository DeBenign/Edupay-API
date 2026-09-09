// scripts/migrateVirtualAccounts.js
const Student = require('../src/models/Student');

(async () => {
  const students = await Student.find({ 'virtualAccount.accountNumber': { $ne: null } });
  for (const s of students) {
    const gw = s.virtualAccount.gateway || 'nomba';
    s.virtualAccounts = { ...s.virtualAccounts, [gw]: s.virtualAccount };
    s.virtualAccount = undefined; // drop the old field
    await s.save();
  }
  console.log(`Migrated ${students.length} students`);
  process.exit(0);
})();