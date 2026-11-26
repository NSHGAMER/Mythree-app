import { adminClient, corsHeaders, fail, fetchRetry, json, log, requireUser } from '../_shared/http.ts'

// Sends an email to the organisation when a member declares final-exam readiness.
// The in-app admin notification is always created by the database; email is optional
// and only sent when RESEND_API_KEY and ADMIN_NOTIFY_EMAILS are configured.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return fail(req, 'METHOD_NOT_ALLOWED', 405)
  const user = await requireUser(req)
  if (!user) return fail(req, 'NOT_AUTHENTICATED', 401)

  const db = adminClient()
  const { data: reqRow } = await db
    .from('exam_requests')
    .select('id, requested_at, days_taken, chapters_completed, address_snapshot, notified_at')
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .maybeSingle()
  if (!reqRow) return fail(req, 'REQUEST_NOT_FOUND', 404)
  if (reqRow.notified_at) return json(req, { ok: true, already: true })

  const key = Deno.env.get('RESEND_API_KEY')
  const to = (Deno.env.get('ADMIN_NOTIFY_EMAILS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const from = Deno.env.get('NOTIFY_FROM_EMAIL') ?? 'Mythree <onboarding@resend.dev>'
  if (!key || to.length === 0) return json(req, { ok: true, email: false })

  const a = reqRow.address_snapshot as Record<string, string | null>
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  const html = `<h2>Final exam readiness – ${esc(a.full_name)}</h2>
<p>${esc(a.full_name)} has completed all ${reqRow.chapters_completed} chapters in <strong>${reqRow.days_taken} days</strong> and is ready for the final exam.</p>
<p><strong>Post the question paper to:</strong><br>${esc(a.full_name)}<br>${esc(a.address_line1)}${a.address_line2 ? '<br>' + esc(a.address_line2) : ''}<br>${esc(a.city)}, ${esc(a.state)} – ${esc(a.pincode)}<br>Phone: ${esc(a.phone)} · Email: ${esc(a.email)}</p>
<p>Manage dispatch in the Mythree admin dashboard → Final exam &amp; dispatch.</p>`

  try {
    const res = await fetchRetry('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: `Final exam readiness: ${a.full_name}`, html }),
    })
    if (!res.ok) throw new Error(`Resend ${res.status}`)
    await db.from('exam_requests').update({ notified_at: new Date().toISOString() }).eq('id', reqRow.id)
    log('exam_notify_sent', { request: reqRow.id })
    return json(req, { ok: true, email: true })
  } catch (e) {
    log('exam_notify_error', { request: reqRow.id, error: String(e) })
    return json(req, { ok: true, email: false })
  }
})
