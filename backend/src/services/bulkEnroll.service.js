// src/services/bulkEnroll.service.js
// Bulk student enrollment: validate rows, preview, insert in one round trip,
// then provision virtual accounts slowly in the background (gateways rate-limit).
const Student = require('../models/Student');
const { provisionStudentVirtualAccount } = require('./virtualAccount.service');
const { generateLinkCode, linkCodeExpiry } = require('../utils/linkCode');
const { trackPeak } = require('./subscriptionAccess.service');

const MAX_ROWS = 500;
const GENDERS = { m: 'male', male: 'male', f: 'female', female: 'female' };
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

// Returns a Date, null when blank, or undefined when invalid.
// Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, or a Date.
const parseDob = (v) => {
  if (v === null || v === undefined || v === '') return null;
  let y, mo, da;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return undefined;
    y = v.getUTCFullYear(); mo = v.getUTCMonth() + 1; da = v.getUTCDate();
  } else {
    const s = String(v).trim();
    if (!s) return null;
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +m[1]; mo = +m[2]; da = +m[3]; }
    else if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/))) { da = +m[1]; mo = +m[2]; y = +m[3]; }
    else return undefined;
  }
  const d = new Date(Date.UTC(y, mo - 1, da));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== da) return undefined; // e.g. 31/02
  if (y < 1980 || d.getTime() > Date.now()) return undefined;
  return d;
};

// existingIds: studentIds already enrolled in this school
const validateRows = (rows, existingIds = new Set()) => {
  const valid = [];
  const invalid = [];
  const seen = new Map(); // studentId -> first row number in this file
  let blank = 0;

  rows.forEach((raw, i) => {
    const row = i + 2; // spreadsheet row number (the header is row 1)
    const fullName = str(raw?.fullName);
    const studentId = str(raw?.studentId);
    const cls = str(raw?.class);
    const genderRaw = str(raw?.gender);

    if (!fullName && !studentId && !cls && !genderRaw && !str(raw?.dateOfBirth)) { blank++; return; }

    const fail = (reason) => invalid.push({ row, reason, fullName, studentId });
    if (!fullName) return fail('Full name is missing');
    if (fullName.length > 120) return fail('Full name is too long');
    if (!studentId) return fail('Student ID is missing');
    if (studentId.length > 50) return fail('Student ID is too long');
    if (!cls) return fail('Class is missing');
    if (cls.length > 30) return fail('Class is too long');
    const gender = GENDERS[genderRaw.toLowerCase()];
    if (!gender) return fail('Gender must be male or female');
    const dob = parseDob(raw?.dateOfBirth);
    if (dob === undefined) return fail('Date of birth is not valid (use YYYY-MM-DD or DD/MM/YYYY)');
    if (seen.has(studentId)) return fail(`Duplicate Student ID in this file (first on row ${seen.get(studentId)})`);
    if (existingIds.has(studentId)) return fail('Student ID is already enrolled in this school');

    seen.set(studentId, row);
    valid.push({ row, fullName, studentId, class: cls, gender, ...(dob && { dateOfBirth: dob }) });
  });

  return { valid, invalid, blank };
};

const loadExisting = async (schoolId, rows) => {
  const ids = [...new Set(rows.map((r) => str(r?.studentId)).filter(Boolean))];
  const found = ids.length ? await Student.find({ schoolId, studentId: { $in: ids } }).select('studentId').lean() : [];
  return new Set(found.map((s) => s.studentId));
};

// Nothing is saved
const previewBulk = async (schoolId, rows) => {
  const { valid, invalid, blank } = validateRows(rows, await loadExisting(schoolId, rows));
  const byClass = {};
  valid.forEach((v) => { byClass[v.class] = (byClass[v.class] || 0) + 1; });
  return {
    total: rows.length - blank,
    validCount: valid.length,
    invalidCount: invalid.length,
    invalid: invalid.slice(0, 200),
    classes: Object.entries(byClass).map(([name, count]) => ({ class: name, count })),
  };
};

// ── Background provisioning queue: one student at a time, spaced out ─────────
const queue = [];
let running = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delayMs = () => (process.env.BULK_PROVISION_DELAY_MS === undefined ? 1500 : Number(process.env.BULK_PROVISION_DELAY_MS) || 0);

const runQueue = async () => {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const student = queue.shift();
      try {
        const { errors } = await provisionStudentVirtualAccount(student);
        if (errors?.length) console.warn(`⚠️  Bulk provision ${student.studentId}: ${errors.join('; ')}`);
      } catch (err) {
        console.error(`❌ Bulk provision ${student.studentId} failed:`, err.message);
      }
      if (queue.length) await sleep(delayMs());
    }
  } finally { running = false; }
};

const enqueueProvisioning = (students) => {
  // Serverless: a background queue is cut off when the response is sent. /api/cron/provision picks these students up instead.
  if (process.env.VERCEL) return;
  queue.push(...students);
  setImmediate(runQueue);
};

// Saves every valid row (the server re-validates; the preview is advisory)
const commitBulk = async (schoolId, rows) => {
  const { valid, invalid } = validateRows(rows, await loadExisting(schoolId, rows));
  const failed = invalid.map((i) => ({ row: i.row, studentId: i.studentId, reason: i.reason }));
  if (!valid.length) return { createdCount: 0, failedCount: failed.length, failed: failed.slice(0, 200) };

  const docs = valid.map(({ row, ...v }) => ({
    schoolId, ...v, linkCode: generateLinkCode(), linkCodeExpiresAt: linkCodeExpiry(),
  }));

  let inserted;
  try {
    // One round trip. Link codes are set here because insertMany skips save hooks.
    inserted = await Student.insertMany(docs, { ordered: false });
  } catch (err) {
    // Partial success (e.g. a Student ID taken in the meantime): find out which rows landed
    const present = await Student.find({ schoolId, studentId: { $in: docs.map((d) => d.studentId) } });
    const landed = new Set(present.map((s) => s.studentId));
    valid.filter((v) => !landed.has(v.studentId))
      .forEach((v) => failed.push({ row: v.row, studentId: v.studentId, reason: 'Could not be saved' }));
    inserted = present;
  }

  trackPeak(schoolId);
  enqueueProvisioning(inserted);
  return { createdCount: inserted.length, failedCount: failed.length, failed: failed.slice(0, 200), provisioning: process.env.VERCEL ? 'scheduled' : 'background' };
};

module.exports = { MAX_ROWS, validateRows, parseDob, previewBulk, commitBulk, enqueueProvisioning };