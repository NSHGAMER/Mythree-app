import { verifyRazorpayPaymentSignature } from '../_shared/crypto.ts'
import { adminClient, corsHeaders, fail, json, log, rateLimit, requireUser } from '../_shared/http.ts'
import { capturePayment, fetchPayment, razorpayKeys } from '../_shared/razorpay.ts'

// Called by the app after Razorpay Checkout succeeds. A contribution is marked paid ONLY after:
// 1) the checkout signature is valid, and 2) Razorpay's API confirms the payment is captured for the same order and amount.
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
  if (!(await rateLimit(db, `verify:${user.id}`, 30, 3600))) return fail(req, 'RATE_LIMITED', 429)

  const { data: c } = await db.from('contributions').select('*').eq('razorpay_order_id', orderId).eq('user_id', user.id).maybeSingle()
  if (!c) return fail(req, 'ORDER_NOT_FOUND', 404)
  if (c.status === 'paid') return json(req, { verified: true, contribution: c })

  if (!(await verifyRazorpayPaymentSignature(orderId, paymentId, signature, keySecret))) {
    log('payment_signature_invalid', { contribution_id: c.id })
    return fail(req, 'PAYMENT_VERIFICATION_FAILED', 400)
  }

  try {
    let payment = await fetchPayment(paymentId)
    if (payment.order_id !== orderId || payment.amount !== c.amount_paise || payment.currency !== 'INR') {
      log('payment_mismatch', { contribution_id: c.id, payment_order: payment.order_id, amount: payment.amount })
      return fail(req, 'PAYMENT_VERIFICATION_FAILED', 400)
    }
    if (payment.status === 'authorized') payment = await capturePayment(paymentId, c.amount_paise)
    if (payment.status !== 'captured') {
      log('payment_not_captured', { contribution_id: c.id, status: payment.status })
      return fail(req, 'PAYMENT_VERIFICATION_FAILED', 409)
    }
    const { data: paid, error } = await db.rpc('mark_contribution_paid', {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_amount_paise: payment.amount,
      p_method: payment.method,
    })
    if (error) throw new Error(error.message)
    log('payment_verified', { contribution_id: c.id, amount: payment.amount })
    return json(req, { verified: true, contribution: paid })
  } catch (e) {
    log('payment_verify_error', { contribution_id: c.id, error: String(e) })
    // Not marked as paid. The webhook will reconcile if the payment was actually captured.
    return fail(req, 'PAYMENT_VERIFICATION_FAILED', 502)
  }
})
