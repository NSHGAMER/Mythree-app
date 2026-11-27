// Spreadsheet helpers for result import/export. exceljs is loaded on demand (admin only).

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  const t = text.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"' && t[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (!head) return []
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

export async function readSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return parseCsv(await file.text())
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) return []
  const headers: string[] = []
  ws.getRow(1).eachCell((cell, col) => (headers[col] = String(cell.text ?? '').trim()))
  const out: Record<string, unknown>[] = []
  ws.eachRow((row, n) => {
    if (n === 1) return
    const o: Record<string, unknown> = {}
    headers.forEach((h, col) => {
      if (h) o[h] = row.getCell(col).text
    })
    if (Object.values(o).some((v) => String(v ?? '').trim() !== '')) out.push(o)
  })
  return out
}

export async function downloadXlsx(filename: string, sheetName: string, headers: string[], rows: (string | number | null)[][]) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)
  ws.addRow(headers)
  ws.getRow(1).font = { bold: true }
  rows.forEach((r) => ws.addRow(r))
  ws.columns.forEach((c) => (c.width = 22))
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
