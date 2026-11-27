import { adminClient, corsHeaders, fail, json, log, rateLimit, requireUser } from '../_shared/http.ts'
import { fetchOrderPayments, razorpayKeys } from '../_shared/razorpay.ts'

// Recovery flow: "Check payment status". Asks Razorpay about the member's open registration orders and
// confirms the registration if a captured payment exists (e.g. the browser closed before verification).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return fail(req, 'METHOD_NOT_ALLOWED', 405)
  const user = await requireUser(req)
  if (!user) return fail(req, 'NOT_AUTHENTICATED', 401)
  const db = adminClient()

  const { data: p } = await db.from('profiles').select('registration_status, member_uid').eq('id', user.id).single()
  if (p?.registration_status === 'confirmed') return json(req, { status: 'confirmed', member_uid: p.member_uid })
  // Admin has switched the fee off (e.g. for staging): confirm without payment.
  const { data: s } = await db.from('app_settings').select('registration_payment_required').eq('id', 1).single()
  if (s && s.registration_payment_required === false) {
    const { data: uid, error } = await db.rpc('confirm_registration', { p_user: user.id })
    if (error) return fail(req, 'STATUS_CHECK_FAILED', 500)
    return json(req, { status: 'confirmed', member_uid: uid })
  }
  if (!razorpayKeys().enabled) return json(req, { status: 'pending', gateway: 'not_configured' })
  if (!(await rateLimit(db, `reg_status:${user.id}`, 20, 600))) return fail(req, 'RATE_LIMITED', 429)

  const { data: open } = await db.from('registration_payments').select('id, razorpay_order_id, amount_paise')
    .eq('user_id', user.id).eq('status', 'created').not('razorpay_order_id', 'is', null).order('created_at', { ascending: false }).limit(5)
  for (const o of open ?? []) {
    try {
      const payments = await fetchOrderPayments(o.razorpay_order_id)
      await db.from('registration_payments').update({ last_checked_at: new Date().toISOString() }).eq('id', o.id)
      const captured = payments.find((x) => x.status === 'captured' && x.amount === o.amount_paise)
      if (captured) {
        const { data, error } = await db.rpc('mark_registration_paid', { p_order_id: o.razorpay_order_id, p_payment_id: captured.id, p_amount_paise: captured.amount, p_method: captured.method })
        if (error) throw new Error(error.message)
        log('reg_recovered', { payment_id: o.id })
        return json(req, { status: 'confirmed', member_uid: data?.member_uid, recovered: true })
      }
      if (payments.some((x) => x.status === 'authorized')) return json(req, { status: 'processing' })
    } catch (e) {
      log('reg_status_error', { payment_id: o.id, error: String(e) })
      return fail(req, 'STATUS_CHECK_FAILED', 502)
    }
  }
  return json(req, { status: 'pending' })
})
