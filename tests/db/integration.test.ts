// Backend integration tests against a real Supabase project.
//   SUPABASE_URL=... SUPABASE_KEY=<publishable> LOADTEST_PASSWORD=... npx vitest run -c vitest.db.config.ts
// Requires seeded accounts loadtest+1@mythree.test, loadtest+2@mythree.test and admin-test@mythree.test (admin).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.SUPABASE_URL!
const KEY = process.env.SUPABASE_KEY!
const PASSWORD = process.env.LOADTEST_PASSWORD!

async function signIn(email: string) {
  const c = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return { c, id: data.user.id }
}

let m1: { c: SupabaseClient; id: string }
let m2: { c: SupabaseClient; id: string }
let admin: { c: SupabaseClient; id: string }
let anon: SupabaseClient
let chapters: { id: string; position: number }[]
let keys: Map<string, string>

/** Correct answers for a question set, looked up with the admin client (members can never read keys). */
const correct = (qs: { id: string }[]) => Object.fromEntries(qs.map((q) => [q.id, keys.get(q.id)!]))
const wrong = (qs: { id: string; type: string; options: string[] }[]) =>
  Object.fromEntries(qs.map((q) => [q.id, q.type === 'true_false' ? (keys.get(q.id) === 'true' ? 'false' : 'true') : q.type === 'mcq' ? String((Number(keys.get(q.id)) + 1) % q.options.length) : 'zzz']))

beforeAll(async () => {
  ;[m1, m2, admin] = await Promise.all([signIn('loadtest+1@mythree.test'), signIn('loadtest+2@mythree.test'), signIn('admin-test@mythree.test')])
  anon = createClient(URL_, KEY, { auth: { persistSession: false } })
  const ch = await admin.c.from('chapters').select('id, position').eq('is_published', true).order('position')
  chapters = ch.data!
  const k = await admin.c.from('question_keys').select('question_id, accepted_answers')
  keys = new Map(k.data!.map((r) => [r.question_id as string, (r.accepted_answers as string[])[0]]))
}, 60_000)

describe('row level security & role permissions', () => {
  it('a member only sees their own profile', async () => {
    const { data } = await m1.c.from('profiles').select('id')
    expect(data!.map((r) => r.id)).toEqual([m1.id])
  })
  it('anonymous visitors see no profiles', async () => {
    const { data } = await anon.from('profiles').select('id')
    expect(data ?? []).toHaveLength(0)
  })
  it('members cannot read questions or answer keys directly', async () => {
    const q = await m1.c.from('questions').select('id').limit(1)
    const k = await m1.c.from('question_keys').select('question_id').limit(1)
    expect(q.data ?? []).toHaveLength(0)
    expect(k.data ?? []).toHaveLength(0)
  })
  it('members cannot change their XP or role', async () => {
    const xp = await m1.c.from('profiles').update({ xp: 999999 }).eq('id', m1.id)
    const role = await m1.c.from('profiles').update({ role: 'admin' }).eq('id', m1.id)
    expect(xp.error).toBeTruthy()
    expect(role.error).toBeTruthy()
  })
  it('members can update their own address but not someone else’s', async () => {
    const own = await m1.c.from('profiles').update({ city: 'Mysuru' }).eq('id', m1.id).select('city')
    expect(own.data?.[0]?.city).toBe('Mysuru')
    const other = await m1.c.from('profiles').update({ city: 'Hacked' }).eq('id', m2.id).select('id')
    expect(other.data ?? []).toHaveLength(0)
  })
  it('members cannot insert contributions or call payment functions', async () => {
    const ins = await m1.c.from('contributions').insert({ user_id: m1.id, amount_paise: 100, idempotency_key: crypto.randomUUID() })
    expect(ins.error).toBeTruthy()
    const paid = await m1.c.rpc('mark_contribution_paid', { p_order_id: 'x', p_payment_id: 'y', p_amount_paise: 100, p_method: 'upi' })
    expect(paid.error).toBeTruthy()
  })
  it('admin functions are forbidden to members and allowed to admins', async () => {
    const m = await m1.c.rpc('admin_member_overview', {})
    expect(m.error?.message).toMatch(/FORBIDDEN|permission/)
    const a = await admin.c.rpc('admin_member_overview', { p_limit: 5 })
    expect(a.error).toBeNull()
    expect(Array.isArray(a.data)).toBe(true)
  })
})

