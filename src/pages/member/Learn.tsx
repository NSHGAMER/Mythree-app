import { motion } from 'motion/react'
import { BookOpen, Check, Crown, Lock, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonClass, cx, EmptyState, PageHeader, ProgressBar, SkeletonCards } from '../../components/ui'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'

/** Duolingo-style winding path of chapters. */
export default function LearnPage() {
  useDocumentTitle('Learn')
  const { data, error, loading, reload } = useAsync(() => api.dashboard(), [])

  if (loading && !data) return <SkeletonCards count={4} />
  if (error || !data)
    return (
      <EmptyState title="Couldn't load chapters" action={<button onClick={reload} className={buttonClass('primary')}>Retry</button>}>
        {friendlyError(error)}
      </EmptyState>
    )

  const chapters = data.chapters
  const currentId = data.programme.current_chapter?.id

  return (
    <div>
      <PageHeader
        title="Your learning path"
        sanskrit="अध्ययनमार्गः"
        subtitle="Read each chapter from your printed textbook, then take its test here. Passing a chapter unlocks the next."
      />
      <div className="card mb-8 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ink">{data.programme.completed_chapters} of {data.programme.total_chapters} chapters completed</span>
          <span className="font-bold text-maroon-ink">{Math.round(data.programme.percent)}%</span>
        </div>
        <ProgressBar value={data.programme.percent} className="mt-2" size="lg" label="Programme completion" />
      </div>

      {chapters.length === 0 ? (
        <EmptyState icon={<BookOpen className="size-6" />} title="No chapters yet">
          The organisation is preparing chapters. Please check back soon.
        </EmptyState>
      ) : (
        <div className="relative mx-auto max-w-md py-4">
          {chapters.map((c, i) => {
            const offset = Math.sin(i * 1.1) * 70
            const done = c.status === 'completed'
            const isCurrent = c.id === currentId
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="relative flex flex-col items-center pb-10"
                style={{ transform: `translateX(${offset}px)` }}
              >
                {isCurrent && (
                  <span className="mb-2 animate-float rounded-xl border border-gold/50 bg-surface px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-ink shadow">
                    {c.status === 'in_progress' ? 'Continue' : 'Start here'}
                  </span>
                )}
                <Link
                  to={c.locked ? '#' : `/app/learn/${c.id}`}
                  onClick={(e) => c.locked && e.preventDefault()}
                  aria-disabled={c.locked}
                  aria-label={`Chapter ${c.position}: ${c.title}${done ? ', completed' : c.locked ? ', locked' : ''}`}
                  className={cx(
                    'relative grid size-20 place-items-center rounded-full border-b-[6px] text-2xl font-bold transition active:translate-y-1 active:border-b-2',
                    done && 'border-[#8a6216] bg-gradient-to-b from-[#f1cf7d] to-gold text-[#4a3209]',
                    !done && !c.locked && 'border-[#4a1219] bg-gradient-to-b from-[#a83a48] to-maroon text-white',
                    c.locked && 'cursor-not-allowed border-line-strong bg-surface-3 text-ink-3',
                    isCurrent && 'ring-8 ring-gold/25',
                  )}
                >
                  {done ? c.best_percentage >= 100 ? <Crown className="size-8" /> : <Check className="size-9" strokeWidth={3} /> : c.locked ? <Lock className="size-7" /> : c.position}
                  {done && c.best_percentage >= 100 && <Star className="absolute -right-1 -top-1 size-6 fill-saffron text-saffron" />}
                </Link>
                <div className="mt-2 max-w-[12rem] text-center">
                  <p className={cx('text-sm font-bold', c.locked ? 'text-ink-3' : 'text-ink')}>{c.title}</p>
                  {c.title_sanskrit && <p lang="sa" className="sanskrit text-sm text-ink-3">{c.title_sanskrit}</p>}
                  {c.attempts > 0 && <p className="text-xs text-ink-3">Best {Math.round(c.best_percentage)}% · {c.attempts} attempt{c.attempts > 1 ? 's' : ''}</p>}
                </div>
              </motion.div>
            )
          })}
          <div className="flex flex-col items-center">
            <div className={cx('grid size-24 place-items-center rounded-3xl border-2 border-dashed', data.exam.eligible ? 'border-gold bg-gold-soft text-gold-ink' : 'border-line-strong text-ink-3')}>
              <Crown className="size-10" />
            </div>
            <p className="mt-2 font-display text-lg text-ink">Final Exam</p>
            {data.exam.eligible ? (
              <Link to="/app/final-exam" className={buttonClass('gold', 'sm', 'mt-2')}>I am ready</Link>
            ) : (
              <p className="text-xs text-ink-3">Complete all chapters to unlock</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
