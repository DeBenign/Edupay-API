// src/services/revenue.service.js
const mongoose = require('mongoose');
const Payment       = require('../models/Payment');
const Withdrawal    = require('../models/Withdrawal');
const FeeAssignment = require('../models/FeeAssignment');

const oid = (id) => new mongoose.Types.ObjectId(id);

// ── Platform revenue ─────────────────────────────────────────────────────────
const sumPlatform = async (match = {}) => {
  const [agg] = await Payment.aggregate([
    { $match: match },
    { $group: {
        _id: null,
        totalPlatformFee: { $sum: '$platformFee' },
        totalGatewayFee:  { $sum: '$gatewayFee' },
        paymentCount:     { $sum: 1 },
    } },
  ]);
  return {
    totalPlatformFee: agg?.totalPlatformFee || 0,
    totalGatewayFee:  agg?.totalGatewayFee  || 0,
    paymentCount:     agg?.paymentCount     || 0,
  };
};

const getPlatformRevenue = async ({ from, to } = {}) => {
  const range = {};
  if (from || to) range.processedAt = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };
  const hasRange = Object.keys(range).length > 0;

  const period    = await sumPlatform(range);
  const allTime   = hasRange ? await sumPlatform({}) : period;
  const withdrawn = await getWithdrawnTotal({ type: 'platform' });

  return {
    totalRevenue:        period.totalPlatformFee,                          // service charges collected (gross)
    totalGatewayFee:     period.totalGatewayFee,                           // what Nomba/Paystack took
    netMargin:           period.totalPlatformFee - period.totalGatewayFee, // your real profit
    paymentCount:        period.paymentCount,
    totalWithdrawn:      withdrawn,
    // Availability is always all-time, regardless of any date filter
    availableToWithdraw: Math.max(allTime.totalPlatformFee - allTime.totalGatewayFee - withdrawn, 0),
  };
};

// ── School revenue helpers ───────────────────────────────────────────────────
// Only gateway payments sit in the wallet. Manual (cash) payments are the school's own cash.
const getSchoolGatewayRevenue = async (schoolId) => {
  const [agg] = await Payment.aggregate([
    { $match: { schoolId: oid(schoolId), source: { $ne: 'manual' } } },
    { $group: { _id: null, total: { $sum: '$netAmountForSchool' } } },
  ]);
  return agg?.total || 0;
};

// Overpayments that are owed back, or already refunded, are not the school's to withdraw
const getHeldOverpayments = async (schoolId) => {
  const [agg] = await FeeAssignment.aggregate([
    { $match: {
        schoolId: oid(schoolId),
        status: 'overpaid',
        overpaymentResolution: { $in: ['pending', 'refund_requested', 'refunded'] },
    } },
    { $group: { _id: null, total: { $sum: '$overpayment' } } },
  ]);
  return agg?.total || 0;
};

// ── One school's revenue, optionally filtered by term/academicSession ────────
const getSchoolRevenue = async (schoolId, { term, academicSession } = {}) => {
  const pipeline = [
    { $match: { schoolId: oid(schoolId) } },
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
      totalRevenue:     { $sum: '$netAmountForSchool' },
      manualRevenue:    { $sum: { $cond: [{ $eq: ['$source', 'manual'] }, '$netAmountForSchool', 0] } },
      totalCollected:   { $sum: '$amountPaid' },
      totalPlatformFee: { $sum: '$platformFee' },
      paymentCount:     { $sum: 1 },
    },
  });

  const [agg] = await Payment.aggregate(pipeline);
  const [withdrawn, gatewayRevenue, held] = await Promise.all([
    getWithdrawnTotal({ type: 'school', schoolId }),
    getSchoolGatewayRevenue(schoolId),
    getHeldOverpayments(schoolId),
  ]);

  return {
    totalRevenue:     agg?.totalRevenue     || 0,   // includes cash recorded by the bursar
    manualRevenue:    agg?.manualRevenue    || 0,   // cash payments (not in the wallet)
    totalCollected:   agg?.totalCollected   || 0,
    totalPlatformFee: agg?.totalPlatformFee || 0,
    paymentCount:     agg?.paymentCount     || 0,
    totalWithdrawn:   withdrawn,
    heldForRefunds:   held,
    availableToWithdraw: Math.max(gatewayRevenue - withdrawn - held, 0), // all-time, gateway money only
    filters: { term: term || 'all', academicSession: academicSession || 'all' },
  };
};

const getWithdrawnTotal = async ({ type, schoolId = null }) => {
  const match = { type, status: { $in: ['completed', 'processing'] } };
  if (schoolId) match.schoolId = oid(schoolId);
  const [agg] = await Withdrawal.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  return agg?.total || 0;
};
// Raw numbers for the overdraw check (never clipped at zero)
const getWithdrawableTotals = async ({ type, schoolId = null }) => {
  if (type === 'school') {
    const [gateway, held, withdrawn] = await Promise.all([
      getSchoolGatewayRevenue(schoolId), getHeldOverpayments(schoolId), getWithdrawnTotal({ type: 'school', schoolId }),
    ]);
    return { earned: gateway - held, withdrawn };
  }
  const [p, withdrawn] = await Promise.all([sumPlatform({}), getWithdrawnTotal({ type: 'platform' })]);
  return { earned: p.totalPlatformFee - p.totalGatewayFee, withdrawn };
};
module.exports = { getPlatformRevenue, getSchoolRevenue, getWithdrawnTotal, getWithdrawableTotals };