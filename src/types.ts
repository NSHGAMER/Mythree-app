export type Role = 'admin' | 'member'
export type QuestionType = 'mcq' | 'true_false' | 'fill_blank'
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed'
export type ExamStatus =
  | 'requested'
  | 'approved'
  | 'paper_dispatched'
  | 'delivered'
  | 'exam_completed'
  | 'on_hold'
  | 'cancelled'

export interface Profile {
  id: string
  email: string
  full_name: string
  phone: string | null
  phone_verified_at: string | null
  age: number | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  country: string
  role: Role
  programme_start_date: string
  xp: number
  current_streak: number
  longest_streak: number
  last_active_date: string | null
  show_on_leaderboard: boolean
  avatar_seed: string | null
  created_at: string
  date_of_birth: string | null
  guardian_name: string | null
  guardian_phone: string | null
  exam_preference: 'online' | 'offline'
  member_uid: string | null
  registration_status: 'pending_payment' | 'confirmed' | 'cancelled'
  registration_confirmed_at: string | null
}

export interface VideoLesson {
  id: string
  position: number
  title: string
  title_sanskrit: string | null
  description: string | null
  provider: 'youtube' | 'url'
  video_ref: string
  duration_seconds: number
  completion_percentage: number
  publish_at: string
  chapter_id: string | null
  watched_seconds: number
  last_position: number
  completed_at: string | null
}

export interface RegistrationInfo {
  status: 'pending_payment' | 'confirmed' | 'cancelled'
  member_uid: string | null
  confirmed_at: string | null
  fee: number
  payment_required: boolean
  exam_preference: 'online' | 'offline'
  payments: {
    id: string
    status: 'created' | 'paid' | 'failed' | 'refunded'
    amount_paise: number
    razorpay_order_id: string | null
    razorpay_payment_id: string | null
    receipt_no: string | null
    created_at: string
    paid_at: string | null
    failure_reason: string | null
  }[]
}

export interface AppSettings {
  suggested_contribution: number
  min_contribution: number
  programme_days: number
  default_pass_percentage: number
  sequential_unlock: boolean
  daily_question_count: number
  weekly_question_count: number
  weekly_pass_percentage: number
  final_exam_min_weekly_passed: number
  require_phone_verification: boolean
  contact_email: string | null
  contact_phone: string | null
  contact_whatsapp: string | null
  contact_address: string | null
  maintenance_mode: boolean
  maintenance_message: string | null
  registration_fee: number
  registration_payment_required: boolean
}

export interface ChapterCard {
  id: string
  position: number
  title: string
  title_sanskrit: string | null
  description: string | null
  textbook_reference: string | null
  learning_objectives: string[]
  pass_percentage: number
  xp_reward: number
  time_limit_minutes: number | null
  question_count: number
  status: ProgressStatus
  best_percentage: number
  attempts: number
  completed_at: string | null
  locked: boolean
}

export interface BadgeLite {
  code: string
  name: string
  icon: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  awarded_at?: string
}

export interface ExamRequest {
  id: string
  user_id: string
  requested_at: string
  programme_start_date: string
  days_taken: number
  chapters_completed: number
  address_snapshot: Record<string, string | null>
  status: ExamStatus
  courier: string | null
  tracking_number: string | null
  dispatched_at: string | null
  delivered_at: string | null
}

export interface Dashboard {
  profile: {
    id: string
    full_name: string
    email: string
    phone: string | null
    phone_verified: boolean
    role: Role
    xp: number
    current_streak: number
    longest_streak: number
    last_active_date: string | null
    programme_start_date: string
    created_at: string
    has_address: boolean
  }
  programme: {
    start_date: string
    target_days: number
    days_elapsed: number
    total_chapters: number
    completed_chapters: number
    remaining_chapters: number
    percent: number
    current_chapter: ChapterCard | null
  }
  chapters: ChapterCard[]
  daily: { period_key: string; submitted: boolean; score: number | null; total: number | null; xp_awarded: number } | null
  weekly: {
    period_key: string
    submitted: boolean
    score: number | null
    total: number | null
    passed: boolean | null
    xp_awarded: number
  } | null
  weekly_xp: number
  rank: number
  badges_earned: number
  badges_total: number
  recent_badges: BadgeLite[]
  exam: {
    eligible: boolean
    chapters_completed: number
    chapters_total: number
    weekly_passed: number
    weekly_required: number
    request: ExamRequest | null
  }
  contributed_paise: number
  settings: { suggested_contribution: number; require_phone_verification: boolean }
}

export interface QuestionPayload {
  id: string
  type: QuestionType
  prompt: string
  options: string[]
}

export interface ReviewItem {
  question_id: string
  type: QuestionType
  prompt: string
  options: string[]
  given: string | null
  correct: boolean
  correct_answer: string
  explanation: string | null
}

export interface TestSession {
  attempt_id: string
  started_at: string
  chapter: {
    id: string
    title: string
    title_sanskrit: string | null
    position: number
    pass_percentage: number
    time_limit_minutes: number | null
  }
  questions: QuestionPayload[]
}

export interface GradedResult {
  attempt_id?: string
  score: number
  total: number
  percentage: number
  passed: boolean
  xp_awarded: number
  pass_percentage?: number
  review: ReviewItem[]
  first_pass?: boolean
  chapter_completed?: boolean
  new_badges: BadgeLite[]
  already_submitted: boolean
}

export interface ChallengeSession {
  instance_id: string
  kind: 'daily' | 'weekly'
  period_key: string
  submitted: boolean
  result: Omit<GradedResult, 'new_badges' | 'already_submitted'> | null
  questions: QuestionPayload[]
  weekly_pass_percentage: number
}

export interface LeaderboardRow {
  rank: number
  name: string
  score: number
  streak: number
  is_me: boolean
  avatar_seed: string
}

export interface Contribution {
  id: string
  amount_paise: number
  currency: string
  status: 'created' | 'paid' | 'failed' | 'refunded'
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  payment_method: string | null
  receipt_no: string | null
  note: string | null
  created_at: string
  paid_at: string | null
}

export interface Faq {
  id: string
  question: string
  answer: string
  keywords: string[]
  category: string
  is_published: boolean
  sort_order: number
}

export interface MemberRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  phone_verified: boolean
  email_verified: boolean
  registered_at: string
  programme_start_date: string
  current_chapter: string | null
  current_chapter_position: number | null
  completed_chapters: number
  total_chapters: number
  completion_pct: number
  last_active: string | null
  avg_score: number | null
  tests_taken: number
  xp: number
  current_streak: number
  days_taken: number
  exam_status: string
  exam_requested_at: string | null
  contributed: boolean
  contribution_total_paise: number
  city: string | null
  state: string | null
  total_count: number
}
