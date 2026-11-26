import { validateAmount } from '../_shared/crypto.ts'
import { adminClient, clientIp, corsHeaders, fail, json, log, rateLimit, requireUser } from '../_shared/http.ts'
import { createOrder, razorpayKeys } from '../_shared/razorpay.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return fail(req, 'METHOD_NOT_ALLOWED', 405)

  const { keyId, enabled } = razorpayKeys()
  if (!enabled) return fail(req, 'PAYMENTS_NOT_CONFIGURED', 503)

  const user = await requireUser(req)
  if (!user) return fail(req, 'NOT_AUTHENTICATED', 401)

  const body = await req.json().catch(() => ({}))
  const idem = String(body.idempotency_key ?? '')
  if (!UUID.test(idem)) return fail(req, 'INVALID_REQUEST')
  const note = typeof body.note === 'string' ? body.note.slice(0, 200) : null

  const db = adminClient()
  if (!(await rateLimit(db, `order:${user.id}`, 10, 3600)) || !(await rateLimit(db, `order_ip:${clientIp(req)}`, 30, 3600))) {
    return fail(req, 'RATE_LIMITED', 429)
  }

  const { data: settings } = await db.from('app_settings').select('min_contribution').eq('id', 1).single()
  const amt = validateAmount(body.amount, settings?.min_contribution ?? 1)
  if (!amt.ok) return fail(req, amt.error)

  // Idempotency: the same key always returns the same order.
  const { data: existing } = await db
    .from('contributions')
    .select('id, razorpay_order_id, amount_paise, status')
    .eq('user_id', user.id)
    .eq('idempotency_key', idem)
    .maybeSingle()
  if (existing?.razorpay_order_id) {
    return json(req, { order_id: existing.razorpay_order_id, key_id: keyId, amount_paise: existing.amount_paise, currency: 'INR', contribution_id: existing.id })
  }

  const { data: profile } = await db.from('profiles').select('full_name, email').eq('id', user.id).single()
  const { data: row, error: insErr } = existing
    ? { data: existing, error: null }
    : await db
        .from('contributions')
        .insert({ user_id: user.id, amount_paise: amt.paise, idempotency_key: idem, note, payer_name: profile?.full_name, payer_email: profile?.email })
        .select('id, amount_paise')
        .single()
  if (insErr || !row) {
    log('order_insert_failed', { error: insErr?.message })
    return fail(req, 'ORDER_FAILED', 500)
  }

  try {
    const order = await createOrder(row.amount_paise, row.id.replace(/-/g, '').slice(0, 40), { contribution_id: row.id, user_id: user.id, purpose: 'guru_dakshina' })
    await db.from('contributions').update({ razorpay_order_id: order.id }).eq('id', row.id)
    log('order_created', { contribution_id: row.id, amount: row.amount_paise })
    return json(req, { order_id: order.id, key_id: keyId, amount_paise: row.amount_paise, currency: 'INR', contribution_id: row.id })
  } catch (e) {
    log('order_create_error', { contribution_id: row.id, error: String(e) })
    await db.from('contributions').update({ status: 'failed', failure_reason: 'order_create_failed' }).eq('id', row.id)
    return fail(req, 'ORDER_FAILED', 502)
  }
})
