require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../src/models/Student');
const { generateLinkCode, linkCodeExpiry } = require('../src/utils/linkCode');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const list = await Student.find({ parentId: null, $or: [{ linkCode: null }, { linkCode: { $exists: false } }] }).select('_id');
  for (const s of list) {
    await Student.updateOne({ _id: s._id }, { $set: { linkCode: generateLinkCode(), linkCodeExpiresAt: linkCodeExpiry() } });
  }
  console.log(`Issued ${list.length} codes`);
  process.exit(0);
})();