describe('chapter tests, completion and XP', () => {
  it('later chapters are locked until earlier ones are completed', async () => {
    const r = await m2.c.rpc('start_chapter_test', { p_chapter_id: chapters[1].id })
    expect(r.error?.message).toMatch(/CHAPTER_LOCKED/)
  })

  it('a failed attempt gives effort XP once; resubmitting the same attempt is idempotent', async () => {
    const before = (await m2.c.from('profiles').select('xp').single()).data!.xp
    const s = (await m2.c.rpc('start_chapter_test', { p_chapter_id: chapters[0].id })).data
    expect(s.questions.length).toBeGreaterThan(0)
    expect(JSON.stringify(s.questions)).not.toMatch(/accepted_answers|explanation/)
    const r1 = (await m2.c.rpc('submit_chapter_test', { p_attempt_id: s.attempt_id, p_answers: wrong(s.questions) })).data
    expect(r1.passed).toBe(false)
    expect(r1.xp_awarded).toBe(5)
    const r2 = (await m2.c.rpc('submit_chapter_test', { p_attempt_id: s.attempt_id, p_answers: correct(s.questions) })).data
    expect(r2.already_submitted).toBe(true)
    expect(r2.passed).toBe(false)
    const after = (await m2.c.from('profiles').select('xp').single()).data!.xp
    expect(after - before).toBe(5)
  })

  it('passing marks the chapter complete and awards chapter XP exactly once', async () => {
    const before = (await m2.c.from('profiles').select('xp').single()).data!.xp
    const s = (await m2.c.rpc('start_chapter_test', { p_chapter_id: chapters[0].id })).data
    const r = (await m2.c.rpc('submit_chapter_test', { p_attempt_id: s.attempt_id, p_answers: correct(s.questions) })).data
    expect(r.passed).toBe(true)
    expect(r.first_pass).toBe(true)
    expect(r.percentage).toBe(100)
    const p = (await m2.c.from('chapter_progress').select('status, completed_at').eq('chapter_id', chapters[0].id).single()).data!
    expect(p.status).toBe('completed')
    expect(p.completed_at).toBeTruthy()
    const mid = (await m2.c.from('profiles').select('xp').single()).data!.xp
    expect(mid - before).toBeGreaterThanOrEqual(120) // 100 + 20 perfect (+ any badge bonus)

    const s2 = (await m2.c.rpc('start_chapter_test', { p_chapter_id: chapters[0].id })).data
    const r2 = (await m2.c.rpc('submit_chapter_test', { p_attempt_id: s2.attempt_id, p_answers: correct(s2.questions) })).data
    expect(r2.xp_awarded).toBe(0)
    // and the next chapter is now unlocked
    const next = await m2.c.rpc('start_chapter_test', { p_chapter_id: chapters[1].id })
    expect(next.error).toBeNull()
  })

  it('awards badges (first chapter) server-side', async () => {
    const { data } = await m2.c.from('user_badges').select('badge_code')
    expect(data!.map((b) => b.badge_code)).toContain('first_chapter')
  })
})

