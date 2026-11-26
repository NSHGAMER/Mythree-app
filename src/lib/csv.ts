/** Build an RFC 4180 CSV string. Guards against spreadsheet formula injection. */
export function toCsv(rows: Record<string, unknown>[], columns?: { key: string; label: string }[]): string {
  if (rows.length === 0 && !columns) return ''
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }))
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    let s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = cols.map((c) => escape(c.label)).join(',')
  const body = rows.map((r) => cols.map((c) => escape(r[c.key])).join(',')).join('\r\n')
  return `${header}\r\n${body}`
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
