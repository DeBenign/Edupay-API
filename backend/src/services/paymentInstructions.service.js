// src/services/paymentInstructions.service.js
const FeeAssignment = require('../models/FeeAssignment');
const { computeAmountToCollect, isFeeWaived } = require('./platformFee.service');
const { getEarlyPaymentOffer, isDiscountEnabled } = require('./earlyPaymentDiscount.service');

const plain = (sub) => (sub?.toObject ? sub.toObject() : sub);

// `student` needs: _id, schoolId, virtualAccounts
const buildPaymentInstructions = async (student) => {
  const paymentOptions = [];
  ['nomba', 'paystack'].forEach((gateway) => {
    const acc = plain(student.virtualAccounts?.[gateway]);
    if (acc?.accountNumber) paymentOptions.push({ gateway, ...acc });
  });

  const [assignments, waived, discountOn] = await Promise.all([
    FeeAssignment.find({ studentId: student._id, status: { $in: ['unpaid', 'partial'] } })
      .populate('feeStructureId', 'name term academicSession dueDate studentOnly')
      .sort({ createdAt: 1 }),
    isFeeWaived(student.schoolId),
    isDiscountEnabled(student.schoolId),
  ]);

  const outstandingFees = assignments.map((a) => {
    const amountToPay = {};
    paymentOptions.forEach(({ gateway }) => {
      amountToPay[gateway] = computeAmountToCollect(a.balance, gateway, { waived });
    });

    let earlyPayment = null;
    const offer = getEarlyPaymentOffer(a, { enabled: discountOn });
    if (offer) {
      const early = {};
      paymentOptions.forEach(({ gateway }) => {
        const p = computeAmountToCollect(offer.discountedAmount, gateway, { waived });
        early[gateway] = { ...p, youSave: amountToPay[gateway].totalAmountToPay - p.totalAmountToPay };
      });
      earlyPayment = { deadline: offer.deadline, discountRate: offer.discountRate, amountToPay: early };
    }

    return {
      assignmentId:    a._id,
      name:            a.feeStructureId?.name,
      term:            a.feeStructureId?.term,
      academicSession: a.feeStructureId?.academicSession,
      dueDate:         a.feeStructureId?.dueDate,
      amountExpected:  a.amountExpected,
      totalPaid:       a.totalPaid,
      balance:         a.balance,
      status:          a.status,
      amountToPay,
      earlyPayment,
    };
  });

  return {
    paymentOptions,
    outstandingFees,
    totalOutstanding: outstandingFees.reduce((sum, f) => sum + f.balance, 0),
  };
};

module.exports = { buildPaymentInstructions };