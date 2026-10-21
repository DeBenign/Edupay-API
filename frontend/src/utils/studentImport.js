// src/utils/studentImport.js
// Turns a parsed spreadsheet (array of rows, first row = headers) into student rows.

export const MAX_ROWS = 500

export const norm = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const ALIASES = {
  fullName:    ['fullname', 'name', 'studentname', 'nameofstudent'],
  studentId:   ['studentid', 'id', 'admissionno', 'admissionnumber', 'regno', 'registrationnumber', 'studentnumber'],
  class:       ['class', 'classname', 'grade', 'level'],
  gender:      ['gender', 'sex'],
  dateOfBirth: ['dateofbirth', 'dob', 'birthdate', 'birthday'],
}
const REQUIRED = ['fullName', 'studentId', 'class', 'gender']
const LABELS = { fullName: 'fullName', studentId: 'studentId', class: 'class', gender: 'gender' }

// Excel dates arrive as UTC-midnight Date objects; format them without a time-zone shift
export const isoDate = (d) => {
  const utc = d.getUTCHours() === 0 && d.getUTCMinutes() === 0
  const y = utc ? d.getUTCFullYear() : d.getFullYear()
  const m = (utc ? d.getUTCMonth() : d.getMonth()) + 1
  const day = utc ? d.getUTCDate() : d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
export const cell = (v) => (v instanceof Date ? isoDate(v) : v === null || v === undefined ? '' : String(v).trim())

export const matrixToRows = (matrix) => {
  if (!matrix || matrix.length < 2) throw new Error('The file has a header but no student rows.')
  const [head, ...body] = matrix
  const idx = {}
  head.forEach((h, i) => {
    const n = norm(h)
    Object.keys(ALIASES).forEach((k) => { if (idx[k] === undefined && ALIASES[k].includes(n)) idx[k] = i })
  })
  const missing = REQUIRED.filter((k) => idx[k] === undefined)
  if (missing.length) throw new Error(`Missing column(s): ${missing.map((k) => LABELS[k]).join(', ')}. Download the template to see the expected headers.`)

  const rows = body
    .map((r) => ({
      fullName: cell(r[idx.fullName]), studentId: cell(r[idx.studentId]), class: cell(r[idx.class]),
      gender: cell(r[idx.gender]), dateOfBirth: idx.dateOfBirth === undefined ? '' : cell(r[idx.dateOfBirth]),
    }))
    .filter((r) => Object.values(r).some(Boolean))
  if (!rows.length) throw new Error('No student rows found in the file.')
  if (rows.length > MAX_ROWS) throw new Error(`This file has ${rows.length} students. Upload at most ${MAX_ROWS} at a time.`)
  return rows
}