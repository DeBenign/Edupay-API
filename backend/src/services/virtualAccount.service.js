// src/services/virtualAccount.service.js
const Student = require('../models/Student');
const School  = require('../models/School');
const { env } = require('../config/env');
const { createVirtualAccount, getVirtualAccountByReference } = require('./nomba.service');
const { normalizeVirtualAccount} = require("./nomba.mapper");
const {sanitizeAccountName, sanitizeReference, } = require("../utils/nombaFormatter");
const { createDedicatedAccount, getDedicatedAccountByCustomer } = require('./paystack.service');

// account is already normalized (either normalizeVirtualAccount or
// normalizePaystackAccount output) — this just persists it.
const saveVirtualAccount = async (student, normalizedAccount) => {

    return Student.findByIdAndUpdate(
        student._id,
        {
            virtualAccount: normalizedAccount
        },
        {
            returnDocument: "after"
        }
    );

};

const provisionOnNomba = async (student) => {
    try {
        const nombaAccount = await createVirtualAccount({
            accountName: sanitizeAccountName(
                `${student.fullName} School Fees`
            ),
            reference: sanitizeReference(student._id.toString()),
        });

        return await saveVirtualAccount(student, normalizeVirtualAccount(nombaAccount));
    }
    catch (err) {
        if (
            err.message.includes("same accountRef already exists")
        ) {
            console.log(
                "Account already exists on Nomba."
            );
            const existing =
                await getVirtualAccountByReference(
                    student._id.toString()
                );
            return await saveVirtualAccount(
                student,
                normalizeVirtualAccount(existing)
            );
        }
        throw err;
    }
};

const provisionOnPaystack = async (student, { parentEmail, parentPhone } = {}) => {
    // Paystack requires an email + phone per customer — fall back to a
    // deterministic placeholder email if the school hasn't captured the
    // parent's real email yet, so this never blocks provisioning.
    const email = parentEmail || `${sanitizeReference(student._id.toString())}@parent.edupay.placeholder`;
    const [firstName, ...rest] = student.fullName.trim().split(' ');
    const lastName = rest.join(' ') || firstName;

    // In Paystack test mode, DVAs can only be created with preferred_bank:
    // 'test-bank' — set PAYSTACK_PREFERRED_BANK=test-bank in your test env.
    // Leave unset in production; it defaults to wema-bank.
    const preferredBank = env.paystack.preferredBank || 'wema-bank';

    try {
        const account = await createDedicatedAccount({
            email,
            firstName,
            lastName,
            phone: parentPhone || undefined,
            preferredBank,
        });
        return await saveVirtualAccount(student, account);
    } catch (err) {
        if (err.message.includes('customer already has') || err.message.includes('already exists')) {
            console.log('Account already exists on Paystack.');
            const existing = await getDedicatedAccountByCustomer(email);
            return await saveVirtualAccount(student, existing);
        }
        throw err;
    }
};

// Resolution order: explicit argument (e.g. a one-off retry override) →
// the school's chosen gateway → the global env default. This is what makes
// the admin dashboard toggle work without any change to callers like
// student.controller.js, which still just calls provisionStudentVirtualAccount(student).
const resolveGateway = async (student, explicitGateway) => {
    if (explicitGateway) return explicitGateway;
    const school = await School.findById(student.schoolId).select('paymentGateway');
    return school?.paymentGateway || env.defaultPaymentGateway;
};

// gateway: pass explicitly to override the school's setting (e.g. for a
// one-off pilot); otherwise it's resolved from School.paymentGateway, then
// the env default. extra: optional { parentEmail, parentPhone } overrides —
// otherwise pulled from the student's linked parent User record.
const provisionStudentVirtualAccount = async (student, gateway = null, extra = {}) => {

    if (student.virtualAccount?.accountNumber) {
        return student;
    }

    const resolvedGateway = await resolveGateway(student, gateway);

    if (resolvedGateway === 'paystack') {
        let { parentEmail, parentPhone } = extra;
        if ((!parentEmail || !parentPhone) && student.parentId) {
            const populated = await student.populate('parentId', 'email phone');
            parentEmail = parentEmail || populated.parentId?.email;
            parentPhone = parentPhone || populated.parentId?.phone;
        }
        return provisionOnPaystack(student, { parentEmail, parentPhone });
    }

    return provisionOnNomba(student);

};

const retryVirtualAccountProvisioning = async (studentId) => {
  const student = await Student.findById(studentId);
  if (!student) throw new Error('Student not found');
  if (student.virtualAccount?.accountNumber) throw new Error(`Student already has account: ${student.virtualAccount.accountNumber}`);
  return provisionStudentVirtualAccount(student);
};

const findStudentByAccountNumber = async (accountNumber) => {
  return Student.findOne({ 'virtualAccount.accountNumber': accountNumber, isActive: true });
};


module.exports = {  saveVirtualAccount, provisionStudentVirtualAccount, retryVirtualAccountProvisioning, findStudentByAccountNumber };