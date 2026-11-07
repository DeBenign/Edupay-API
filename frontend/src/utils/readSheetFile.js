// src/utils/readSheetFile.js
// Reads a .csv or .xlsx upload into a matrix (array of rows).
import Papa from 'papaparse'
import { readSheet } from 'read-excel-file/browser'

const MAX_FILE_BYTES = 2 * 1024 * 1024

export const readSheetFile = async (file) => {
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is too large (2 MB limit).')
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return new Promise((resolve, reject) =>
      Papa.parse(file, { skipEmptyLines: 'greedy', complete: (r) => resolve(r.data), error: reject }))
  }
  if (name.endsWith('.xlsx')) return readSheet(file)
  throw new Error('Upload a .csv or .xlsx file. For an older .xls file, save it as .xlsx or .csv first.')
}
