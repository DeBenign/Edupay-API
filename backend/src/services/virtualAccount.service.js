// src/services/virtualAccount.service.js
const Student = require('../models/Student');
const { createVirtualAccount } = require('./nomba.service');

const provisionStudentVirtualAccount = async (student) => {
  if (student.virtualAccount?.accountNumber) {
    console.log(`ℹ️  Student ${student.studentId} already has account: ${student.virtualAccount.accountNumber}`);
    return student;
  }
  try {
    const nombaAccount = await createVirtualAccount({
      accountName: `${student.fullName} - School Fees`,
      reference:   student._id.toString(),
    });

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

    console.log(`✅ Virtual account provisioned for ${student.studentId}: ${nombaAccount.accountNumber}`);
    return updatedStudent;
  } catch (err) {
    console.error(`❌ Virtual account provisioning failed for ${student.studentId}:`, err.message);
    throw new Error(`Virtual account provisioning failed: ${err.message}`);
  }
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

module.exports = { provisionStudentVirtualAccount, retryVirtualAccountProvisioning, findStudentByAccountNumber };
