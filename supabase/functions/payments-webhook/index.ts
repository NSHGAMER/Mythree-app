import { verifyRazorpayWebhookSignature } from '../_shared/crypto.ts'
import { adminClient, log } from '../_shared/http.ts'

// Razorpay → Mythree server-to-server webhook (deploy with verify_jwt = false).
// Configure in Razorpay Dashboard → Webhooks with events: payment.captured, payment.failed.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? ''
  const raw = await req.text()
  if (!(await verifyRazorpayWebhookSignature(raw, req.headers.get('x-razorpay-signature'), secret))) {
    log('webhook_signature_invalid')
    return new Response('invalid signature', { status: 401 })
  }

  let event: { event?: string; payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; method: string; error_description?: string } } } }
  try {
    event = JSON.parse(raw)
  } catch {
    return new Response('bad json', { status: 400 })
  }
  const p = event.payload?.payment?.entity
  const db = adminClient()

  try {
    if (event.event === 'payment.captured' && p?.order_id) {
      const { error } = await db.rpc('mark_contribution_paid', { p_order_id: p.order_id, p_payment_id: p.id, p_amount_paise: p.amount, p_method: p.method })
      if (error && !/ORDER_NOT_FOUND/.test(error.message)) throw new Error(error.message)
      log('webhook_captured', { order: p.order_id })
    } else if (event.event === 'payment.failed' && p?.order_id) {
      await db.rpc('mark_contribution_failed', { p_order_id: p.order_id, p_reason: p.error_description ?? 'payment_failed' })
      log('webhook_failed', { order: p.order_id })
    }
    return new Response('ok', { status: 200 })
  } catch (e) {
    log('webhook_error', { error: String(e) })
    return new Response('retry', { status: 500 }) // Razorpay retries on non-2xx
  }
})
