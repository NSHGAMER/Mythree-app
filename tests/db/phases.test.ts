// Integration tests for phases 1–5 (registration, videos, challenge sets, examinations, results, scalability)
// against a STAGING Supabase project – never production.
//   set -a; . ./.env.staging; set +a; npx vitest run -c vitest.db.config.ts tests/db/phases.test.ts
// Needs the staging seed (admin-test, loadtest+1..300 confirmed, pending+1..5 pending_payment) and
// tests/db/phases.setup.sql (approved readiness for loadtest+5 and loadtest+7).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.SUPABASE_URL!
const KEY = process.env.SUPABASE_KEY!
const PASSWORD = process.env.LOADTEST_PASSWORD!
if (!/mxxkpcincouaniqryzfy/.test(URL_ ?? '')) throw new Error('phases.test.ts must run against the staging project')

type Session = { c: SupabaseClient; id: string; token: string }
async function signIn(email: string): Promise<Session> {
  const c = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return { c, id: data.user.id, token: data.session.access_token }
}
const fn = (name: string, token: string | null, body: unknown = {}, headers: Record<string, string> = {}) =>
  fetch(`${URL_}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: JSON.stringify(body),
  })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 1×1 JPEG and a minimal PDF
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')

let admin: Session, member: Session, pending: Session, examMember: Session, viewer: Session, seeker: Session, challenger: Session
const created: { videos: string[]; sets: string[]; schedules: string[] } = { videos: [], sets: [], schedules: [] }

beforeAll(async () => {
  ;[admin, member, pending, examMember, viewer, seeker, challenger] = await Promise.all([
    signIn('admin-test@mythree.test'), signIn('loadtest+1@mythree.test'), signIn('pending+1@mythree.test'),
    signIn('loadtest+5@mythree.test'), signIn('loadtest+9@mythree.test'), signIn('loadtest+11@mythree.test'),
    signIn('loadtest+3@mythree.test'),
  ])
}, 60_000)

afterAll(async () => {
  if (created.sets.length) await admin.c.from('challenge_sets').delete().in('id', created.sets)
  if (created.videos.length) await admin.c.from('video_lessons').delete().in('id', created.videos)
})

describe('registration & member IDs', () => {
  it('a pending member sees the ₹151 fee and no UID yet', async () => {
    const { data, error } = await pending.c.rpc('my_registration')
    expect(error).toBeNull()
    expect(data.status).toBe('pending_payment')
    expect(data.fee).toBe(151)
    expect(data.payment_required).toBe(true)
    expect(data.member_uid).toBeNull()
  })
  it('a pending member cannot open videos or challenges', async () => {
    const v = await pending.c.rpc('my_videos')
    const ch = await pending.c.rpc('get_challenge', { p_kind: 'daily' })
    expect(v.error?.message).toMatch(/REGISTRATION_PENDING/)
    expect(ch.error?.message).toMatch(/REGISTRATION_PENDING/)
  })
  it('confirmed members have a permanent UID of 4 letters + last 4 phone digits', async () => {
    const { data } = await member.c.rpc('my_registration')
    expect(data.status).toBe('confirmed')
    expect(data.member_uid).toBe('LOAD0001')
  })
  it('members cannot read other members’ registration payments or call admin registration functions', async () => {
    const rows = await member.c.from('registration_payments').select('user_id')
    expect((rows.data ?? []).every((r) => r.user_id === member.id)).toBe(true)
    const list = await member.c.rpc('admin_registrations', { p_search: null, p_status: null, p_limit: 10, p_offset: 0 })
    expect(list.error).toBeTruthy()
    const conf = await member.c.rpc('admin_confirm_registration', { p_user: pending.id, p_reference: 'cash 151' })
    expect(conf.error).toBeTruthy()
  })
  it('anonymous visitors can no longer probe phone numbers', async () => {
    const anon = createClient(URL_, KEY, { auth: { persistSession: false } })
    const r = await anon.rpc('check_phone_available', { p_phone: '+918000000001' })
    expect(r.error).toBeTruthy()
  })
  it('admin can search registrations by UID and phone', async () => {
    const byUid = await admin.c.rpc('admin_registrations', { p_search: 'LOAD0005', p_status: null, p_limit: 10, p_offset: 0 })
    expect(byUid.error).toBeNull()
    expect(byUid.data.rows.map((r: { member_uid: string }) => r.member_uid)).toContain('LOAD0005')
    const pend = await admin.c.rpc('admin_registrations', { p_search: null, p_status: 'pending_payment', p_limit: 50, p_offset: 0 })
    expect(pend.data.total).toBeGreaterThanOrEqual(1)
  })
  it('manual confirmation needs a reference, assigns a UID and is audited', async () => {
    const p5 = await signIn('pending+5@mythree.test')
    const before = await p5.c.rpc('my_registration')
    if (before.data.status === 'confirmed') return // already confirmed in an earlier run
    const bad = await admin.c.rpc('admin_confirm_registration', { p_user: p5.id, p_reference: 'x' })
    expect(bad.error?.message).toMatch(/REFERENCE_REQUIRED/)
    const ok = await admin.c.rpc('admin_confirm_registration', { p_user: p5.id, p_reference: 'Cash receipt 0042' })
    expect(ok.error).toBeNull()
    expect(ok.data).toMatch(/^PEND\d{4}(-\d+)?$/)
    const after = await p5.c.rpc('my_registration')
    expect(after.data.status).toBe('confirmed')
    expect(after.data.payments.some((p: { status: string }) => p.status === 'paid')).toBe(true)
  })
  it('registration-status function: pending stays pending without a gateway; confirmed returns the UID', async () => {
    const pend = await (await fn('registration-status', pending.token)).json()
    expect(pend.status).toBe('pending')
    const conf = await (await fn('registration-status', member.token)).json()
    expect(conf).toMatchObject({ status: 'confirmed', member_uid: 'LOAD0001' })
    const anonRes = await fn('registration-status', null)
    expect(anonRes.status).toBe(401)
  })
  it('scheduled job endpoints reject calls without the Vault secret', async () => {
    const r1 = await fn('payments-reconcile', null, {}, { 'x-cron-secret': 'wrong' })
    const r2 = await fn('notifications-worker', null, {}, { 'x-cron-secret': 'wrong' })
    expect(r1.status).toBe(403)
    expect(r2.status).toBe(403)
  })
})

describe('video lessons', () => {
  let videoId: string
  beforeAll(async () => {
    const ins = await admin.c.from('video_lessons').insert([
      { position: 901, title: 'Staging test video', provider: 'youtube', video_ref: 'dQw4w9WgXcQ', duration_seconds: 30, completion_percentage: 90 },
      { position: 902, title: 'Future video', provider: 'youtube', video_ref: 'dQw4w9WgXcQ', duration_seconds: 30, publish_at: new Date(Date.now() + 86400_000).toISOString() },
    ], { defaultToNull: false }).select('id, position')
    expect(ins.error).toBeNull()
    created.videos.push(...ins.data!.map((v) => v.id))
    videoId = ins.data!.find((v) => v.position === 901)!.id
  })
  it('members see published lessons only after their scheduled time', async () => {
    const { data } = await viewer.c.rpc('my_videos')
    const titles = data.videos.map((v: { title: string }) => v.title)
    expect(titles).toContain('Staging test video')
    expect(titles).not.toContain('Future video')
  })
  it('members cannot write progress directly', async () => {
    const r = await viewer.c.from('video_progress').insert({ user_id: viewer.id, video_id: videoId, watched_seconds: 30, completed_at: new Date().toISOString() })
    expect(r.error).toBeTruthy()
  })
  it('seeking to the end does not complete a video', async () => {
    await seeker.c.rpc('record_video_progress', { p_video_id: videoId, p_position: 0 })
    const r = await seeker.c.rpc('record_video_progress', { p_video_id: videoId, p_position: 30 })
    expect(r.error).toBeNull()
    expect(r.data.completed).toBeFalsy()
    expect(r.data.watched_seconds).toBe(0)
  })
  it('real-time playback completes the video, awards XP once, and resumes from the last position', async () => {
    let r = await viewer.c.rpc('record_video_progress', { p_video_id: videoId, p_position: 0 })
    for (const pos of [10, 20, 30]) {
      await sleep(10_200)
      r = await viewer.c.rpc('record_video_progress', { p_video_id: videoId, p_position: pos })
      expect(r.error).toBeNull()
    }
    expect(r.data.completed).toBe(true)
    expect(r.data.watched_seconds).toBe(30)
    const again = await viewer.c.rpc('record_video_progress', { p_video_id: videoId, p_position: 30 })
    expect(again.data.completed).toBe(true)
    const xp = await viewer.c.from('xp_events').select('amount').eq('reason', 'video_complete').eq('ref_id', videoId)
    expect(xp.data).toHaveLength(1)
    const list = await viewer.c.rpc('my_videos')
    const v = list.data.videos.find((x: { id: string }) => x.id === videoId)
    expect(v.last_position).toBe(30)
    expect(v.completed_at).toBeTruthy()
  }, 60_000)
})

describe('admin-managed daily challenge sets', () => {
  it('a configured set replaces the automatic questions for the day', async () => {
    const qs = await admin.c.from('questions').select('id').eq('is_active', true).limit(3)
    const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
    const ins = await admin.c.from('challenge_sets').insert({ kind: 'daily', title: 'Staging set', available_from: today, available_to: today, question_ids: qs.data!.map((q) => q.id), xp_base: 5, xp_per_correct: 2 }).select('id').single()
    expect(ins.error).toBeNull()
    created.sets.push(ins.data!.id)
    const { data, error } = await challenger.c.rpc('get_challenge', { p_kind: 'daily' })
    expect(error).toBeNull()
    if (data.submitted) return // challenger already played today in an earlier run
    expect(new Set(data.questions.map((q: { id: string }) => q.id))).toEqual(new Set(qs.data!.map((q) => q.id)))
  })
  it('members cannot create challenge sets', async () => {
    const r = await member.c.from('challenge_sets').insert({ kind: 'daily', title: 'Hack', available_from: '2026-01-01', available_to: '2026-01-01', question_ids: ['00000000-0000-0000-0000-000000000000'] })
    expect(r.error).toBeTruthy()
  })
})

describe('online examination', () => {
  let scheduleId: string
  let sessionId: string
  beforeAll(async () => {
    const existing = await admin.c.from('exam_schedules').select('id').eq('cohort_month', '2026-11-01').maybeSingle()
    const row = {
      cohort_month: '2026-11-01', title: 'Staging exam', exam_starts_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      entry_closes_at: new Date(Date.now() + 3600_000).toISOString(), duration_minutes: 180, upload_grace_minutes: 15,
      max_marks: 100, pass_marks: 35, question_paper_path: 'staging/paper.pdf', is_published: true,
    }
    const res = existing.data
      ? await admin.c.from('exam_schedules').update(row).eq('id', existing.data.id).select('id').single()
      : await admin.c.from('exam_schedules').insert(row).select('id').single()
    expect(res.error).toBeNull()
    scheduleId = res.data!.id
    const up = await admin.c.storage.from('exam-papers').upload('staging/paper.pdf', PDF, { contentType: 'application/pdf', upsert: true })
    expect(up.error).toBeNull()
  })
  it('members cannot read the question paper before starting', async () => {
    const r = await member.c.storage.from('exam-papers').createSignedUrl('staging/paper.pdf', 60)
    expect(r.error).toBeTruthy()
  })
  it('offline or unapproved members cannot start the online exam', async () => {
    const off = await (await signIn('loadtest+2@mythree.test')).c.rpc('start_exam')
    expect(off.error?.message).toMatch(/NOT_ONLINE_EXAM/)
    const unapproved = await (await signIn('loadtest+13@mythree.test')).c.rpc('start_exam')
    expect(unapproved.error?.message).toMatch(/EXAM_NOT_APPROVED/)
  })
  it('START creates one session with a 3-hour server deadline; pressing again resumes it', async () => {
    const a = await examMember.c.rpc('start_exam')
    expect(a.error).toBeNull()
    sessionId = a.data.id
    const minutes = (Date.parse(a.data.deadline_at) - Date.parse(a.data.started_at)) / 60_000
    expect(Math.round(minutes)).toBe(180)
    const b = await examMember.c.rpc('start_exam')
    expect(b.data.id).toBe(sessionId)
    expect(b.data.already_started).toBe(true)
  })
  it('the member can open the paper during the session', async () => {
    const r = await examMember.c.storage.from('exam-papers').createSignedUrl('staging/paper.pdf', 60)
    expect(r.error).toBeNull()
  })
  it('submitting with no pages is refused', async () => {
    const r = await examMember.c.rpc('submit_exam', { p_session: sessionId })
    if (r.data?.already_submitted) return
    expect(r.error?.message).toMatch(/NO_PAGES/)
  })
  it('uploads only into the member’s own session folder, and registration checks the file exists', async () => {
    const mine = `${examMember.id}/${sessionId}/page-1.jpg`
    const up = await examMember.c.storage.from('answer-sheets').upload(mine, JPEG, { contentType: 'image/jpeg', upsert: false })
    if (up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error
    const reg = await examMember.c.rpc('register_exam_page', { p_session: sessionId, p_page_no: 1, p_path: mine, p_size: JPEG.length })
    expect(reg.error).toBeNull()
    const ghost = await examMember.c.rpc('register_exam_page', { p_session: sessionId, p_page_no: 2, p_path: `${examMember.id}/${sessionId}/never-uploaded.jpg`, p_size: 100 })
    expect(ghost.error?.message).toMatch(/UPLOAD_NOT_FOUND|EXAM_CLOSED/)
    const other = await member.c.storage.from('answer-sheets').upload(`${examMember.id}/${sessionId}/evil.jpg`, JPEG, { contentType: 'image/jpeg' })
    expect(other.error).toBeTruthy()
    const otherRead = await member.c.from('exam_submission_pages').select('id').eq('session_id', sessionId)
    expect(otherRead.data ?? []).toHaveLength(0)
  })
  it('SUBMIT is final and idempotent; uploads are refused afterwards', async () => {
    const s = await examMember.c.rpc('submit_exam', { p_session: sessionId })
    expect(s.error).toBeNull()
    expect(s.data.status).toBe('submitted')
    const again = await examMember.c.rpc('submit_exam', { p_session: sessionId })
    expect(again.data.already_submitted).toBe(true)
    const late = await examMember.c.storage.from('answer-sheets').upload(`${examMember.id}/${sessionId}/late.jpg`, JPEG, { contentType: 'image/jpeg' })
    expect(late.error).toBeTruthy()
  })
  it('admin sees the submission and can view the uploaded page', async () => {
    const r = await admin.c.rpc('admin_exam_submissions', { p_schedule: scheduleId, p_status: null })
    expect(r.error).toBeNull()
    expect(JSON.stringify(r.data)).toContain(sessionId)
    const url = await admin.c.storage.from('answer-sheets').createSignedUrl(`${examMember.id}/${sessionId}/page-1.jpg`, 60)
    expect(url.error).toBeNull()
  })
  it('results stay hidden until published, and published results are never silently overwritten', async () => {
    const save = await admin.c.rpc('admin_save_result', { p_user: examMember.id, p_schedule: scheduleId, p_mode: 'online', p_exam_date: null, p_marks: 72, p_max: 100, p_remarks: 'Good', p_result: 'pass', p_publish: false, p_overwrite_published: false, p_source: 'manual' })
    if (save.error && /RESULT_ALREADY_PUBLISHED/.test(save.error.message)) return // earlier run
    expect(save.error).toBeNull()
    const hidden = await examMember.c.rpc('my_exam')
    expect(hidden.data.results).toHaveLength(0)
    const pub = await admin.c.rpc('admin_publish_results', { p_schedule: scheduleId })
    expect(pub.error).toBeNull()
    const shown = await examMember.c.rpc('my_exam')
    expect(shown.data.results[0]).toMatchObject({ result: 'pass', marks: 72 })
    const over = await admin.c.rpc('admin_save_result', { p_user: examMember.id, p_schedule: scheduleId, p_mode: 'online', p_exam_date: null, p_marks: 10, p_max: 100, p_remarks: null, p_result: 'fail', p_publish: false, p_overwrite_published: false, p_source: 'manual' })
    expect(over.error?.message).toMatch(/RESULT_ALREADY_PUBLISHED/)
  })
  it('Excel import: dry run lists unknown UIDs, duplicates, bad rows and published results without changing anything', async () => {
    const rows = [
      { uid: 'LOAD0002', marks: '55', result: 'PASS' },
      { uid: 'LOAD0002', marks: '60', result: 'pass' },
      { uid: 'NOPE9999', marks: '40', result: 'pass' },
      { uid: 'LOAD0004', marks: 'abc', result: 'pass' },
      { uid: 'LOAD0006', marks: '150', result: 'pass' },
      { uid: 'LOAD0008', marks: '20', result: 'maybe' },
      { uid: 'LOAD0010', marks: '20', result: 'fail', exam_date: 'not-a-date' },
      { uid: 'LOAD0005', marks: '99', result: 'pass' },
    ]
    const dry = await admin.c.rpc('admin_import_results', { p_rows: rows, p_schedule: scheduleId, p_max: 100, p_file_name: 'staging.xlsx', p_dry_run: true, p_publish: false })
    expect(dry.error).toBeNull()
    expect(dry.data.valid).toBe(1)
    expect(dry.data.applied).toBe(0)
    const issues = dry.data.issues.map((i: { issue: string }) => i.issue).join(' | ')
    for (const s of ['UID appears more than once', 'Unknown UID', 'Marks is not a number', 'Marks outside', 'Result must be', 'Exam date or mode', 'already published']) expect(issues).toContain(s)
    const none = await admin.c.from('exam_results').select('id').eq('user_id', (await admin.c.from('profiles').select('id').eq('member_uid', 'LOAD0002').single()).data!.id)
    expect(none.data).toHaveLength(0)
    const apply = await admin.c.rpc('admin_import_results', { p_rows: rows.slice(0, 1), p_schedule: scheduleId, p_max: 100, p_file_name: 'staging.xlsx', p_dry_run: false, p_publish: false })
    expect(apply.data.applied).toBe(1)
    const log = await admin.c.from('result_imports').select('rows_applied').order('id', { ascending: false }).limit(1).single()
    expect(log.data!.rows_applied).toBe(1)
  })
  it('members cannot call evaluation functions', async () => {
    const r = await member.c.rpc('admin_publish_results', { p_schedule: scheduleId })
    expect(r.error).toBeTruthy()
  })
})

describe('dashboard & leaderboard snapshot', () => {
  it('dashboard returns UID, registration, videos and exam schedule in one read', async () => {
    const { data, error } = await examMember.c.rpc('my_dashboard')
    expect(error).toBeNull()
    expect(data.profile.member_uid).toBe('LOAD0005')
    expect(data.profile.registration_status).toBe('confirmed')
    expect(data.videos.total).toBeGreaterThanOrEqual(1)
    expect(data.exam_schedule?.title).toBe('Staging exam')
    expect(data.suggested_exam_month).toBe('2027-02-01')
  })
  it('leaderboard is served from the snapshot and excludes pending members', async () => {
    const { data, error } = await member.c.rpc('leaderboard', { p_period: 'all', p_limit: 100 })
    expect(error).toBeNull()
    expect(data.refreshed_at).toBeTruthy()
    expect(data.rows.some((r: { name: string }) => r.name.startsWith('Pending'))).toBe(false)
  })
  it('admin system health is admin-only', async () => {
    const ok = await admin.c.rpc('admin_system_health')
    expect(ok.error).toBeNull()
    const no = await member.c.rpc('admin_system_health')
    expect(no.error).toBeTruthy()
  })
})
