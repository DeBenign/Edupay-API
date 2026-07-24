// src/services/revenue.service.js
// Task 3: visibility into platform revenue, total school revenues, and
// each school's revenue broken down by term/session/overall.
const mongoose = require('mongoose');
const Payment    = require('../models/Payment');
const Withdrawal = require('../models/Withdrawal');

// ── Platform's own revenue (sum of platformFee across ALL schools) ──────────
const getPlatformRevenue = async ({ from, to } = {}) => {
  const match = {};
  if (from || to) match.processedAt = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };

  const [agg] = await Payment.aggregate([
    { $match: match },
    { $group: { _id: null, totalPlatformFee: { $sum: '$platformFee' }, paymentCount: { $sum: 1 } } },
  ]);

  const withdrawn = await getWithdrawnTotal({ type: 'platform' });
  const totalPlatformFee = agg?.totalPlatformFee || 0;

  return {
    totalRevenue: totalPlatformFee,
    paymentCount: agg?.paymentCount || 0,
    totalWithdrawn: withdrawn,
    availableToWithdraw: totalPlatformFee - withdrawn,
  };
};

// ── One school's revenue, optionally filtered by term/academicSession ──────
const getSchoolRevenue = async (schoolId, { term, academicSession } = {}) => {
  const match = { schoolId: new mongoose.Types.ObjectId(schoolId) };

  const pipeline = [
    { $match: match },
    { $lookup: { from: 'feeassignments', localField: 'feeAssignmentId', foreignField: '_id', as: 'assignment' } },
    { $unwind: '$assignment' },
    { $lookup: { from: 'feestructures', localField: 'assignment.feeStructureId', foreignField: '_id', as: 'structure' } },
    { $unwind: '$structure' },
  ];

  const structureMatch = {};
  if (term)            structureMatch['structure.term'] = term;
  if (academicSession) structureMatch['structure.academicSession'] = academicSession;
  if (Object.keys(structureMatch).length) pipeline.push({ $match: structureMatch });

  pipeline.push({
    $group: {
      _id: null,
      totalRevenue:    { $sum: '$netAmountForSchool' },
      totalCollected:  { $sum: '$amountPaid' },
      totalPlatformFee:{ $sum: '$platformFee' },
      paymentCount:    { $sum: 1 },
    },
  });

  const [agg] = await Payment.aggregate(pipeline);
  const withdrawn = await getWithdrawnTotal({ type: 'school', schoolId });

  const totalRevenue = agg?.totalRevenue || 0;
  return {
    totalRevenue,
    totalCollected:   agg?.totalCollected   || 0,
    totalPlatformFee: agg?.totalPlatformFee || 0,
    paymentCount:     agg?.paymentCount     || 0,
    totalWithdrawn:   withdrawn,
    availableToWithdraw: totalRevenue - withdrawn,
    filters: { term: term || 'all', academicSession: academicSession || 'all' },
  };
};

// ── Every school's revenue at once, for a platform-level overview ──────────
const getAllSchoolsRevenue = async () => {
  const results = await Payment.aggregate([
    {
      $group: {
        _id: '$schoolId',
        totalRevenue:     { $sum: '$netAmountForSchool' },
        totalCollected:   { $sum: '$amountPaid' },
        totalPlatformFee: { $sum: '$platformFee' },
        paymentCount:     { $sum: 1 },
      },
    },
    { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 'school' } },
    { $unwind: '$school' },
    {
      $project: {
        _id: 0,
        schoolId:  '$_id',
        schoolName: '$school.name',
        totalRevenue: 1, totalCollected: 1, totalPlatformFee: 1, paymentCount: 1,
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);
  return results;
};

const getWithdrawnTotal = async ({ type, schoolId = null }) => {
  const match = { type, status: { $in: ['completed', 'processing'] } };
  if (schoolId) match.schoolId = new mongoose.Types.ObjectId(schoolId);
  const [agg] = await Withdrawal.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  return agg?.total || 0;
};

module.exports = { getPlatformRevenue, getSchoolRevenue, getAllSchoolsRevenue, getWithdrawnTotal };