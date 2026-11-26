import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  generateOtp,
  hmacSha256Hex,
  otpHash,
  timingSafeEqual,
  validateAmount,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from './crypto'

const SECRET = 'test_key_secret_123'

describe('Razorpay payment signature verification', () => {
  const orderId = 'order_ABC123'
  const paymentId = 'pay_XYZ789'
  const good = createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex')

  it('matches Node HMAC implementation', async () => {
    expect(await hmacSha256Hex(SECRET, `${orderId}|${paymentId}`)).toBe(good)
  })
  it('accepts a valid signature', async () => {
    expect(await verifyRazorpayPaymentSignature(orderId, paymentId, good, SECRET)).toBe(true)
  })
  it('rejects tampered order, payment, signature or secret', async () => {
    expect(await verifyRazorpayPaymentSignature('order_OTHER', paymentId, good, SECRET)).toBe(false)
    expect(await verifyRazorpayPaymentSignature(orderId, 'pay_OTHER', good, SECRET)).toBe(false)
    expect(await verifyRazorpayPaymentSignature(orderId, paymentId, good.replace(/.$/, '0'), SECRET)).toBe(false)
    expect(await verifyRazorpayPaymentSignature(orderId, paymentId, good, 'wrong')).toBe(false)
  })
  it('rejects empty inputs', async () => {
    expect(await verifyRazorpayPaymentSignature('', '', '', SECRET)).toBe(false)
    expect(await verifyRazorpayPaymentSignature(orderId, paymentId, good, '')).toBe(false)
  })
})

describe('Razorpay webhook signature verification', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 15100 } } } })
  const sig = createHmac('sha256', 'whsec').update(body).digest('hex')
  it('accepts the exact raw body', async () => {
    expect(await verifyRazorpayWebhookSignature(body, sig, 'whsec')).toBe(true)
  })
  it('rejects a modified body or missing signature', async () => {
    expect(await verifyRazorpayWebhookSignature(body.replace('15100', '100'), sig, 'whsec')).toBe(false)
    expect(await verifyRazorpayWebhookSignature(body, null, 'whsec')).toBe(false)
  })
})

describe('timingSafeEqual', () => {
  it('compares strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('OTP', () => {
  it('generates 6-digit numeric codes with good spread', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const c = generateOtp()
      expect(c).toMatch(/^\d{6}$/)
      codes.add(c)
    }
    expect(codes.size).toBeGreaterThan(1990)
  })
  it('hash depends on user, phone, code and pepper', async () => {
    const h = await otpHash('u1', '+919876543210', '123456', 'p')
    expect(h).toHaveLength(64)
    expect(await otpHash('u2', '+919876543210', '123456', 'p')).not.toBe(h)
    expect(await otpHash('u1', '+919876543211', '123456', 'p')).not.toBe(h)
    expect(await otpHash('u1', '+919876543210', '123457', 'p')).not.toBe(h)
    expect(await otpHash('u1', '+919876543210', '123456', 'q')).not.toBe(h)
  })
})

describe('validateAmount (Guru Dakshina)', () => {
  it('accepts whole rupees within range and converts to paise', () => {
    expect(validateAmount(151, 11)).toEqual({ ok: true, paise: 15100 })
    expect(validateAmount('501', 11)).toEqual({ ok: true, paise: 50100 })
  })
  it('rejects below minimum, above maximum, decimals and junk', () => {
    for (const v of [10, 100001, 150.5, 'abc', null, -5, Infinity]) expect(validateAmount(v, 11).ok).toBe(false)
  })
})
