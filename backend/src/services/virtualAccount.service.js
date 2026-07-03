// src/services/virtualAccount.service.js
// Handles provisioning of Nomba virtual accounts during student enrollment.
// This is what gives every student their own unique bank account number.

const Student = require('../models/Student');
const { createVirtualAccount } = require('./nomba.service');

/**
 * Provisions a Nomba virtual account for a student and saves it to DB.
 * Called automatically when a student is enrolled.
 *
 * @param {object} student - Mongoose Student document
 * @returns {object}       - Updated student document
 */
const provisionStudentVirtualAccount = async (student) => {
  // Idempotency guard: don't re-provision if account already exists
  if (student.virtualAccount?.accountNumber) {
    console.log(
      `ℹ️  Student ${student.studentId} already has virtual account: ${student.virtualAccount.accountNumber}`
    );
    return student;
  }

  try {
    // Format account name clearly so parents can identify it at their bank
    const accountName = `${student.fullName} - School Fees`;

    const nombaAccount = await createVirtualAccount({
      accountName,
      reference: student._id.toString(),
    });

    // Persist the virtual account details onto the student record
    const updatedStudent = await Student.findByIdAndUpdate(
      student._id,
      {
        virtualAccount: {
          accountNumber:  nombaAccount.accountNumber,
          accountName:    nombaAccount.accountName,
          bankName:       nombaAccount.bankName,
          bankCode:       nombaAccount.bankCode,
          nombaReference: nombaAccount.reference || nombaAccount.id,
          provisionedAt:  new Date(),
        },
      },
      { new: true }
    );

    console.log(
      `✅ Virtual account provisioned for student ${student.studentId}: ${nombaAccount.accountNumber}`
    );

    return updatedStudent;
  } catch (err) {
    // Log but don't crash enrollment — admin can retry provisioning
    console.error(
      `❌ Failed to provision virtual account for student ${student.studentId}:`,
      err.message
    );
    throw new Error(`Virtual account provisioning failed: ${err.message}`);
  }
};

/**
 * Retries virtual account provisioning for a student who failed on enrollment.
 * Exposed as an admin endpoint so bursars can trigger it from the dashboard.
 *
 * @param {string} studentId - MongoDB _id of the student
 * @returns {object}         - Updated student document
 */
const retryVirtualAccountProvisioning = async (studentId) => {
  const student = await Student.findById(studentId);

  if (!student) {
    throw new Error('Student not found');
  }

  if (student.virtualAccount?.accountNumber) {
    throw new Error(
      `Student already has virtual account: ${student.virtualAccount.accountNumber}`
    );
  }

  return provisionStudentVirtualAccount(student);
};

/**
 * Looks up a student by their virtual account number.
 * Primary lookup used by the webhook handler when a payment arrives.
 *
 * @param {string} accountNumber - The virtual account number from webhook payload
 * @returns {object|null}        - Student document or null
 */
const findStudentByAccountNumber = async (accountNumber) => {
  return Student.findOne({
    'virtualAccount.accountNumber': accountNumber,
    isActive: true,
  });
};

module.exports = {
  provisionStudentVirtualAccount,
  retryVirtualAccountProvisioning,
  findStudentByAccountNumber,
};
