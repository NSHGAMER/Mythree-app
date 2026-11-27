import { cached, invalidate, withRetry } from './cache'
import { supabase } from './supabase'
import type {
  AppSettings,
  ChallengeSession,
  Contribution,
  Dashboard,
  GradedResult,
  LeaderboardRow,
  MemberRow,
  MyExam,
  RegistrationInfo,
  TestSession,
  VideoLesson,
} from '../types'

async function rpcOnce<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('NetworkError: offline')
  }
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message || error.code || String(error))
  return data as T
}

// Functions that are safe to repeat (reads, or writes made idempotent on the server). Transient
// overload errors (429/503/504/network) are retried with exponential backoff + jitter.
const IDEMPOTENT = new Set([
  'my_dashboard', 'leaderboard', 'my_videos', 'my_exam', 'my_registration', 'faq_answer', 'get_challenge',
  'start_chapter_test', 'submit_chapter_test', 'submit_challenge', 'record_video_progress', 'request_final_exam',
  'submit_exam', 'register_exam_page', 'admin_member_overview', 'admin_analytics', 'admin_registrations',
])

/** Listeners can show "Busy – retrying…" while a call is being retried. */
export const retryListeners = new Set<(fn: string, attempt: number) => void>()

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!IDEMPOTENT.has(fn)) return rpcOnce<T>(fn, args)
  return withRetry(() => rpcOnce<T>(fn, args), { retries: 3, onRetry: (a) => retryListeners.forEach((l) => l(fn, a)) })
}

/** Data that changes after learning activity. */
export function invalidateLearning() {
  invalidate('dashboard', 'videos', 'exam', 'leaderboard')
}

async function invoke<T>(fn: string, body?: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('NetworkError: offline')
  }
  const { data, error } = await supabase.functions.invoke(fn, { body: body ?? {} })
  if (error) {
    // Edge functions return { error: CODE } with a non-2xx status
    let code = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json()
        code = j.error ?? code
      }
    } catch {
      /* ignore */
    }
    throw new Error(code)
  }
  return data as T
}

