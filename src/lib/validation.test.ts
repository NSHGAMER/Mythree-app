import { describe, expect, it } from 'vitest'
import { ageFromDob, fieldErrors, memberUidBase, normalizeIndianMobile, passwordStrength, profileSchema, registerSchema } from './validation'

describe('normalizeIndianMobile', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['98765-43210', '+919876543210'],
  ])('%s → %s', (input, out) => expect(normalizeIndianMobile(input)).toBe(out))

  it.each(['12345', '5876543210', '+1 415 555 0100', 'abcdefghij', ''])('rejects %s', (input) => {
    expect(normalizeIndianMobile(input)).toBeNull()
  })
})

const yearsAgo = (n: number, extraDays = 0) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  d.setDate(d.getDate() - extraDays)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)
}

const adult = {
  full_name: 'Lakshmi Rao',
  email: 'Lakshmi@Example.com ',
  date_of_birth: yearsAgo(34),
  exam_preference: 'online',
  phone: '98450 12345',
  guardian_name: '',
  guardian_phone: '',
  address_line1: '12, 4th Cross, Jayanagar',
  address_line2: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560041',
  password: 'sanskrit123',
  confirm_password: 'sanskrit123',
  accept_terms: true,
}

describe('ageFromDob', () => {
  it('counts whole years and handles birthdays not yet reached', () => {
    expect(ageFromDob(yearsAgo(18))).toBe(18)
    expect(ageFromDob(yearsAgo(18, -1))).toBe(17) // birthday is tomorrow
    expect(ageFromDob('not-a-date')).toBeNull()
  })
})

describe('registerSchema – adult', () => {
  it('accepts a valid adult registration and normalises fields', () => {
    const r = registerSchema.safeParse(adult)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.email).toBe('lakshmi@example.com')
      expect(r.data.phone).toBe('+919845012345')
      expect(r.data.exam_preference).toBe('online')
    }
  })
  it('requires an adult to give their own phone', () => {
    const r = registerSchema.safeParse({ ...adult, phone: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error).phone).toMatch(/mobile/)
  })
  it('requires an exam preference', () => {
    const r = registerSchema.safeParse({ ...adult, exam_preference: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error).exam_preference).toBeDefined()
  })
  it('requires matching passwords, valid PIN, DOB and consent', () => {
    const r = registerSchema.safeParse({ ...adult, password: 'short', confirm_password: 'other', pincode: '0123', date_of_birth: '', accept_terms: false })
    expect(r.success).toBe(false)
    if (!r.success) {
      const e = fieldErrors(r.error)
      expect(e.password).toBeDefined()
      expect(e.pincode).toBeDefined()
      expect(e.date_of_birth).toBeDefined()
      expect(e.accept_terms).toBeDefined()
    }
  })
})

describe('registerSchema – minor', () => {
  const minor = { ...adult, full_name: 'Ravi Kumar', date_of_birth: yearsAgo(12), phone: '' }
  it('requires guardian name and phone for under-18s', () => {
    const r = registerSchema.safeParse(minor)
    expect(r.success).toBe(false)
    if (!r.success) {
      const e = fieldErrors(r.error)
      expect(e.guardian_phone).toBeDefined()
      expect(e.guardian_name).toBeDefined()
      expect(e.phone).toBeUndefined() // own phone optional
    }
  })
  it('accepts a minor with guardian contact; siblings may share the same guardian phone', () => {
    const a = registerSchema.safeParse({ ...minor, guardian_name: 'Suma Kumar', guardian_phone: '9876501234' })
    const b = registerSchema.safeParse({ ...minor, full_name: 'Rani Kumar', guardian_name: 'Suma Kumar', guardian_phone: '9876501234' })
    expect(a.success && b.success).toBe(true)
  })
})

describe('profileSchema applies the same contact rules', () => {
  it('rejects a minor profile without guardian phone', () => {
    const r = profileSchema.safeParse({ ...adult, date_of_birth: yearsAgo(10), phone: '' })
    expect(r.success).toBe(false)
  })
})

describe('memberUidBase (mirrors public.member_uid_base)', () => {
  it('uses first four letters (spaces ignored) and last four phone digits, uppercase', () => {
    expect(memberUidBase('Subramanya Haritha', '+919845011234')).toBe('SUBR1234')
    expect(memberUidBase('s u b r a', '98450 11234')).toBe('SUBR1234')
  })
  it('pads short names with X and short numbers with 0', () => {
    expect(memberUidBase('Ram', '+919845015678')).toBe('RAMX5678')
    expect(memberUidBase('Om', '12')).toBe('OMXX0012')
  })
  it('ignores non-Latin letters (e.g. Devanagari names fall back to X padding)', () => {
    expect(memberUidBase('राम', '+919845015678')).toBe('XXXX5678')
  })
})

describe('passwordStrength', () => {
  it('scores increasing complexity', () => {
    expect(passwordStrength('abc').score).toBe(0)
    expect(passwordStrength('abcdefgh').score).toBe(1)
    expect(passwordStrength('Abcdefgh12!x').score).toBe(4)
  })
})
