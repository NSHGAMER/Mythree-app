import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'
import { friendlyError } from './errors'
import { inr, maskPhone } from './format'

describe('toCsv', () => {
  it('escapes quotes, commas and newlines', () => {
    const csv = toCsv([{ a: 'x,y', b: 'he said "hi"', c: 'line1\nline2' }])
    expect(csv.split('\r\n')[1]).toBe('"x,y","he said ""hi""","line1\nline2"')
  })
  it('neutralises spreadsheet formula injection', () => {
    const csv = toCsv([{ name: '=HYPERLINK("http://evil")' }])
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`)
  })
  it('uses provided column labels and order', () => {
    expect(toCsv([{ b: 2, a: 1 }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }])).toBe('A,B\r\n1,2')
  })
})

describe('friendlyError', () => {
  it('maps server error codes to member-friendly messages', () => {
    expect(friendlyError(new Error('CHAPTER_LOCKED'))).toMatch(/previous chapters/)
    expect(friendlyError({ message: 'P0001: RATE_LIMITED' })).toMatch(/Too many/)
  })
  it('never claims success when offline', () => {
    expect(friendlyError(new Error('TypeError: Failed to fetch'))).toMatch(/Nothing was saved/)
  })
})

describe('format', () => {
  it('formats rupees from paise', () => {
    expect(inr(15100)).toBe('₹151')
    expect(inr(15150)).toBe('₹151.50')
  })
  it('masks phone numbers', () => {
    expect(maskPhone('+919876543210')).toBe('+91 98•• ••3210')
  })
})
