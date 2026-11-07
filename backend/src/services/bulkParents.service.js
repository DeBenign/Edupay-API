// src/services/bulkParents.service.js
// Bulk parent accounts: validate rows, preview, create, and optionally link children by Student ID.
// Parents only. Bursar accounts stay manual (admin > Staff), so this service never creates any other role.
const crypto  = require('crypto');
const User    = require('../models/User');
const Student = require('../models/Student');

// bcrypt (cost 12) runs once per account, so a single upload is kept small enough to finish in one request
const MAX_ROWS = 100;
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const splitIds = (v) => [...new Set(str(v).split(/[;,|]+/).map((s) => s.trim()).filter(Boolean))];

// existingEmails: emails that already have an account (any school, any role: emails are unique platform-wide)
const validateRows = (rows, existingEmails = new Set()) => {
  const valid = [];
  const invalid = [];
  const seen = new Map();
  let blank = 0;

  rows.forEach((raw, i) => {
    const row = i + 2; // spreadsheet row (header is row 1)
    const fullName = str(raw?.fullName);
    const email = str(raw?.email).toLowerCase();
    const phone = str(raw?.phone);
    const childIds = splitIds(raw?.childStudentIds);

    if (!fullName && !email && !phone && !childIds.length) { blank++; return; }

    const fail = (reason) => invalid.push({ row, reason, fullName, email });
    if (!fullName) return fail('Full name is missing');
    if (fullName.length > 120) return fail('Full name is too long');
    if (!email) return fail('Email is missing');
    if (!EMAIL_RX.test(email) || email.length > 120) return fail('Email is not valid');
    if (phone.length > 20) return fail('Phone number is too long');
    if (seen.has(email)) return fail(`Duplicate email in this file (first on row ${seen.get(email)})`);
    if (existingEmails.has(email)) return fail('An account with this email already exists');

    seen.set(email, row);
    valid.push({ row, fullName, email, phone, childIds });
  });
  return { valid, invalid, blank };
};

const loadExistingEmails = async (rows) => {
  const emails = [...new Set(rows.map((r) => str(r?.email).toLowerCase()).filter(Boolean))];
  const found = emails.length ? await User.find({ email: { $in: emails } }).select('email').lean() : [];
  return new Set(found.map((u) => u.email));
};

// Which child Student IDs exist in this school and are free to link
const loadChildren = async (schoolId, valid) => {
  const ids = [...new Set(valid.flatMap((v) => v.childIds))];
  if (!ids.length) return new Map();
  const kids = await Student.find({ schoolId, studentId: { $in: ids }, isActive: true }).select('studentId parentId fullName').lean();
  return new Map(kids.map((k) => [k.studentId, k]));
};

// Nothing is saved
const previewBulk = async (schoolId, rows) => {
  const { valid, invalid, blank } = validateRows(rows, await loadExistingEmails(rows));
  const kids = await loadChildren(schoolId, valid);
  let childrenToLink = 0; const childWarnings = [];
  valid.forEach((v) => v.childIds.forEach((id) => {
    const k = kids.get(id);
    if (!k) childWarnings.push({ row: v.row, studentId: id, reason: 'Student ID not found in this school' });
    else if (k.parentId) childWarnings.push({ row: v.row, studentId: id, reason: 'Already linked to a parent' });
    else childrenToLink++;
  }));
  return {
    total: rows.length - blank, validCount: valid.length, invalidCount: invalid.length,
    invalid: invalid.slice(0, 200), childrenToLink, childWarnings: childWarnings.slice(0, 200),
  };
};

// Creates every valid row. Temporary passwords are returned once and never stored in readable form.
const commitBulk = async (schoolId, rows) => {
  const { valid, invalid } = validateRows(rows, await loadExistingEmails(rows));
  const failed = invalid.map((i) => ({ row: i.row, email: i.email, reason: i.reason }));
  if (!valid.length) return { createdCount: 0, failedCount: failed.length, failed: failed.slice(0, 200), credentials: [] };

  const kids = await loadChildren(schoolId, valid);
  const claimed = new Set(); // a child can only go to one parent, even if two rows list them
  const credentials = []; const childNotes = []; let linkedChildren = 0;

  for (const v of valid) {
    const tempPassword = crypto.randomBytes(6).toString('base64url');
    let user;
    try {
      // create() (not insertMany) so the password is hashed by the model's pre-save hook
      user = await User.create({
        fullName: v.fullName, email: v.email, phone: v.phone || undefined, role: 'parent',
        schoolId, password: tempPassword, mustChangePassword: true,
      });
    } catch (err) {
      failed.push({ row: v.row, email: v.email, reason: err.code === 11000 ? 'An account with this email already exists' : 'Could not be saved' });
      continue;
    }

    let linked = 0;
    for (const id of v.childIds) {
      const k = kids.get(id);
      if (!k) { childNotes.push({ row: v.row, studentId: id, reason: 'Student ID not found in this school' }); continue; }
      if (k.parentId || claimed.has(id)) { childNotes.push({ row: v.row, studentId: id, reason: 'Already linked to a parent' }); continue; }
      // Guarded update: only links if still unlinked, so a parallel change is never overwritten
      const r = await Student.updateOne({ _id: k._id, schoolId, parentId: null }, { $set: { parentId: user._id } });
      if (r.modifiedCount) { claimed.add(id); linked++; linkedChildren++; }
      else childNotes.push({ row: v.row, studentId: id, reason: 'Already linked to a parent' });
    }
    credentials.push({ userId: user._id, row: v.row, fullName: v.fullName, email: v.email, tempPassword, childrenLinked: linked });
  }

  return {
    createdCount: credentials.length, failedCount: failed.length, failed: failed.slice(0, 200),
    linkedChildren, childNotes: childNotes.slice(0, 200), credentials,
  };
};

module.exports = { MAX_ROWS, validateRows, previewBulk, commitBulk };
