import { supabase } from './supabase'
import type {
  AppSettings,
  ChallengeSession,
  Contribution,
  Dashboard,
  GradedResult,
  LeaderboardRow,
  MemberRow,
  RegistrationInfo,
  TestSession,
} from '../types'

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('NetworkError: offline')
  }
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message || error.code)
  return data as T
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
  settings: async () => {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (error) throw error
    return data as AppSettings
  },
  phoneAvailable: (phone: string) => rpc<boolean>('check_phone_available', { p_phone: phone }),
  faq: (q: string) =>
    rpc<{ matches: { id: string; question: string; answer: string; category: string; score: number }[] }>('faq_answer', {
      p_query: q,
    }),
  contact: (v: { name: string; email: string; phone?: string; message: string }) =>
    rpc<boolean>('submit_contact_message', { p_name: v.name, p_email: v.email, p_phone: v.phone ?? '', p_message: v.message }),

  // Member
  dashboard: () => rpc<Dashboard>('my_dashboard'),
  startTest: (chapterId: string) => rpc<TestSession>('start_chapter_test', { p_chapter_id: chapterId }),
  submitTest: (attemptId: string, answers: Record<string, string>) =>
    rpc<GradedResult>('submit_chapter_test', { p_attempt_id: attemptId, p_answers: answers }),
  challenge: (kind: 'daily' | 'weekly') => rpc<ChallengeSession>('get_challenge', { p_kind: kind }),
  submitChallenge: (instanceId: string, answers: Record<string, string>) =>
    rpc<GradedResult>('submit_challenge', { p_instance_id: instanceId, p_answers: answers }),
  leaderboard: (period: 'all' | 'week') =>
    rpc<{ period: string; rows: LeaderboardRow[]; me: { rank: number; score: number } | null }>('leaderboard', {
      p_period: period,
      p_limit: 50,
    }),
  requestFinalExam: () => rpc<Record<string, unknown>>('request_final_exam'),
  myContributions: async () => {
    const { data, error } = await supabase.from('contributions').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data as Contribution[]
  },

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
    confirmRegistration: (userId: string, reference: string) =>
      rpc<string>('admin_confirm_registration', { p_user: userId, p_reference: reference }),
  },
}
