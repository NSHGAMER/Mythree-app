import { ArrowLeft, BookMarked, CheckCircle2, Clock, ListChecks, Lock, PlayCircle, Target, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, buttonClass, Card, EmptyState, Pill, SkeletonCards } from '../../components/ui'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { fmtDate } from '../../lib/format'

export default function ChapterPage() {
  const { chapterId } = useParams()
  const navigate = useNavigate()
  const { data, loading } = useAsync(() => api.dashboard(), [chapterId])
  const ch = data?.chapters.find((c) => c.id === chapterId)
  useDocumentTitle(ch ? `Chapter ${ch.position}` : 'Chapter')
  const [readConfirmed, setReadConfirmed] = useState(false)

  if (loading && !data) return <SkeletonCards count={2} />
  if (!ch) return <EmptyState title="Chapter not found" action={<Link to="/app/learn" className={buttonClass('primary')}>Back to chapters</Link>} />

  const done = ch.status === 'completed'
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/learn" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> All chapters
      </Link>
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-maroon to-[#4a1219] p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f1cf7d]">Chapter {ch.position}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">{ch.title}</h1>
          {ch.title_sanskrit && <p lang="sa" className="sanskrit mt-1 text-2xl text-[#f6dc9c]">{ch.title_sanskrit}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {done && <Pill tone="success"><CheckCircle2 className="size-3.5" /> Completed {fmtDate(ch.completed_at)}</Pill>}
            {ch.locked && <Pill tone="neutral"><Lock className="size-3.5" /> Locked</Pill>}
          </div>
        </div>
        <div className="space-y-6 p-6 sm:p-8">
          {ch.description && <p className="text-ink-2">{ch.description}</p>}
          {ch.textbook_reference && (
            <div className="flex items-start gap-3 rounded-2xl bg-gold-soft/60 p-4">
              <BookMarked className="mt-0.5 size-5 shrink-0 text-gold-ink" />
              <div>
                <p className="text-sm font-bold text-gold-ink">In your textbook</p>
                <p className="text-sm text-ink-2">{ch.textbook_reference}</p>
              </div>
            </div>
          )}
          {ch.learning_objectives.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-lg text-ink"><Target className="size-5 text-maroon" /> You will learn to</h2>
              <ul className="space-y-2">
                {ch.learning_objectives.map((o) => (
                  <li key={o} className="flex gap-2 text-sm text-ink-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {o}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info icon={<ListChecks />} label="Questions" value={String(ch.question_count)} />
            <Info icon={<Target />} label="Pass mark" value={`${ch.pass_percentage}%`} />
            <Info icon={<Zap />} label="Reward" value={`${ch.xp_reward} XP`} />
            <Info icon={<Clock />} label="Time" value={ch.time_limit_minutes ? `${ch.time_limit_minutes} min` : 'No limit'} />
          </div>
          {ch.attempts > 0 && (
            <p className="text-sm text-ink-3">Your best score: <strong className="text-ink">{Math.round(ch.best_percentage)}%</strong> across {ch.attempts} attempt{ch.attempts > 1 ? 's' : ''}.</p>
          )}

          {ch.locked ? (
            <Alert tone="info" icon={<Lock className="size-5" />}>Complete the previous chapter to unlock this test.</Alert>
          ) : ch.question_count === 0 ? (
            <Alert tone="gold">Questions for this chapter are being prepared.</Alert>
          ) : (
            <div className="rounded-2xl border border-line p-4 sm:p-5">
              {!done && (
                <label className="mb-4 flex items-start gap-3 text-sm text-ink-2">
                  <input type="checkbox" checked={readConfirmed} onChange={(e) => setReadConfirmed(e.target.checked)} className="mt-0.5 size-5 accent-[var(--maroon)]" />
                  I have studied this chapter in my printed textbook.
                </label>
              )}
              <Button size="lg" className="w-full" disabled={!done && !readConfirmed} icon={<PlayCircle className="size-5" />} onClick={() => navigate(`/app/learn/${ch.id}/test`)}>
                {done ? 'Practise again' : ch.attempts > 0 ? 'Retake chapter test' : 'Take chapter test'}
              </Button>
              {done && <p className="mt-2 text-center text-xs text-ink-3">Practice attempts never reduce your best score.</p>}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3 text-center">
      <div className="mx-auto mb-1 w-fit text-maroon [&_svg]:size-5">{icon}</div>
      <p className="font-display text-lg text-ink">{value}</p>
      <p className="text-xs text-ink-3">{label}</p>
    </div>
  )
}
