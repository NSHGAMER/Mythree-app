// Mythree load test – drives the real Supabase API (PostgREST RPCs + Auth) with concurrent virtual users.
//
//   SUPABASE_URL=... SUPABASE_KEY=<publishable key> LOADTEST_PASSWORD=... \
//   LOADTEST_ACCOUNTS=200 LOADTEST_VUS=2000 node loadtest/run.mjs
//
// Accounts loadtest+1..N@mythree.test must exist (see loadtest/seed.sql). Results are written to loadtest/results/.
import { mkdirSync, writeFileSync } from 'node:fs'

const URL_ = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_KEY
const PASSWORD = process.env.LOADTEST_PASSWORD
const ACCOUNTS = Number(process.env.LOADTEST_ACCOUNTS ?? 50)
const VUS = Number(process.env.LOADTEST_VUS ?? 2000)
const SCENARIOS = (process.env.LOADTEST_SCENARIOS ?? 'login,dashboard,leaderboard,submit,phone,faq').split(',')
if (!URL_ || !KEY || !PASSWORD) {
  console.error('Set SUPABASE_URL, SUPABASE_KEY and LOADTEST_PASSWORD')
  process.exit(1)
}

const H = (token) => ({ apikey: KEY, Authorization: `Bearer ${token ?? KEY}`, 'Content-Type': 'application/json' })

async function timed(fn) {
  const t = performance.now()
  try {
    const r = await fn()
    return { ms: performance.now() - t, status: r.status, ok: r.ok, body: r.ok ? await r.json().catch(() => null) : await r.text().catch(() => '') }
  } catch (e) {
    return { ms: performance.now() - t, status: 0, ok: false, body: String(e) }
  }
}

function stats(name, results, wallMs) {
  const ms = results.map((r) => r.ms).sort((a, b) => a - b)
  const pct = (p) => (ms.length ? Math.round(ms[Math.min(ms.length - 1, Math.floor((p / 100) * ms.length))]) : 0)
  const byStatus = {}
  for (const r of results) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
  const s = {
    scenario: name,
    requests: results.length,
    ok: results.filter((r) => r.ok).length,
    errors: results.filter((r) => !r.ok).length,
    status: byStatus,
    p50_ms: pct(50),
    p95_ms: pct(95),
    p99_ms: pct(99),
    max_ms: Math.round(ms.at(-1) ?? 0),
    wall_ms: Math.round(wallMs),
    rps: Math.round((results.length / wallMs) * 1000),
    sample_error: results.find((r) => !r.ok)?.body?.toString().slice(0, 200),
  }
  console.table([s])
  return s
}

async function burst(name, n, make) {
  const t = performance.now()
  const results = await Promise.all(Array.from({ length: n }, (_, i) => timed(() => make(i))))
  return stats(name, results, performance.now() - t)
}

const login = (i) =>
  fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({ email: `loadtest+${(i % ACCOUNTS) + 1}@mythree.test`, password: PASSWORD }),
  })
const rpc = (token, fn, args = {}) => fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H(token), body: JSON.stringify(args) })

const report = { started: new Date().toISOString(), target: URL_.replace(/^https:\/\/([a-z0-9]{6}).*/, 'https://$1…'), accounts: ACCOUNTS, vus: VUS, results: [] }

// 1) Obtain sessions (sequential + paced to respect Auth rate limits)
const tokens = []
for (let i = 0; i < ACCOUNTS; i++) {
  const r = await timed(() => login(i))
  if (r.ok) tokens.push(r.body.access_token)
  else if (r.status === 429) {
    console.log(`auth rate limit reached after ${tokens.length} sign-ins; continuing with those sessions`)
    break
  }
}
console.log(`sessions: ${tokens.length}`)
if (!tokens.length) process.exit(1)
const tok = (i) => tokens[i % tokens.length]

// 1b) Stepped concurrency: find where latency degrades (LOADTEST_LEVELS=50,100,200,500)
const LEVELS = (process.env.LOADTEST_LEVELS ?? '').split(',').filter(Boolean).map(Number)
for (const n of LEVELS) {
  report.results.push(await burst(`my_dashboard @${n} concurrent`, n, (i) => rpc(tok(i), 'my_dashboard')))
  report.results.push(await burst(`leaderboard @${n} concurrent`, n, (i) => rpc(tok(i), 'leaderboard', { p_period: i % 2 ? 'week' : 'all', p_limit: 50 })))
  await new Promise((r) => setTimeout(r, 3000))
}

