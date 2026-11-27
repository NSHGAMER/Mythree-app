import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allow = allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export const fail = (req: Request, code: string, status = 400) => json(req, { error: code }, status)

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Resolves the signed-in user from the request's bearer token. */
export async function requireUser(req: Request): Promise<User | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await adminClient().auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/**
 * Trusted client IP: headers set by the edge network first; for X-Forwarded-For use the LAST hop
 * (appended by the platform proxy) – the first value can be forged by the client.
 */
export function clientIp(req: Request) {
  const cf = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip')
  if (cf?.trim()) return cf.trim()
  const xff = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return xff[xff.length - 1] ?? 'unknown'
}

export async function rateLimit(db: SupabaseClient, key: string, max: number, windowSeconds: number) {
  const { data, error } = await db.rpc('check_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds })
  if (error) {
    console.error('rate limit check failed', error.message)
    return true // fail open on infrastructure errors; abuse is still bounded by provider limits
  }
  return data === true
}

export function log(event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...details }))
}

/** fetch with timeout and a single retry for network errors / 5xx. */
export async function fetchRetry(url: string, init: RequestInit, timeoutMs = 10000, retries = 1): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal })
      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
        continue
      }
      return res
    } catch (e) {
      if (attempt >= retries) throw e
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    } finally {
      clearTimeout(t)
    }
  }
}
