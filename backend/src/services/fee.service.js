// src/services/fee.service.js
const FeeStructure  = require('../models/FeeStructure');
const FeeAssignment = require('../models/FeeAssignment');
const Student       = require('../models/Student');

const TERM_ORDER = ['first', 'second', 'third'];

// Starting year from any common format: "2025/2026", "2025-2026", "2025/26"
const startYear = (session) => {
  const m = /(\d{4})/.exec(session || '');
  return m ? Number(m[1]) : null;
};

// first -> second -> third (same session), third -> first of the next session
const nextTermOf = ({ term, academicSession }) => {
  const i = TERM_ORDER.indexOf(term);
  if (i === -1) return null;
  if (i < TERM_ORDER.length - 1) {
    return { term: TERM_ORDER[i + 1], sameSession: true, academicSession };
  }
  const y = startYear(academicSession);
  return y ? { term: TERM_ORDER[0], sameSession: false, startYear: y + 1 } : null;
};

const matchesNext = (fs, next) =>
  next.sameSession
    ? fs.academicSession === next.academicSession
    : startYear(fs.academicSession) === next.startYear;

// Finds (or creates) the student's assignment for the term after `currentAssignment`.
// It never invents a fee structure: the school must have created next term's first.
const getOrCreateNextTermAssignment = async (studentId, currentAssignment) => {
  const student = await Student.findById(studentId);
  if (!student) throw new Error('Student not found');

  const currentFsId = currentAssignment.feeStructureId?._id || currentAssignment.feeStructureId;
  const currentFs = await FeeStructure.findById(currentFsId);
  if (!currentFs) throw new Error('Current fee structure not found');

  const next = nextTermOf(currentFs);
  if (!next) throw new Error('Could not work out the next term from the current fee structure');

  const candidates = await FeeStructure.find({
    schoolId: student.schoolId,
    class: student.class,
    term: next.term,
    isActive: { $ne: false },
  });
  const nextFs = candidates.find((fs) => matchesNext(fs, next));
  if (!nextFs) {
    throw new Error(`No fee structure for ${student.class}, ${next.term} term, next session yet. Ask the school to create it first, or choose refund.`);
  }

  const existing = await FeeAssignment.findOne({ studentId, feeStructureId: nextFs._id });
  if (existing) return existing;

  try {
    return await FeeAssignment.create({
      studentId,
      schoolId: student.schoolId,
      feeStructureId: nextFs._id,
      amountExpected: nextFs.amount,
      balance: nextFs.amount,
    });
  } catch (err) {
    if (err.code === 11000) return FeeAssignment.findOne({ studentId, feeStructureId: nextFs._id });
    throw err;
  }
};

module.exports = { getOrCreateNextTermAssignment, nextTermOf };