// 1c) Phase 6 (staging): new read paths at stepped concurrency, video heartbeats (writes), and
//     realistic "users" – each virtual user runs a short session with think time, so N users ≠ N simultaneous requests.
const P6 = (process.env.LOADTEST_P6_LEVELS ?? '').split(',').filter(Boolean).map(Number)
const VIDEO = process.env.LOADTEST_VIDEO_ID
for (const n of P6) {
  report.results.push(await burst(`my_dashboard @${n} concurrent`, n, (i) => rpc(tok(i), 'my_dashboard')))
  report.results.push(await burst(`leaderboard(snapshot) @${n} concurrent`, n, (i) => rpc(tok(i), 'leaderboard', { p_period: i % 2 ? 'week' : 'all', p_limit: 50 })))
  report.results.push(await burst(`my_videos @${n} concurrent`, n, (i) => rpc(tok(i), 'my_videos')))
  report.results.push(await burst(`my_exam @${n} concurrent`, n, (i) => rpc(tok(i), 'my_exam')))
  report.results.push(await burst(`my_registration @${n} concurrent`, n, (i) => rpc(tok(i), 'my_registration')))
  if (VIDEO) report.results.push(await burst(`record_video_progress @${n} concurrent (writes)`, n, (i) => rpc(tok(i), 'record_video_progress', { p_video_id: VIDEO, p_position: 10 })))
  await new Promise((r) => setTimeout(r, 5000))
}
const USERS = (process.env.LOADTEST_USERS ?? '').split(',').filter(Boolean).map(Number)
const WINDOW_S = Number(process.env.LOADTEST_WINDOW_S ?? 60)
for (const n of USERS) {
  const t0 = performance.now()
  const all = []
  let peak = 0, inflight = 0
  const call = async (fnName, args) => {
    inflight++; peak = Math.max(peak, inflight)
    const r = await timed(() => rpc(tok(Math.floor(Math.random() * tokens.length)), fnName, args))
    inflight--; r.fn = fnName; all.push(r)
  }
  const think = () => new Promise((r) => setTimeout(r, 1000 + Math.random() * 3000))
  await Promise.all(Array.from({ length: n }, async () => {
    await new Promise((r) => setTimeout(r, Math.random() * WINDOW_S * 1000)) // arrivals spread over the window
    await call('my_dashboard'); await think()
    await call('my_videos'); await think()
    if (VIDEO) { await call('record_video_progress', { p_video_id: VIDEO, p_position: 20 }); await think() }
    await call('leaderboard', { p_period: 'all', p_limit: 50 }); await think()
    await call('my_exam')
  }))
  const s = stats(`${n} users active within ${WINDOW_S}s (5 calls each, 1–4 s think time)`, all, performance.now() - t0)
  s.peak_in_flight = peak
  s.by_function = Object.fromEntries([...new Set(all.map((r) => r.fn))].map((fn) => { const rs = all.filter((r) => r.fn === fn); const ms = rs.map((r) => r.ms).sort((a, b) => a - b); return [fn, { ok: rs.filter((r) => r.ok).length, n: rs.length, p50: Math.round(ms[Math.floor(ms.length / 2)]), p95: Math.round(ms[Math.floor(ms.length * 0.95)]) }] }))
  report.results.push(s)
  await new Promise((r) => setTimeout(r, 5000))
}

// 2) Concurrent login burst (expect rate limiting to protect Auth)
if (SCENARIOS.includes('login')) report.results.push(await burst(`login burst x${Math.min(VUS, 300)}`, Math.min(VUS, 300), login))

// 3) Dashboard burst – the heaviest read (one RPC per member)
if (SCENARIOS.includes('dashboard')) report.results.push(await burst(`my_dashboard x${VUS}`, VUS, (i) => rpc(tok(i), 'my_dashboard')))

// 4) Leaderboard burst
if (SCENARIOS.includes('leaderboard')) report.results.push(await burst(`leaderboard x${VUS}`, VUS, (i) => rpc(tok(i), 'leaderboard', { p_period: i % 2 ? 'week' : 'all', p_limit: 50 })))

// 5) Simultaneous test submissions: every session starts chapter 1, then all submit at once
if (SCENARIOS.includes('submit')) {
  const ch = await (await fetch(`${URL_}/rest/v1/chapters?select=id&is_published=eq.true&order=position&limit=1`, { headers: H(tokens[0]) })).json()
  const chapterId = ch[0]?.id
  const sessions = await Promise.all(tokens.map((t) => rpc(t, 'start_chapter_test', { p_chapter_id: chapterId }).then((r) => r.json())))
  const n = Math.min(VUS, sessions.length * 10)
  report.results.push(
    await burst(`submit_chapter_test x${n} (${sessions.length} attempts, duplicates test idempotency)`, n, (i) => {
      const s = sessions[i % sessions.length]
      const answers = Object.fromEntries((s.questions ?? []).map((q) => [q.id, q.type === 'true_false' ? 'true' : '0']))
      return rpc(tokens[i % sessions.length], 'submit_chapter_test', { p_attempt_id: s.attempt_id, p_answers: answers })
    }),
  )
}

// 6) Registration pre-check burst (anonymous, rate limited per IP)
if (SCENARIOS.includes('phone')) report.results.push(await burst(`check_phone_available x${Math.min(VUS, 500)} (anon)`, Math.min(VUS, 500), (i) => rpc(null, 'check_phone_available', { p_phone: `+9190000${String(i).padStart(5, '0')}` })))

// 7) Chatbot burst
if (SCENARIOS.includes('faq')) report.results.push(await burst(`faq_answer x${Math.min(VUS, 1000)}`, Math.min(VUS, 1000), (i) => rpc(tok(i), 'faq_answer', { p_query: 'is guru dakshina compulsory' })))

report.finished = new Date().toISOString()
mkdirSync('loadtest/results', { recursive: true })
const file = `loadtest/results/run-${Date.now()}.json`
writeFileSync(file, JSON.stringify(report, null, 2))
console.log(`saved ${file}`)
