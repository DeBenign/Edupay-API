// src/services/virtualAccount.service.js
const Student = require('../models/Student');
const { env } = require('../config/env');
const { createVirtualAccount, getVirtualAccountByReference } = require('./nomba.service');
const { normalizeVirtualAccount } = require('./nomba.mapper');
const { sanitizeAccountName, sanitizeReference } = require('../utils/nombaFormatter');
const { createDedicatedAccount, getDedicatedAccountByCustomer, createOrFetchCustomer } = require('./paystack.service');

const saveVirtualAccount = async (studentId, gateway, normalizedAccount) => {
  return Student.findByIdAndUpdate(
    studentId,
    { $set: { [`virtualAccounts.${gateway}`]: normalizedAccount } },
    { returnDocument: 'after' }
  );
};

const provisionOnNomba = async (student) => {
  try {
    const nombaAccount = await createVirtualAccount({
      accountName: sanitizeAccountName(`${student.fullName} School Fees`),
      reference: sanitizeReference(student._id.toString()),
    });
    return await saveVirtualAccount(student._id, 'nomba', normalizeVirtualAccount(nombaAccount));
  } catch (err) {
    if (err.message.includes('same accountRef already exists')) {
      const existing = await getVirtualAccountByReference(student._id.toString());
      return await saveVirtualAccount(student._id, 'nomba', normalizeVirtualAccount(existing));
    }
    throw err;
  }
};

const provisionOnPaystack = async (student, { parentEmail, parentPhone } = {}) => {

    if (env.nodeEnv === 'development' && env.paystack.mockMode) {
    const fakeAccount = {
      accountNumber: `90${Math.floor(10000000 + Math.random() * 89999999)}`,
      accountName: `EduPay/${student.fullName}`,
      bankName: 'Wema Bank (MOCK)',
      bankCode: '035',
      accountRef: `mock_${student._id}`,
      accountHolderId: `mock_${student._id}`,
      provisionedAt: new Date(),
    };
    return await saveVirtualAccount(student._id, 'paystack', fakeAccount);
  }
  
  const email = parentEmail || `student${sanitizeReference(student._id.toString())}@mailinator.com`;
  const [firstName, ...rest] = student.fullName.trim().split(' ');
  const lastName = rest.join(' ') || firstName;
  const preferredBank = env.paystack.preferredBank || 'wema-bank';

  console.log('Paystack provisioning email:', JSON.stringify(email), 'parentEmail was:', JSON.stringify(parentEmail));
  try {
    const account = await createDedicatedAccount({ email, firstName, lastName, phone: parentPhone || undefined, preferredBank });
    return await saveVirtualAccount(student._id, 'paystack', account);
  } catch (err) {
    if (err.message.includes('customer already has') || err.message.includes('already exists')) {
      const customer = await createOrFetchCustomer({ email, firstName, lastName, phone: parentPhone });
      const existing = await getDedicatedAccountByCustomer(customer.customer_code);
      return await saveVirtualAccount(student._id, 'paystack', existing);
    }
    throw err;
  }
};

// Provisions BOTH gateways independently. One failing does not block the other —
// each result/error is reported separately so the caller can show a partial warning
// instead of losing the account that did succeed.
const provisionStudentVirtualAccount = async (student, extra = {}) => {
  let { parentEmail, parentPhone } = extra;
  if ((!parentEmail || !parentPhone) && student.parentId) {
    const populated = await student.populate('parentId', 'email phone');
    parentEmail = parentEmail || populated.parentId?.email;
    parentPhone = parentPhone || populated.parentId?.phone;
  }

  const results = await Promise.allSettled([
    student.virtualAccounts?.nomba?.accountNumber ? Promise.resolve() : provisionOnNomba(student),
    student.virtualAccounts?.paystack?.accountNumber ? Promise.resolve() : provisionOnPaystack(student, { parentEmail, parentPhone }),
  ]);

  const errors = results
    .map((r, i) => (r.status === 'rejected' ? `${i === 0 ? 'nomba' : 'paystack'}: ${r.reason.message}` : null))
    .filter(Boolean);

  const finalStudent = await Student.findById(student._id);
  return { student: finalStudent, errors }; // errors is [] when both succeeded
};

const retryVirtualAccountProvisioning = async (studentId) => {
  const student = await Student.findById(studentId);
  if (!student) throw new Error('Student not found');
  const { student: updated, errors } = await provisionStudentVirtualAccount(student);
  if (errors.length === 2) throw new Error(`Both gateways failed: ${errors.join('; ')}`);
  return { student: updated, errors }; // partial success surfaces as a warning, not a throw
};

const findStudentByAccountNumber = async (accountNumber) => {
  return Student.findOne({
    isActive: true,
    $or: [
      { 'virtualAccounts.nomba.accountNumber': accountNumber },
      { 'virtualAccounts.paystack.accountNumber': accountNumber },
    ],
  });
};

module.exports = { saveVirtualAccount, provisionStudentVirtualAccount, retryVirtualAccountProvisioning, findStudentByAccountNumber };