import { describe, expect, it } from 'vitest'
import { fmtCountdown, normaliseResultRows, secondsLeft, suggestedExamMonth } from './exam'
import { parseCsv } from './sheets'

describe('exam scheduling helpers', () => {
  it('suggests registration month + 3', () => {
    const m = (iso: string) => suggestedExamMonth(iso).toISOString().slice(0, 7)
    expect(m('2026-11-14T10:00:00Z')).toBe('2027-02')
    expect(m('2026-12-01T00:00:00Z')).toBe('2027-03')
    expect(m('2027-01-31T00:00:00Z')).toBe('2027-04')
    expect(m('2027-02-10T00:00:00Z')).toBe('2027-05')
  })
  it('counts down against the server clock, never below zero', () => {
    const now = Date.parse('2027-02-15T10:00:00Z')
    expect(secondsLeft('2027-02-15T13:00:00Z', 0, now)).toBe(10800)
    // client clock 60 s behind the server → 60 s less time left
    expect(secondsLeft('2027-02-15T13:00:00Z', 60_000, now)).toBe(10740)
    expect(secondsLeft('2027-02-15T09:00:00Z', 0, now)).toBe(0)
  })
  it('formats countdowns', () => {
    expect(fmtCountdown(10800)).toBe('03:00:00')
    expect(fmtCountdown(90061)).toBe('1d 1h 1m')
  })
})

describe('result import parsing', () => {
  it('reads CSV with quotes and normalises headers/values', () => {
    const rows = parseCsv('UID,Name,Marks,Remarks,Result (PASS/FAIL/ABSENT/WITHHELD)\r\nsubr1234,"Rao, S",78,"Good, clear",PASS\nRAMX5678,Ram,,"",absent\n')
    const n = normaliseResultRows(rows)
    expect(n).toEqual([
      { uid: 'SUBR1234', marks: '78', remarks: 'Good, clear', result: 'pass' },
      { uid: 'RAMX5678', marks: '', remarks: '', result: 'absent' },
    ])
  })
  it('skips blank rows', () => {
    expect(normaliseResultRows([{ UID: '', Marks: '', Result: '' }])).toEqual([])
  })
})
