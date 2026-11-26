import { generateOtp, otpHash } from '../_shared/crypto.ts'
import { adminClient, clientIp, corsHeaders, fail, json, log, rateLimit, requireUser } from '../_shared/http.ts'
import { sendOtpSms, smsConfigured } from '../_shared/sms.ts'

const EXPIRY_SECONDS = 600
const RESEND_SECONDS = 60

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return fail(req, 'METHOD_NOT_ALLOWED', 405)
  if (!smsConfigured()) return fail(req, 'SMS_NOT_CONFIGURED', 503)

  const user = await requireUser(req)
  if (!user) return fail(req, 'NOT_AUTHENTICATED', 401)
  const db = adminClient()

  const { data: profile } = await db.from('profiles').select('phone, phone_verified_at').eq('id', user.id).single()
  if (!profile?.phone) return fail(req, 'INVALID_PHONE')
  if (profile.phone_verified_at) return json(req, { sent: false, already_verified: true, expires_in: 0, resend_in: 0 })

  // Layered limits: 1 per minute, 5 per hour per user, 20 per hour per IP, 10 per day per phone.
  const okMinute = await rateLimit(db, `otp_min:${user.id}`, 1, RESEND_SECONDS)
  const okHour = okMinute && (await rateLimit(db, `otp_hour:${user.id}`, 5, 3600))
  const okIp = okHour && (await rateLimit(db, `otp_ip:${clientIp(req)}`, 20, 3600))
  const okPhone = okIp && (await rateLimit(db, `otp_phone:${profile.phone}`, 10, 86400))
  if (!okPhone) return fail(req, 'RATE_LIMITED', 429)

  const code = generateOtp()
  const pepper = Deno.env.get('OTP_PEPPER') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!.slice(-24)
  // Invalidate previous codes, then store only a hash of the new one.
  await db.from('otp_codes').update({ consumed_at: new Date().toISOString() }).eq('user_id', user.id).is('consumed_at', null)
  const { error } = await db.from('otp_codes').insert({
    user_id: user.id,
    phone: profile.phone,
    code_hash: await otpHash(user.id, profile.phone, code, pepper),
    expires_at: new Date(Date.now() + EXPIRY_SECONDS * 1000).toISOString(),
  })
  if (error) return fail(req, 'OTP_FAILED', 500)

  try {
    await sendOtpSms(profile.phone, code)
    log('otp_sent', { user: user.id })
    return json(req, { sent: true, expires_in: EXPIRY_SECONDS, resend_in: RESEND_SECONDS })
  } catch (e) {
    log('otp_send_error', { user: user.id, error: String(e) })
    return fail(req, 'OTP_SEND_FAILED', 502)
  }
})
