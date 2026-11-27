import { adminClient, fetchRetry, log } from '../_shared/http.ts'

// Drains the pgmq 'notifications' queue every 2 minutes (pg_cron → pg_net; verify_jwt = false,
// authenticated by the Vault shared secret). Sends one digest e-mail to the organisation when Resend is
// configured. Messages are only archived after a successful send (or when e-mail is not configured –
// the in-app admin notification already exists), so nothing is dropped silently: failures stay queued
// and become visible again after the visibility timeout.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const db = adminClient()
  const { data: ok } = await db.rpc('verify_cron_secret', { p_secret: req.headers.get('x-cron-secret') ?? '' })
  if (ok !== true) return new Response('forbidden', { status: 403 })

  const { data: msgs, error } = await db.rpc('notifications_read', { p_qty: 25, p_vt: 300 })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const list = (msgs ?? []) as { msg_id: number; read_ct: number; message: { kind: string; title: string; body: string | null; link: string | null } }[]
  if (!list.length) return Response.json({ processed: 0 })

  const key = Deno.env.get('RESEND_API_KEY')
  const to = (Deno.env.get('ADMIN_NOTIFY_EMAILS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const site = Deno.env.get('SITE_URL') ?? 'https://mythree-five.vercel.app'
  let emailed = false
  if (key && to.length) {
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
    const items = list.map((m) => `<li><strong>${esc(m.message.title)}</strong>${m.message.body ? ' – ' + esc(m.message.body) : ''}${m.message.link ? ` (<a href="${site}${esc(m.message.link)}">open</a>)` : ''}</li>`).join('')
    try {
      const res = await fetchRetry('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: Deno.env.get('NOTIFY_FROM_EMAIL') ?? 'Mythree <onboarding@resend.dev>', to, subject: `Mythree: ${list.length} new notification${list.length > 1 ? 's' : ''}`, html: `<ul>${items}</ul>` }),
      })
      if (!res.ok) throw new Error(`Resend ${res.status}`)
      emailed = true
    } catch (e) {
      // keep messages queued; they become visible again after 5 minutes. Give up e-mailing after 10 tries.
      log('notifications_email_error', { error: String(e) })
      const stale = list.filter((m) => m.read_ct >= 10).map((m) => m.msg_id)
      if (stale.length) await db.rpc('notifications_archive', { p_ids: stale })
      return Response.json({ processed: 0, retry: true, archived_after_retries: stale.length })
    }
  }
  await db.rpc('notifications_archive', { p_ids: list.map((m) => m.msg_id) })
  log('notifications_processed', { count: list.length, emailed })
  return Response.json({ processed: list.length, emailed })
})
