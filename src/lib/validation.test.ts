import { describe, expect, it } from 'vitest'
import { fieldErrors, normalizeIndianMobile, passwordStrength, registerSchema } from './validation'

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

const valid = {
  full_name: 'Lakshmi Rao',
  email: 'Lakshmi@Example.com ',
  phone: '98450 12345',
  age: '34',
  address_line1: '12, 4th Cross, Jayanagar',
  address_line2: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560041',
  password: 'sanskrit123',
  confirm_password: 'sanskrit123',
  accept_terms: true,
}

describe('registerSchema', () => {
  it('accepts a valid registration and normalises fields', () => {
    const r = registerSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.email).toBe('lakshmi@example.com')
      expect(r.data.phone).toBe('+919845012345')
      expect(r.data.age).toBe(34)
    }
  })

  it('requires matching passwords', () => {
    const r = registerSchema.safeParse({ ...valid, confirm_password: 'different1' })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error).confirm_password).toMatch(/match/)
  })

  it('rejects weak passwords, bad PIN codes, bad ages and missing consent', () => {
    const r = registerSchema.safeParse({ ...valid, password: 'short', confirm_password: 'short', pincode: '0123', age: '2', accept_terms: false })
    expect(r.success).toBe(false)
    if (!r.success) {
      const e = fieldErrors(r.error)
      expect(e.password).toBeDefined()
      expect(e.pincode).toBeDefined()
      expect(e.age).toBeDefined()
      expect(e.accept_terms).toBeDefined()
    }
  })
})

describe('passwordStrength', () => {
  it('scores increasing complexity', () => {
    expect(passwordStrength('abc').score).toBe(0)
    expect(passwordStrength('abcdefgh').score).toBe(1)
    expect(passwordStrength('Abcdefgh12!x').score).toBe(4)
  })
})
