import { otpHash, timingSafeEqual } from '../_shared/crypto.ts'
import { adminClient, corsHeaders, fail, json, log, rateLimit, requireUser } from '../_shared/http.ts'

const MAX_ATTEMPTS = 5

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return fail(req, 'METHOD_NOT_ALLOWED', 405)
  const user = await requireUser(req)
  if (!user) return fail(req, 'NOT_AUTHENTICATED', 401)

  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '')
  if (!/^\d{6}$/.test(code)) return fail(req, 'OTP_INVALID')

  const db = adminClient()
  if (!(await rateLimit(db, `otp_verify:${user.id}`, 20, 3600))) return fail(req, 'RATE_LIMITED', 429)

  const { data: otp } = await db
    .from('otp_codes')
    .select('*')
    .eq('user_id', user.id)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!otp) return fail(req, 'OTP_EXPIRED')
  if (new Date(otp.expires_at).getTime() < Date.now()) return fail(req, 'OTP_EXPIRED')
  if (otp.attempts >= MAX_ATTEMPTS) return fail(req, 'OTP_TOO_MANY_ATTEMPTS', 429)

  const { data: profile } = await db.from('profiles').select('phone, guardian_phone').eq('id', user.id).single()
  if ((profile?.phone ?? profile?.guardian_phone) !== otp.phone) return fail(req, 'OTP_EXPIRED') // phone changed since the code was sent

  const pepper = Deno.env.get('OTP_PEPPER') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!.slice(-24)
  const ok = timingSafeEqual(await otpHash(user.id, otp.phone, code, pepper), otp.code_hash)
  if (!ok) {
    await db.from('otp_codes').update({ attempts: otp.attempts + 1 }).eq('id', otp.id)
    return fail(req, otp.attempts + 1 >= MAX_ATTEMPTS ? 'OTP_TOO_MANY_ATTEMPTS' : 'OTP_INVALID')
  }

  const now = new Date().toISOString()
  await db.from('otp_codes').update({ consumed_at: now }).eq('id', otp.id)
  await db.from('profiles').update({ phone_verified_at: now }).eq('id', user.id)
  log('otp_verified', { user: user.id })
  return json(req, { verified: true })
})
