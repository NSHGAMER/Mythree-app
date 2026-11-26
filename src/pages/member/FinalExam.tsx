import { motion } from 'motion/react'
import { Check, CheckCircle2, Circle, MapPin, PackageCheck, ScrollText, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, buttonClass, Card, cx, EmptyState, Modal, PageHeader, ProgressBar, SkeletonCards } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { EXAM_STATUS_LABEL, fmtDate } from '../../lib/format'

const TIMELINE = ['requested', 'approved', 'paper_dispatched', 'delivered', 'exam_completed'] as const

export default function FinalExamPage() {
  useDocumentTitle('Final exam')
  const { profile } = useAuth()
  const { toast } = useApp()
  const { data, loading, error, reload } = useAsync(() => api.dashboard(), [])
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (loading && !data) return <SkeletonCards count={2} />
  if (error || !data) return <EmptyState title="Couldn't load">{friendlyError(error)}</EmptyState>

  const exam = data.exam
  const req = exam.request

  async function submit() {
    setBusy(true)
    setErr('')
    try {
      await api.requestFinalExam()
      api.notifyExamRequest().catch(() => {}) // email the admins if configured; in-app notification is already saved
      setConfirm(false)
      toast('Your readiness has been recorded. The organisation has been notified.')
      reload()
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Final examination" sanskrit="अन्तिमपरीक्षा" subtitle="The final exam is written on paper. The question paper is posted to your registered address." />

      {req ? (
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-success-soft text-success"><CheckCircle2 className="size-7" /></span>
            <div>
              <p className="font-display text-2xl text-ink">Readiness confirmed</p>
              <p className="text-sm text-ink-3">Requested on {fmtDate(req.requested_at)} · completed in {req.days_taken} days</p>
            </div>
          </div>
          <ol className="mt-8 space-y-0">
            {TIMELINE.map((s, i) => {
              const idx = TIMELINE.indexOf(req.status as (typeof TIMELINE)[number])
              const reached = idx >= i
              return (
                <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < TIMELINE.length - 1 && <span className={cx('absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-0.5', idx > i ? 'bg-success' : 'bg-line')} />}
                  <span className={cx('relative z-10 grid size-8 shrink-0 place-items-center rounded-full', reached ? 'bg-success text-white' : 'border-2 border-line bg-surface text-ink-3')}>
                    {reached ? <Check className="size-4" /> : <Circle className="size-3" />}
                  </span>
                  <div className="pt-1">
                    <p className={cx('font-semibold', reached ? 'text-ink' : 'text-ink-3')}>{EXAM_STATUS_LABEL[s]}</p>
                    {s === 'paper_dispatched' && req.dispatched_at && <p className="text-xs text-ink-3">{fmtDate(req.dispatched_at)}{req.courier ? ` · ${req.courier}` : ''}{req.tracking_number ? ` · Tracking ${req.tracking_number}` : ''}</p>}
                    {s === 'delivered' && req.delivered_at && <p className="text-xs text-ink-3">{fmtDate(req.delivered_at)}</p>}
                  </div>
                </li>
              )
            })}
          </ol>
          {req.status === 'on_hold' && <Alert tone="gold" className="mt-4">Your request is on hold. The organisation may contact you to confirm details.</Alert>}
          <div className="mt-6 rounded-2xl bg-surface-2 p-4 text-sm">
            <p className="mb-1 flex items-center gap-2 font-semibold text-ink"><MapPin className="size-4" /> Posting address</p>
            <p className="text-ink-2">
              {[req.address_snapshot.address_line1, req.address_snapshot.address_line2, req.address_snapshot.city, req.address_snapshot.state, req.address_snapshot.pincode].filter(Boolean).join(', ')}
            </p>
            <p className="mt-2 text-xs text-ink-3">If this address has changed, please contact us immediately.</p>
          </div>
        </Card>
      ) : exam.eligible ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="relative overflow-hidden p-6 text-center sm:p-10">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-maroon via-gold to-saffron" />
            <ScrollText className="mx-auto size-14 text-gold" />
            <h2 className="mt-4 text-3xl text-ink">Congratulations, {profile?.full_name.split(' ')[0]}!</h2>
            <p className="mt-2 text-ink-2">You have completed all {exam.chapters_total} chapters in {data.programme.days_elapsed} days.</p>
            {!data.profile.has_address && (
              <Alert tone="danger" className="mt-5 text-left">
                Please <Link to="/app/settings" className="font-semibold underline">add your full postal address</Link> before requesting the exam paper.
              </Alert>
            )}
            <Button size="lg" variant="gold" className="mt-8" disabled={!data.profile.has_address} onClick={() => setConfirm(true)}>
              Yes, I am ready to take the Final Exam
            </Button>
          </Card>
        </motion.div>
      ) : (
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-maroon-soft text-maroon-ink"><Truck className="size-7" /></span>
            <div>
              <p className="font-display text-2xl text-ink">Not yet eligible</p>
              <p className="text-sm text-ink-3">Complete every chapter to unlock the final exam request.</p>
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-1 flex justify-between text-sm"><span className="text-ink-2">Chapters completed</span><span className="font-semibold text-ink">{exam.chapters_completed} / {exam.chapters_total}</span></div>
            <ProgressBar value={exam.chapters_total ? (exam.chapters_completed / exam.chapters_total) * 100 : 0} size="lg" label="Chapters completed" />
          </div>
          {exam.weekly_required > 0 && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-sm"><span className="text-ink-2">Weekly challenges passed</span><span className="font-semibold text-ink">{exam.weekly_passed} / {exam.weekly_required}</span></div>
              <ProgressBar value={(Math.min(exam.weekly_passed, exam.weekly_required) / exam.weekly_required) * 100} tone="gold" label="Weekly challenges" />
            </div>
          )}
          <Link to="/app/learn" className={buttonClass('primary', 'md', 'mt-6')}>Continue learning</Link>
        </Card>
      )}

      <Card className="mt-6 p-5 text-sm text-ink-2">
        <p className="flex items-center gap-2 font-semibold text-ink"><PackageCheck className="size-5 text-gold" /> How it works</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>Confirm you are ready. We record the date and the number of days you took.</li>
          <li>The organisation reviews your request and posts the printed question paper to your registered address.</li>
          <li>Write the exam as instructed in the paper and return it to the organisation.</li>
        </ol>
      </Card>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Confirm final exam readiness"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>Not yet</Button>
            <Button onClick={submit} loading={busy}>Confirm – I am ready</Button>
          </>
        }
      >
        {err && <Alert tone="danger" className="mb-3">{err}</Alert>}
        <p className="text-sm text-ink-2">The question paper will be posted to:</p>
        <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm font-medium text-ink">
          {profile?.full_name}<br />
          {[profile?.address_line1, profile?.address_line2].filter(Boolean).join(', ')}<br />
          {profile?.city}, {profile?.state} – {profile?.pincode}
        </p>
        <p className="mt-3 text-xs text-ink-3">If the address is wrong, cancel and update it in Account Settings first.</p>
      </Modal>
    </div>
  )
}
