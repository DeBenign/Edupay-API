// src/utils/parentImport.js
// Turns a parsed spreadsheet (array of rows, first row = headers) into parent rows.
import { norm, cell } from './studentImport'

export const MAX_ROWS = 100

const ALIASES = {
  fullName: ['fullname', 'name', 'parentname', 'nameofparent', 'guardian', 'guardianname'],
  email:    ['email', 'emailaddress', 'parentemail'],
  phone:    ['phone', 'phonenumber', 'mobile', 'tel', 'telephone'],
  // Optional: the children's Student IDs, separated by ; or , so the parent is linked straight away
  childStudentIds: ['childstudentids', 'childrenstudentids', 'children', 'childrenids', 'studentids', 'studentid', 'wards', 'ward'],
}
const REQUIRED = ['fullName', 'email']

export const matrixToRows = (matrix) => {
  if (!matrix || matrix.length < 2) throw new Error('The file has a header but no parent rows.')
  const [head, ...body] = matrix
  const idx = {}
  head.forEach((h, i) => {
    const n = norm(h)
    Object.keys(ALIASES).forEach((k) => { if (idx[k] === undefined && ALIASES[k].includes(n)) idx[k] = i })
  })
  const missing = REQUIRED.filter((k) => idx[k] === undefined)
  if (missing.length) throw new Error(`Missing column(s): ${missing.join(', ')}. Download the template to see the expected headers.`)

  const get = (r, k) => (idx[k] === undefined ? '' : cell(r[idx[k]]))
  const rows = body
    .map((r) => ({ fullName: get(r, 'fullName'), email: get(r, 'email'), phone: get(r, 'phone'), childStudentIds: get(r, 'childStudentIds') }))
    .filter((r) => Object.values(r).some(Boolean))
  if (!rows.length) throw new Error('No parent rows found in the file.')
  if (rows.length > MAX_ROWS) throw new Error(`This file has ${rows.length} parents. Upload at most ${MAX_ROWS} at a time.`)
  return rows
}
