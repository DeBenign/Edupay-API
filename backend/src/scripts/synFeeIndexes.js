// scripts/syncFeeIndexes.js
require('dotenv').config();
const mongoose = require('mongoose');
const FeeStructure = require('../src/models/FeeStructure');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Dropped:', await FeeStructure.syncIndexes());
  process.exit(0);
})();