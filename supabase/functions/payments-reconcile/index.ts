import { adminClient, log } from '../_shared/http.ts'
import { fetchOrderPayments, razorpayKeys } from '../_shared/razorpay.ts'

// Called every 10 minutes by pg_cron (deploy with verify_jwt = false; authenticated by the shared
// secret kept in Supabase Vault). Confirms captured payments whose browser verification and webhook
// were both missed, and expires orders that were never paid. Safe to run repeatedly (idempotent RPCs).
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const db = adminClient()
  const { data: ok } = await db.rpc('verify_cron_secret', { p_secret: req.headers.get('x-cron-secret') ?? '' })
  if (ok !== true) return new Response('forbidden', { status: 403 })
  if (!razorpayKeys().enabled) return Response.json({ skipped: 'payments not configured' })

  const { data: orders, error } = await db.rpc('open_orders_for_reconciliation', { p_limit: 40 })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const summary = { checked: 0, confirmed: 0, expired: 0, errors: 0 }
  for (const o of (orders ?? []) as { kind: 'registration' | 'contribution'; order_id: string; amount_paise: number; created_at: string }[]) {
    summary.checked++
    try {
      const payments = await fetchOrderPayments(o.order_id)
      const captured = payments.find((p) => p.status === 'captured' && p.amount === o.amount_paise)
      if (o.kind === 'registration') await db.from('registration_payments').update({ last_checked_at: new Date().toISOString() }).eq('razorpay_order_id', o.order_id)
      if (captured) {
        const fn = o.kind === 'registration' ? 'mark_registration_paid' : 'mark_contribution_paid'
        const r = await db.rpc(fn, { p_order_id: o.order_id, p_payment_id: captured.id, p_amount_paise: captured.amount, p_method: captured.method })
        if (r.error) throw new Error(r.error.message)
        summary.confirmed++
        log('reconcile_confirmed', { kind: o.kind, order: o.order_id })
      } else if (!payments.some((p) => p.status === 'authorized' || p.status === 'created') && Date.now() - Date.parse(o.created_at) > 24 * 3600_000) {
        const fn = o.kind === 'registration' ? 'mark_registration_failed' : 'mark_contribution_failed'
        await db.rpc(fn, { p_order_id: o.order_id, p_reason: 'expired_unpaid' })
        summary.expired++
      }
    } catch (e) {
      summary.errors++
      log('reconcile_error', { order: o.order_id, error: String(e) })
    }
  }
  log('reconcile_run', summary)
  return Response.json(summary)
})
