import { adminClient, clientIp, corsHeaders, fail, json, log, rateLimit, requireUser } from '../_shared/http.ts'
import { createOrder, razorpayKeys } from '../_shared/razorpay.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REUSE_OPEN_ORDER_HOURS = 12

// Creates (or re-uses) the Razorpay order for the mandatory registration fee.
// Re-using one open order per member is what prevents a member being charged twice from two tabs:
// Razorpay accepts only one successful payment per order.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return fail(req, 'METHOD_NOT_ALLOWED', 405)
  const user = await requireUser(req)
  if (!user) return fail(req, 'NOT_AUTHENTICATED', 401)

  const db = adminClient()
  const { data: p } = await db.from('profiles').select('full_name, email, phone, guardian_phone, registration_status, member_uid').eq('id', user.id).single()
  if (!p) return fail(req, 'MEMBER_NOT_FOUND', 404)
  if (p.registration_status === 'confirmed') return json(req, { status: 'confirmed', member_uid: p.member_uid })

  const { keyId, enabled } = razorpayKeys()
  if (!enabled) return fail(req, 'PAYMENTS_NOT_CONFIGURED', 503)

  const body = await req.json().catch(() => ({}))
  const idem = String(body.idempotency_key ?? '')
  if (!UUID.test(idem)) return fail(req, 'INVALID_REQUEST')
  if (!(await rateLimit(db, `reg_order:${user.id}`, 10, 3600)) || !(await rateLimit(db, `reg_order_ip:${clientIp(req)}`, 60, 3600))) {
    return fail(req, 'RATE_LIMITED', 429)
  }

  const { data: settings } = await db.from('app_settings').select('registration_fee').eq('id', 1).single()
  const amountPaise = (settings?.registration_fee ?? 151) * 100

  // 1) Any already-paid payment? (webhook may have confirmed meanwhile)
  const { data: paid } = await db.from('registration_payments').select('id').eq('user_id', user.id).eq('status', 'paid').maybeSingle()
  if (paid) {
    const { data: uid } = await db.rpc('confirm_registration', { p_user: user.id })
    return json(req, { status: 'confirmed', member_uid: uid })
  }

  // 2) Re-use the latest open order with the current fee
  const since = new Date(Date.now() - REUSE_OPEN_ORDER_HOURS * 3600_000).toISOString()
  const { data: open } = await db.from('registration_payments').select('id, razorpay_order_id, amount_paise')
    .eq('user_id', user.id).eq('status', 'created').eq('amount_paise', amountPaise).not('razorpay_order_id', 'is', null)
    .gte('created_at', since).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const prefill = { name: p.full_name, email: p.email, contact: p.phone ?? p.guardian_phone ?? undefined }
  if (open) {
    return json(req, { status: 'pending', order_id: open.razorpay_order_id, key_id: keyId, amount_paise: open.amount_paise, currency: 'INR', payment_id: open.id, prefill })
  }

  // 3) Same idempotency key → same row
  let { data: row } = await db.from('registration_payments').select('id, amount_paise, razorpay_order_id').eq('user_id', user.id).eq('idempotency_key', idem).maybeSingle()
  if (row?.razorpay_order_id) {
    return json(req, { status: 'pending', order_id: row.razorpay_order_id, key_id: keyId, amount_paise: row.amount_paise, currency: 'INR', payment_id: row.id, prefill })
  }
  if (!row) {
    const ins = await db.from('registration_payments').insert({ user_id: user.id, amount_paise: amountPaise, idempotency_key: idem, payer_name: p.full_name, payer_email: p.email })
      .select('id, amount_paise, razorpay_order_id').single()
    if (ins.error || !ins.data) {
      log('reg_order_insert_failed', { error: ins.error?.message })
      return fail(req, 'ORDER_FAILED', 500)
    }
    row = ins.data
  }

  try {
    const order = await createOrder(row.amount_paise, `reg_${row.id.replace(/-/g, '').slice(0, 36)}`, { purpose: 'registration', registration_payment_id: row.id, user_id: user.id })
    await db.from('registration_payments').update({ razorpay_order_id: order.id }).eq('id', row.id)
    log('reg_order_created', { payment_id: row.id })
    return json(req, { status: 'pending', order_id: order.id, key_id: keyId, amount_paise: row.amount_paise, currency: 'INR', payment_id: row.id, prefill })
  } catch (e) {
    log('reg_order_error', { payment_id: row.id, error: String(e) })
    await db.from('registration_payments').update({ status: 'failed', failure_reason: 'order_create_failed' }).eq('id', row.id)
    return fail(req, 'ORDER_FAILED', 502)
  }
})
