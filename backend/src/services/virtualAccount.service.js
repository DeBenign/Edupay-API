// src/services/virtualAccount.service.js
const Student = require('../models/Student');
const { createVirtualAccount } = require('./nomba.service');
const { normalizeVirtualAccount} = require("./nomba.mapper");
const {sanitizeAccountName, sanitizeReference,
} = require("../utils/nombaFormatter");

const mapNombaVirtualAccount = (va) => ({
  accountNumber: va.bankAccountNumber,
  accountName: va.bankAccountName,
  bankName: va.bankName,
  bankCode: va.bankCode || null,

  accountRef: va.accountRef,
  accountHolderId: va.accountHolderId,

  provisionedAt: new Date(va.createdAt),
});

const saveVirtualAccount = async (student, nombaAccount) => {

    const virtualAccount =
        normalizeVirtualAccount(nombaAccount);

    return Student.findByIdAndUpdate(
        student._id,
        {
            virtualAccount
        },
        {
            returnDocument: "after"
        }
    );

};


const provisionStudentVirtualAccount = async (student) => {

    if (student.virtualAccount?.accountNumber) {
        return student;
    }

    try {

        const nombaAccount = await createVirtualAccount({

            accountName: sanitizeAccountName(
                `${student.fullName} School Fees`
            ),
            reference: student._id.toString(),
        });

        return await saveVirtualAccount(student, nombaAccount);
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
                existing
            );
        }
        throw err;
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


module.exports = {  saveVirtualAccount, provisionStudentVirtualAccount, retryVirtualAccountProvisioning, findStudentByAccountNumber };
