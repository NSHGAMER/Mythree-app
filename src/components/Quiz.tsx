import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Award, CheckCircle2, Clock, Send, Sparkles, WifiOff, XCircle, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { friendlyError } from '../lib/errors'
import { TIER_STYLES } from '../lib/gamification'
import type { GradedResult, QuestionPayload, ReviewItem } from '../types'
import { BadgeIcon } from './BadgeIcon'
import { Alert, Button, cx, Modal, ProgressBar, ProgressRing } from './ui'

const storeKey = (id: string) => `mythree-answers-${id}`

function loadAnswers(id: string): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(storeKey(id)) || '{}')
  } catch {
    return {}
  }
}

interface QuizRunnerProps {
  sessionId: string
  title: string
  subtitle?: string
  questions: QuestionPayload[]
  startedAt?: string
  timeLimitMinutes?: number | null
  onSubmit: (answers: Record<string, string>) => Promise<GradedResult>
  onDone: (r: GradedResult) => void
  onExit: () => void
}

/**
 * One-question-at-a-time runner. Answers are kept locally (sessionStorage) until submit,
 * then graded only by the server. Submission is idempotent, so retries after a network error are safe.
 */
export function QuizRunner({ sessionId, title, subtitle, questions, startedAt, timeLimitMinutes, onSubmit, onDone, onExit }: QuizRunnerProps) {
  const { online } = useApp()
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>(() => loadAnswers(sessionId))
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState(false)
  const q = questions[idx]
  const answered = questions.filter((x) => (answers[x.id] ?? '').trim() !== '').length

  const deadline = useMemo(
    () => (timeLimitMinutes && startedAt ? new Date(startedAt).getTime() + timeLimitMinutes * 60_000 : null),
    [timeLimitMinutes, startedAt],
  )
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!deadline) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [deadline])
  const remaining = deadline ? Math.max(0, Math.floor((deadline - now) / 1000)) : null

  useEffect(() => {
    try {
      sessionStorage.setItem(storeKey(sessionId), JSON.stringify(answers))
    } catch {
      /* ignore */
    }
  }, [answers, sessionId])

  async function submit() {
    setConfirm(false)
    if (!navigator.onLine) {
      setErr('You are offline. Your answers are kept on this device – reconnect and press Submit again. Nothing has been submitted yet.')
      return
    }
    setSubmitting(true)
    setErr('')
    try {
      const r = await onSubmit(answers)
      try {
        sessionStorage.removeItem(storeKey(sessionId))
      } catch {
        /* ignore */
      }
      onDone(r)
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setSubmitting(false)
    }
  }

  // Auto-submit when a timed test runs out
  useEffect(() => {
    if (remaining === 0 && !submitting) submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining === 0])

  const setAnswer = (v: string) => setAnswers((a) => ({ ...a, [q.id]: v }))

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={onExit} className="grid size-10 place-items-center rounded-xl text-ink-3 hover:bg-surface-2" aria-label="Exit">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg text-ink">{title}</p>
          {subtitle && <p className="truncate text-xs text-ink-3">{subtitle}</p>}
        </div>
        {remaining !== null && (
          <span className={cx('flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold tabular-nums', remaining < 60 ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-ink-2')}>
            <Clock className="size-4" /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <ProgressBar value={((idx + 1) / questions.length) * 100} label="Question progress" />
      <p className="mt-2 text-xs font-semibold text-ink-3">
        Question {idx + 1} of {questions.length} · {answered} answered
      </p>

      {!online && (
        <Alert tone="gold" className="mt-4" icon={<WifiOff className="size-5" />}>
          You are offline. Keep answering – your answers stay on this device. You will need a connection to submit.
        </Alert>
      )}
      {err && <Alert tone="danger" className="mt-4">{err}</Alert>}

      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22 }} className="card mt-5 p-5 sm:p-7">
          <p className="text-xl leading-relaxed text-ink sm:text-2xl" style={{ fontFamily: 'var(--font-sans)' }}>
            {q.prompt}
          </p>
          <div className="mt-6 grid gap-3">
            {q.type === 'fill_blank' ? (
              <input
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswer(e.target.value)}
                className="h-14 w-full rounded-2xl border-2 border-line bg-bg-elevated px-4 text-lg text-ink focus:border-gold focus:outline-none"
                placeholder="Type your answer (Devanāgarī or English letters)"
                aria-label="Your answer"
                autoFocus
                maxLength={200}
              />
            ) : (
              (q.type === 'true_false' ? ['True', 'False'] : q.options).map((opt, i) => {
                const value = q.type === 'true_false' ? (i === 0 ? 'true' : 'false') : String(i)
                const selected = answers[q.id] === value
                return (
                  <button
                    key={value}
                    onClick={() => setAnswer(value)}
                    className={cx(
                      'flex min-h-14 items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left text-[1.05rem] font-medium transition active:scale-[0.99]',
                      selected ? 'border-maroon bg-maroon-soft text-maroon-ink shadow-[0_4px_0_0_var(--maroon)]' : 'border-line bg-bg-elevated text-ink hover:border-line-strong shadow-[0_4px_0_0_var(--border)]',
                    )}
                    aria-pressed={selected}
                  >
                    <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg border-2 text-sm font-bold', selected ? 'border-maroon bg-maroon text-on-primary' : 'border-line-strong text-ink-3')}>
                      {q.type === 'true_false' ? (i === 0 ? 'T' : 'F') : String.fromCharCode(65 + i)}
                    </span>
                    <span>{opt}</span>
                  </button>
                )
              })
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} icon={<ArrowLeft className="size-4" />}>
          Previous
        </Button>
        {idx < questions.length - 1 ? (
          <Button onClick={() => setIdx((i) => i + 1)}>
            Next <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button variant="gold" loading={submitting} onClick={() => (answered < questions.length ? setConfirm(true) : submit())} icon={<Send className="size-4" />}>
            Submit
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label="Jump to question">
        {questions.map((x, i) => (
          <button
            key={x.id}
            onClick={() => setIdx(i)}
            className={cx('size-8 rounded-lg text-xs font-bold transition', i === idx ? 'bg-maroon text-on-primary' : (answers[x.id] ?? '') !== '' ? 'bg-gold-soft text-gold-ink' : 'bg-surface-2 text-ink-3')}
            aria-label={`Question ${i + 1}${(answers[x.id] ?? '') !== '' ? ', answered' : ''}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit with unanswered questions?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>Keep answering</Button>
            <Button onClick={submit}>Submit anyway</Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">You have answered {answered} of {questions.length} questions. Unanswered questions are marked incorrect.</p>
      </Modal>
    </div>
  )
}

// ======================================================================= Results
export function ResultView({ result, title, passLabel, actions }: { result: GradedResult; title: string; passLabel?: string; actions: React.ReactNode }) {
  const pct = Number(result.percentage)
  return (
    <div className="mx-auto max-w-2xl">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card relative overflow-hidden p-6 text-center sm:p-10">
        <div className={cx('absolute inset-x-0 top-0 h-1.5', result.passed ? 'bg-gradient-to-r from-success via-gold to-saffron' : 'bg-gradient-to-r from-maroon to-gold')} />
        {result.passed && <Celebration />}
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-3">{title}</p>
        <div className="mt-5 flex justify-center">
          <ProgressRing value={pct} size={150} stroke={12} tone={result.passed ? 'gold' : 'maroon'}>
            <div>
              <p className="font-display text-4xl text-ink">{Math.round(pct)}%</p>
              <p className="text-xs text-ink-3">{result.score} / {result.total}</p>
            </div>
          </ProgressRing>
        </div>
        <h2 className="mt-5 text-3xl text-ink">{result.passed ? (passLabel ?? 'Passed!') : 'Keep practising'}</h2>
        <p lang="sa" className="sanskrit mt-1 text-lg text-gold-ink">{result.passed ? 'उत्तमम्!' : 'पुनः प्रयतस्व'}</p>
        {!result.passed && result.pass_percentage && (
          <p className="mt-2 text-sm text-ink-3">You need {result.pass_percentage}% to complete this chapter. Revisit the textbook and try again – your best score is kept.</p>
        )}
        {result.already_submitted && <p className="mt-2 text-xs text-ink-3">This attempt was already submitted – showing the saved result.</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: 'spring' }} className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-4 py-2 font-bold text-gold-ink">
            <Zap className="size-4" /> +{result.xp_awarded} XP
          </motion.span>
          {result.first_pass && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-4 py-2 font-bold text-success">
              <CheckCircle2 className="size-4" /> Chapter completed
            </span>
          )}
        </div>
        {result.new_badges?.length > 0 && (
          <div className="mt-6 rounded-2xl border border-gold/40 bg-gold-soft/50 p-4">
            <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-gold-ink">
              <Award className="size-4" /> New badge{result.new_badges.length > 1 ? 's' : ''} earned!
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              {result.new_badges.map((b) => (
                <motion.div key={b.code} initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.6 }} className="flex flex-col items-center gap-1">
                  <span className={cx('grid size-14 place-items-center rounded-2xl ring-2', TIER_STYLES[b.tier]?.bg, TIER_STYLES[b.tier]?.ring, TIER_STYLES[b.tier]?.text)}>
                    <BadgeIcon name={b.icon} className="size-7" />
                  </span>
                  <span className="text-xs font-semibold text-ink">{b.name}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>
      </motion.div>
      <ReviewList review={result.review} />
    </div>
  )
}

export function ReviewList({ review }: { review: ReviewItem[] }) {
  if (!review?.length) return null
  return (
    <div className="mt-8">
      <h3 className="mb-4 text-xl text-ink">Review your answers</h3>
      <div className="space-y-3">
        {review.map((r, i) => {
          const label = (v: string | null) => {
            if (v === null || v === '') return '—'
            if (r.type === 'mcq') return r.options[Number(v)] ?? v
            if (r.type === 'true_false') return v === 'true' ? 'True' : 'False'
            return v
          }
          return (
            <div key={r.question_id} className={cx('card border-l-4 p-4', r.correct ? 'border-l-success' : 'border-l-danger')}>
              <div className="flex gap-3">
                {r.correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-danger" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {i + 1}. {r.prompt}
                  </p>
                  <p className="mt-1.5 text-sm text-ink-3">
                    Your answer: <span className={r.correct ? 'font-semibold text-success' : 'font-semibold text-danger'}>{label(r.given)}</span>
                  </p>
                  {!r.correct && (
                    <p className="text-sm text-ink-3">
                      Correct answer: <span className="font-semibold text-success">{label(r.correct_answer)}</span>
                    </p>
                  )}
                  {r.explanation && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">{r.explanation}</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Celebration() {
  const pieces = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({ i, x: (i / 18) * 100 + (Math.random() * 6 - 3), d: 0.2 + Math.random() * 0.8, c: ['#c9962b', '#7a1f2b', '#e8891d', '#2f7d4f'][i % 4] })),
    [],
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span key={p.i} className="absolute top-0 block size-2 rounded-sm" style={{ left: `${p.x}%`, background: p.c }} initial={{ y: -10, opacity: 1, rotate: 0 }} animate={{ y: 380, opacity: 0, rotate: 360 }} transition={{ duration: 2.2, delay: p.d, ease: 'easeIn' }} />
      ))}
      <Sparkles className="absolute right-6 top-6 size-6 text-gold" />
    </div>
  )
}