describe('daily & weekly challenges', () => {
  it('one daily challenge per day; XP awarded once', async () => {
    const a = (await m2.c.rpc('get_challenge', { p_kind: 'daily' })).data
    const b = (await m2.c.rpc('get_challenge', { p_kind: 'daily' })).data
    expect(a.instance_id).toBe(b.instance_id)
    if (!a.submitted) {
      const r1 = (await m2.c.rpc('submit_challenge', { p_instance_id: a.instance_id, p_answers: correct(a.questions) })).data
      expect(r1.xp_awarded).toBe(10 + 4 * r1.score)
    }
    const r2 = (await m2.c.rpc('submit_challenge', { p_instance_id: a.instance_id, p_answers: {} })).data
    expect(r2.already_submitted).toBe(true)
  })
  it('weekly challenge is graded against the weekly pass mark', async () => {
    const w = (await m2.c.rpc('get_challenge', { p_kind: 'weekly' })).data
    if (!w.submitted) {
      const r = (await m2.c.rpc('submit_challenge', { p_instance_id: w.instance_id, p_answers: correct(w.questions) })).data
      expect(r.passed).toBe(true)
      expect(r.xp_awarded).toBeGreaterThanOrEqual(100)
    }
  })
})

describe('final exam readiness', () => {
  it('is refused until every chapter is complete', async () => {
    const r = await m1.c.rpc('request_final_exam')
    expect(r.error?.message).toMatch(/NOT_ELIGIBLE/)
  })

  it('after completing all chapters: request saved with days taken, admin notified, idempotent', async () => {
    for (const ch of chapters) {
      const s = (await m1.c.rpc('start_chapter_test', { p_chapter_id: ch.id })).data
      const r = (await m1.c.rpc('submit_chapter_test', { p_attempt_id: s.attempt_id, p_answers: correct(s.questions) })).data
      expect(r.chapter_completed).toBe(true)
    }
    const d = (await m1.c.rpc('my_dashboard')).data
    expect(d.programme.percent).toBe(100)
    expect(d.exam.eligible).toBe(true)

    const req = (await m1.c.rpc('request_final_exam')).data
    expect(req.already_requested).toBe(false)
    expect(req.days_taken).toBeGreaterThanOrEqual(1)
    expect(req.address_snapshot.pincode).toBeTruthy()
    const again = (await m1.c.rpc('request_final_exam')).data
    expect(again.already_requested).toBe(true)
    expect(again.id).toBe(req.id)

    const list = (await admin.c.rpc('admin_exam_requests', { p_status: null })).data as { id: string }[]
    expect(list.some((r) => r.id === req.id)).toBe(true)
    const notes = (await admin.c.from('admin_notifications').select('kind, user_id').eq('kind', 'exam_request').eq('user_id', m1.id)).data
    expect(notes!.length).toBe(1)

    const upd = await admin.c.rpc('admin_update_exam_request', { p_id: req.id, p_status: 'paper_dispatched', p_courier: 'India Post', p_tracking: 'EE123IN', p_notes: null })
    expect(upd.error).toBeNull()
    const mine = (await m1.c.from('exam_requests').select('status, dispatched_at').single()).data!
    expect(mine.status).toBe('paper_dispatched')
    expect(mine.dispatched_at).toBeTruthy()
  }, 120_000)
})

describe('leaderboard & chatbot', () => {
  it('leaderboard masks surnames and marks the caller', async () => {
    const r = (await m1.c.rpc('leaderboard', { p_period: 'all', p_limit: 20 })).data
    expect(r.rows.length).toBeGreaterThan(0)
    for (const row of r.rows) expect(row.name).not.toMatch(/\s\w{2,}$/)
    expect(r.me.rank).toBeGreaterThanOrEqual(1)
  })
  it('chatbot only answers from published FAQs', async () => {
    const hit = (await anon.rpc('faq_answer', { p_query: 'Is Guru Dakshina compulsory?' })).data
    expect(hit.matches[0].answer).toMatch(/voluntary/i)
    const miss = (await anon.rpc('faq_answer', { p_query: 'cricket score today' })).data
    expect(miss.matches.length === 0 || miss.matches[0].score < 0.5).toBe(true)
  })
})
