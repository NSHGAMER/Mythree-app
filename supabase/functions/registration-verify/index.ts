import { verifyRazorpayPaymentSignature } from '../_shared/crypto.ts'
import { adminClient, corsHeaders, fail, json, log, rateLimit, requireUser } from '../_shared/http.ts'
import { capturePayment, fetchPayment, razorpayKeys } from '../_shared/razorpay.ts'

// Called after Razorpay Checkout returns. Registration is confirmed ONLY after the checkout signature
// is valid AND Razorpay's API reports the payment captured for the same order and amount.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return fail(req, 'METHOD_NOT_ALLOWED', 405)
  const { keySecret, enabled } = razorpayKeys()
  if (!enabled) return fail(req, 'PAYMENTS_NOT_CONFIGURED', 503)
  const user = await requireUser(req)
  if (!user) return fail(req, 'NOT_AUTHENTICATED', 401)

  const body = await req.json().catch(() => ({}))
  const orderId = String(body.razorpay_order_id ?? '')
  const paymentId = String(body.razorpay_payment_id ?? '')
  const signature = String(body.razorpay_signature ?? '')
  const db = adminClient()
  if (!(await rateLimit(db, `reg_verify:${user.id}`, 30, 3600))) return fail(req, 'RATE_LIMITED', 429)

  const { data: r } = await db.from('registration_payments').select('*').eq('razorpay_order_id', orderId).eq('user_id', user.id).maybeSingle()
  if (!r) return fail(req, 'ORDER_NOT_FOUND', 404)
  if (r.status === 'paid') {
    const { data: p } = await db.from('profiles').select('member_uid').eq('id', user.id).single()
    return json(req, { verified: true, member_uid: p?.member_uid })
  }
  if (!(await verifyRazorpayPaymentSignature(orderId, paymentId, signature, keySecret))) {
    log('reg_signature_invalid', { payment_id: r.id })
    return fail(req, 'PAYMENT_VERIFICATION_FAILED', 400)
  }
  try {
    let payment = await fetchPayment(paymentId)
    if (payment.order_id !== orderId || payment.amount !== r.amount_paise || payment.currency !== 'INR') {
      log('reg_payment_mismatch', { payment_id: r.id })
      return fail(req, 'PAYMENT_VERIFICATION_FAILED', 400)
    }
    if (payment.status === 'authorized') payment = await capturePayment(paymentId, r.amount_paise)
    if (payment.status !== 'captured') return fail(req, 'PAYMENT_PENDING', 409)
    const { data, error } = await db.rpc('mark_registration_paid', { p_order_id: orderId, p_payment_id: paymentId, p_amount_paise: payment.amount, p_method: payment.method })
    if (error) throw new Error(error.message)
    log('reg_payment_verified', { payment_id: r.id })
    return json(req, { verified: !data?.duplicate, duplicate: !!data?.duplicate, member_uid: data?.member_uid })
  } catch (e) {
    log('reg_verify_error', { payment_id: r.id, error: String(e) })
    // Not marked paid. "Check payment status" or the webhook/reconciliation will confirm it if it was captured.
    return fail(req, 'PAYMENT_VERIFICATION_FAILED', 502)
  }
})
