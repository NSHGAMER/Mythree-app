import { adminClient, corsHeaders, fail, json, log, rateLimit, requireUser } from '../_shared/http.ts'

// Lets a member permanently delete their own account (DPDP Act right to erasure).
// Contribution records survive with user_id = NULL and a payer snapshot, as required for accounting.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return fail(req, 'METHOD_NOT_ALLOWED', 405)
  const user = await requireUser(req)
  if (!user) return fail(req, 'NOT_AUTHENTICATED', 401)
  const body = await req.json().catch(() => ({}))
  if (body.confirm !== 'DELETE') return fail(req, 'CONFIRMATION_REQUIRED')

  const db = adminClient()
  if (!(await rateLimit(db, `delete:${user.id}`, 3, 3600))) return fail(req, 'RATE_LIMITED', 429)

  const { data: me } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role === 'admin') {
    const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if ((count ?? 0) <= 1) return fail(req, 'LAST_ADMIN', 409)
  }

  const { error } = await db.auth.admin.deleteUser(user.id)
  if (error) {
    log('account_delete_error', { error: error.message })
    return fail(req, 'DELETE_FAILED', 500)
  }
  log('account_deleted', { user: user.id })
  return json(req, { deleted: true })
})