export const api = {
  // Public
  settings: (fresh = false) => {
    if (fresh) invalidate('settings')
    return cached(
      'settings',
      async () => {
        const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single()
        if (error) throw error
        return data as AppSettings
      },
      { ttlMs: 30 * 60_000, persist: true, staleWhileRevalidate: true },
    )
  },
  publishedFaqs: () =>
    cached(
      'faqs',
      async () => {
        const { data, error } = await supabase.from('faqs').select('id, question, answer, keywords, category, sort_order').eq('is_published', true).order('sort_order')
        if (error) throw error
        return data as { id: string; question: string; answer: string; keywords: string[]; category: string; sort_order: number }[]
      },
      { ttlMs: 30 * 60_000, persist: true, staleWhileRevalidate: true },
    ),
  phoneAvailable: (phone: string) => rpc<boolean>('check_phone_available', { p_phone: phone }),
  faq: (q: string) =>
    rpc<{ matches: { id: string; question: string; answer: string; category: string; score: number }[] }>('faq_answer', {
      p_query: q,
    }),
  contact: (v: { name: string; email: string; phone?: string; message: string }) =>
    rpc<boolean>('submit_contact_message', { p_name: v.name, p_email: v.email, p_phone: v.phone ?? '', p_message: v.message }),

  // Member
  /** Shared by Dashboard, Learn, Chapter, Challenges and Final Exam pages – one call per 30 s. */
  dashboard: (fresh = false) => {
    if (fresh) invalidate('dashboard')
    return cached('dashboard', () => rpc<Dashboard>('my_dashboard'), { ttlMs: 30_000 })
  },
  startTest: (chapterId: string) => rpc<TestSession>('start_chapter_test', { p_chapter_id: chapterId }),
  submitTest: (attemptId: string, answers: Record<string, string>) =>
    rpc<GradedResult>('submit_chapter_test', { p_attempt_id: attemptId, p_answers: answers }).finally(invalidateLearning),
  challenge: (kind: 'daily' | 'weekly') => rpc<ChallengeSession>('get_challenge', { p_kind: kind }),
  submitChallenge: (instanceId: string, answers: Record<string, string>) =>
    rpc<GradedResult>('submit_challenge', { p_instance_id: instanceId, p_answers: answers }).finally(invalidateLearning),
  leaderboard: (period: 'all' | 'week') =>
    cached(
      `leaderboard:${period}`,
      () => rpc<{ period: string; rows: LeaderboardRow[]; me: { rank: number; score: number } | null; refreshed_at?: string }>('leaderboard', { p_period: period, p_limit: 50 }),
      { ttlMs: 60_000 },
    ),
  requestFinalExam: () => rpc<Record<string, unknown>>('request_final_exam').finally(invalidateLearning),
  myContributions: async () => {
    const { data, error } = await supabase.from('contributions').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data as Contribution[]
  },

  // Examination
  myExam: () => rpc<MyExam>('my_exam'),
  startExam: () => rpc<Record<string, unknown>>('start_exam'),
  registerExamPage: (sessionId: string, pageNo: number, path: string, size: number) =>
    rpc<{ ok: boolean; pages_count: number }>('register_exam_page', { p_session: sessionId, p_page_no: pageNo, p_path: path, p_size: size }),
  removeExamPage: (sessionId: string, pageNo: number) => rpc<{ removed_path: string | null }>('remove_exam_page', { p_session: sessionId, p_page_no: pageNo }),
  submitExam: (sessionId: string) => rpc<Record<string, unknown>>('submit_exam', { p_session: sessionId }).finally(invalidateLearning),

  // Video lessons
  myVideos: () =>
    cached('videos', () => rpc<{ videos: VideoLesson[]; upcoming: { position: number; title: string; publish_at: string }[] }>('my_videos'), { ttlMs: 30_000 }),
  recordVideoProgress: (videoId: string, position: number) =>
    rpc<{ watched_seconds: number; completed: boolean; percent: number }>('record_video_progress', { p_video_id: videoId, p_position: position }),

  // Registration fee (mandatory ₹151)
  myRegistration: () => rpc<RegistrationInfo>('my_registration'),
  registrationOrder: (idempotencyKey: string) =>
    invoke<
      | { status: 'confirmed'; member_uid: string }
      | { status: 'pending'; order_id: string; key_id: string; amount_paise: number; currency: string; payment_id: string; prefill: Record<string, string | undefined> }
    >('registration-order', { idempotency_key: idempotencyKey }),
  registrationVerify: (p: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    invoke<{ verified: boolean; duplicate?: boolean; member_uid?: string }>('registration-verify', p),
  registrationStatus: () =>
    invoke<{ status: 'confirmed' | 'pending' | 'processing'; member_uid?: string; recovered?: boolean; gateway?: string }>('registration-status'),

  // Edge functions
  sendOtp: () => invoke<{ sent: boolean; expires_in: number; resend_in: number }>('otp-send'),
  verifyOtp: (code: string) => invoke<{ verified: boolean }>('otp-verify', { code }),
  paymentsConfig: () => invoke<{ enabled: boolean; key_id: string | null; test_mode: boolean }>('payments-config'),
  createOrder: (amountRupees: number, idempotencyKey: string, note?: string) =>
    invoke<{ order_id: string; key_id: string; amount_paise: number; currency: string; contribution_id: string }>(
      'payments-create-order',
      { amount: amountRupees, idempotency_key: idempotencyKey, note },
    ),
  verifyPayment: (p: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    invoke<{ verified: boolean; contribution: Contribution }>('payments-verify', p),
  notifyExamRequest: () => invoke<{ ok: boolean }>('notify-admin', { kind: 'exam_request' }),
  deleteAccount: (confirm: string) => invoke<{ deleted: boolean }>('account-delete', { confirm }),

  // Admin
  admin: {
    analytics: () => rpc<Record<string, unknown>>('admin_analytics'),
    members: (p: { search?: string; filter?: string; sort?: string; dir?: string; limit?: number; offset?: number }) =>
      rpc<MemberRow[]>('admin_member_overview', {
        p_search: p.search ?? null,
        p_filter: p.filter ?? 'all',
        p_sort: p.sort ?? 'registered_at',
        p_dir: p.dir ?? 'desc',
        p_limit: p.limit ?? 50,
        p_offset: p.offset ?? 0,
      }),
    member: (id: string) => rpc<Record<string, unknown>>('admin_member_detail', { p_user: id }),
    examRequests: (status?: string) => rpc<Record<string, unknown>[]>('admin_exam_requests', { p_status: status ?? null }),
    updateExam: (id: string, status: string, courier?: string, tracking?: string, notes?: string) =>
      rpc('admin_update_exam_request', {
        p_id: id,
        p_status: status,
        p_courier: courier || null,
        p_tracking: tracking || null,
        p_notes: notes || null,
      }),
    contributions: () => rpc<Record<string, unknown>[]>('admin_contributions', { p_limit: 2000 }),
    setRole: (id: string, role: 'admin' | 'member') => rpc('admin_set_role', { p_user: id, p_role: role }),
    saveQuestion: (q: Record<string, unknown>) => rpc<string>('admin_save_question', { p_question: q }),
    reorderChapters: (ids: string[]) => rpc('admin_reorder_chapters', { p_ids: ids }),
    registrations: (p: { search?: string; status?: string; limit?: number; offset?: number }) =>
      rpc<{ total: number; rows: Record<string, unknown>[] }>('admin_registrations', {
        p_search: p.search || null,
        p_status: p.status || null,
        p_limit: p.limit ?? 50,
        p_offset: p.offset ?? 0,
      }),
    videoStats: () => rpc<Record<string, unknown>[]>('admin_video_stats'),
    examCohorts: () => rpc<Record<string, unknown>[]>('admin_exam_cohorts'),
    examSubmissions: (schedule?: string, status?: string) =>
      rpc<Record<string, unknown>[]>('admin_exam_submissions', { p_schedule: schedule || null, p_status: status || null }),
    saveResult: (p: { user: string; schedule: string | null; mode: 'online' | 'offline'; examDate: string | null; marks: number | null; max: number; remarks: string; result: string; publish: boolean; overwrite?: boolean }) =>
      rpc<Record<string, unknown>>('admin_save_result', {
        p_user: p.user, p_schedule: p.schedule, p_mode: p.mode, p_exam_date: p.examDate, p_marks: p.marks, p_max: p.max,
        p_remarks: p.remarks, p_result: p.result, p_publish: p.publish, p_overwrite_published: p.overwrite ?? false, p_source: 'manual',
      }),
    publishResults: (schedule: string) => rpc<number>('admin_publish_results', { p_schedule: schedule }),
    importResults: (rows: Record<string, unknown>[], schedule: string | null, max: number, fileName: string, dryRun: boolean, publish: boolean) =>
      rpc<{ rows_total: number; valid: number; applied: number; issues: { row: number; uid: string; issue: string }[]; preview: { row: number; uid: string; marks: number | null; result: string }[]; dry_run: boolean }>(
        'admin_import_results',
        { p_rows: rows, p_schedule: schedule, p_max: max, p_file_name: fileName, p_dry_run: dryRun, p_publish: publish },
      ),
    markPurged: (sessionId: string) => rpc('admin_mark_session_purged', { p_session: sessionId }),
    confirmRegistration: (userId: string, reference: string) =>
      rpc<string>('admin_confirm_registration', { p_user: userId, p_reference: reference }),
  },
}
