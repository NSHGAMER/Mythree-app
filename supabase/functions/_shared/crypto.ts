// Runtime-agnostic crypto helpers (Web Crypto). Used by Edge Functions and unit-tested in Node.

const enc = new TextEncoder()

export function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

export async function sha256Hex(message: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(message)))
}

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

/** Razorpay Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export async function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string, keySecret: string) {
  if (!orderId || !paymentId || !signature || !keySecret) return false
  const expected = await hmacSha256Hex(keySecret, `${orderId}|${paymentId}`)
  return timingSafeEqual(expected, signature)
}

/** Razorpay webhook signature: HMAC_SHA256(raw_body, webhook_secret). */
export async function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string) {
  if (!signature || !webhookSecret) return false
  const expected = await hmacSha256Hex(webhookSecret, rawBody)
  return timingSafeEqual(expected, signature)
}

/** Uniformly random 6-digit numeric code. */
export function generateOtp(): string {
  const buf = new Uint32Array(1)
  // Rejection sampling avoids modulo bias
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limit)
  return String(buf[0] % 1_000_000).padStart(6, '0')
}

export function otpHash(userId: string, phone: string, code: string, pepper: string) {
  return sha256Hex(`${userId}:${phone}:${code}:${pepper}`)
}

/** Validates the amount a member asked to contribute (whole rupees). */
export function validateAmount(amount: unknown, min: number, max = 100000): { ok: true; paise: number } | { ok: false; error: string } {
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, error: 'INVALID_AMOUNT' }
  if (n < min || n > max) return { ok: false, error: 'INVALID_AMOUNT' }
  return { ok: true, paise: n * 100 }
}
