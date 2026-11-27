import { motion } from 'motion/react'
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Flame,
  HandHeart,
  Lock,
  MapPin,
  ScrollText,
  Smartphone,
  Swords,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { BadgeIcon } from '../../components/BadgeIcon'
import { Alert, buttonClass, Card, cx, EmptyState, ProgressBar, ProgressRing, SkeletonCards, StatCard } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { fmtDate, num } from '../../lib/format'
import { levelForXp, TIER_STYLES } from '../../lib/gamification'
import { programmeStatus } from '../../lib/programme'

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()))
  if (h < 12) return { sa: 'सुप्रभातम्', en: 'Good morning' }
  if (h < 17) return { sa: 'नमो नमः', en: 'Good afternoon' }
  return { sa: 'शुभसन्ध्या', en: 'Good evening' }
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { profile } = useAuth()
  const { data: d, error, loading, reload } = useAsync(() => api.dashboard(), [])
  const g = greeting()

  if (loading && !d) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-56 w-full rounded-3xl" />
        <SkeletonCards count={4} className="grid-cols-2 lg:grid-cols-4" />
      </div>
    )
  }
  if (error || !d) {
    return (
      <EmptyState title="We couldn't load your dashboard" action={<button onClick={reload} className={buttonClass('primary')}>Try again</button>}>
        {friendlyError(error)}
      </EmptyState>
    )
  }

  const p = d.programme
  const status = programmeStatus({ startDate: p.start_date, targetDays: p.target_days, completed: p.completed_chapters, total: p.total_chapters })
  const lvl = levelForXp(d.profile.xp)
  const current = p.current_chapter
  const firstName = (profile?.full_name ?? d.profile.full_name).split(' ')[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p lang="sa" className="sanskrit text-lg text-gold-ink">{g.sa}</p>
          <h1 className="text-3xl text-ink sm:text-4xl">
            {g.en}, {firstName}
          </h1>
        </div>
        <div className="text-right text-sm text-ink-3">
          {profile?.member_uid && (
            <p>
              Member ID <span className="ml-1 rounded-lg bg-maroon-soft px-2 py-0.5 font-mono font-bold text-maroon-ink">{profile.member_uid}</span>
            </p>
          )}
          <p className="mt-1">Learning since {fmtDate(p.start_date)}</p>
        </div>
      </div>

      {!d.profile.has_address && (
        <Alert tone="gold" icon={<MapPin className="size-5" />} title="Add your postal address">
          We need your full address to post your textbook and final exam paper.{' '}
          <Link to="/app/settings" className="font-semibold underline">Update address</Link>
        </Alert>
      )}
      {!d.profile.phone_verified && d.settings.require_phone_verification && (
        <Alert tone="info" icon={<Smartphone className="size-5" />} title="Verify your mobile number">
          <Link to="/verify-phone" className="font-semibold underline">Verify now</Link> to secure your account.
        </Alert>
      )}

      {/* ------------------------------------------------ Programme hero */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#7a1f2b] via-[#5e1720] to-[#3a0f14] p-6 text-white shadow-[var(--shadow-lift)] sm:p-8">
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-[#e0b24c]/20 blur-3xl" aria-hidden />
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'repeating-conic-gradient(from 0deg at 85% 15%, #fff 0deg 3deg, transparent 3deg 10deg)' }} aria-hidden />
          <div className="relative grid items-center gap-6 md:grid-cols-[auto_1fr]">
            <div className="mx-auto">
              <ProgressRing value={p.percent} size={148} stroke={12} tone="gold">
                <div>
                  <p className="font-display text-4xl">{Math.round(p.percent)}%</p>
                  <p className="text-xs text-white/70">complete</p>
                </div>
              </ProgressRing>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f1cf7d]">
                Day {status.dayNumber} {status.beyondTarget ? `· target was ${p.target_days} days` : `of ${p.target_days}`}
              </p>
              <h2 className="mt-1 text-2xl sm:text-3xl">
                {p.total_chapters === 0 ? 'Chapters are being prepared' : current ? `Chapter ${current.position}: ${current.title}` : 'All chapters completed!'}
              </h2>
              {current?.title_sanskrit && <p lang="sa" className="sanskrit mt-0.5 text-lg text-[#f6dc9c]">{current.title_sanskrit}</p>}
              <p className="mt-2 max-w-xl text-sm text-white/75">{status.message}</p>
              <div className="mt-4 grid max-w-lg grid-cols-3 gap-3 text-center">
                <HeroStat label="Completed" value={p.completed_chapters} />
                <HeroStat label="Remaining" value={p.remaining_chapters} />
                <HeroStat label="Total" value={p.total_chapters} />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {current ? (
                  <Link to={`/app/learn/${current.id}`} className={buttonClass('gold', 'md')}>
                    {current.status === 'in_progress' ? 'Continue chapter' : 'Start chapter'} <ArrowRight className="size-4" />
                  </Link>
                ) : d.exam.eligible ? (
                  <Link to="/app/final-exam" className={buttonClass('gold', 'md')}>
                    <ScrollText className="size-4" /> Final exam readiness
                  </Link>
                ) : null}
                <Link to="/app/learn" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10">
                  <BookOpen className="size-4" /> All chapters
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ------------------------------------------------ Final exam CTA */}
      {d.exam.eligible && !d.exam.request && (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-gold/50 bg-gold-soft/40 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-gold text-[#2e1d12]"><ScrollText className="size-6" /></span>
            <div>
              <p className="font-display text-xl text-ink">You have completed every chapter!</p>
              <p className="text-sm text-ink-3">Tell us you are ready and we will post your final exam paper.</p>
            </div>
          </div>
          <Link to="/app/final-exam" className={buttonClass('primary', 'md')}>Yes, I am ready to take the Final Exam</Link>
        </Card>
      )}
      {d.exam.request && (
        <Alert tone="success" icon={<CheckCircle2 className="size-5" />} title="Final exam requested">
          Requested on {fmtDate(d.exam.request.requested_at)} after {d.exam.request.days_taken} days. <Link to="/app/final-exam" className="font-semibold underline">Track dispatch</Link>
        </Alert>
      )}

      {/* ------------------------------------------------ Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={<Zap className="size-5" />} tone="gold" label="Total XP" value={num(d.profile.xp)} sub={`${num(d.weekly_xp)} this week`} />
        <StatCard icon={<Flame className="size-5" />} tone="saffron" label="Streak" value={`${d.profile.current_streak} day${d.profile.current_streak === 1 ? '' : 's'}`} sub={`Best: ${d.profile.longest_streak}`} />
        <StatCard icon={<Trophy className="size-5" />} tone="maroon" label="Rank" value={`#${d.rank}`} sub="All-time leaderboard" />
        <StatCard icon={<Award className="size-5" />} tone="success" label="Badges" value={`${d.badges_earned}/${d.badges_total}`} sub="Achievements" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ------------------------------------------------ Challenges */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ChallengeCard
              kind="daily"
              title="Daily challenge"
              sanskrit="दैनिकाभ्यासः"
              done={!!d.daily?.submitted}
              detail={d.daily?.submitted ? `${d.daily.score}/${d.daily.total} correct · +${d.daily.xp_awarded} XP` : 'A few quick questions · up to 30 XP'}
            />
            <ChallengeCard
              kind="weekly"
              title="Weekly challenge"
              sanskrit="साप्ताहिकपरीक्षा"
              done={!!d.weekly?.submitted}
              detail={d.weekly?.submitted ? `${d.weekly.score}/${d.weekly.total} · ${d.weekly.passed ? 'passed' : 'not passed'} · +${d.weekly.xp_awarded} XP` : 'Pass to earn 100+ XP'}
            />
          </div>

          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl text-ink">Your path</h3>
              <Link to="/app/learn" className="text-sm font-semibold text-maroon-ink hover:underline">View all</Link>
            </div>
            {d.chapters.length === 0 ? (
              <p className="text-sm text-ink-3">Chapters will appear here once the organisation publishes them.</p>
            ) : (
              <ol className="space-y-2">
                {d.chapters
                  .filter((c) => c.status !== 'completed')
                  .slice(0, 4)
                  .concat(d.chapters.filter((c) => c.status !== 'completed').length === 0 ? d.chapters.slice(-3) : [])
                  .map((c) => (
                    <li key={c.id}>
                      <Link to={c.locked ? '#' : `/app/learn/${c.id}`} className={cx('flex items-center gap-3 rounded-xl p-2.5 transition', c.locked ? 'cursor-not-allowed opacity-60' : 'hover:bg-surface-2')} aria-disabled={c.locked}>
                        <span className={cx('grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold', c.status === 'completed' ? 'bg-success-soft text-success' : c.locked ? 'bg-surface-3 text-ink-3' : 'bg-maroon text-on-primary')}>
                          {c.status === 'completed' ? <CheckCircle2 className="size-5" /> : c.locked ? <Lock className="size-4" /> : c.position}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-ink">{c.title}</span>
                          {c.title_sanskrit && <span lang="sa" className="sanskrit block truncate text-sm text-ink-3">{c.title_sanskrit}</span>}
                        </span>
                        {c.best_percentage > 0 && <span className="text-xs font-semibold text-ink-3">Best {Math.round(c.best_percentage)}%</span>}
                      </Link>
                    </li>
                  ))}
              </ol>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------ Right column */}
        <div className="space-y-4">
          <Card className="p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-3">Level {lvl.level}</p>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="font-display text-2xl text-ink">{lvl.name}</p>
              <p lang="sa" className="sanskrit text-gold-ink">{lvl.sanskrit}</p>
            </div>
            <ProgressBar value={lvl.progress * 100} tone="gold" className="mt-3" label="Level progress" />
            <p className="mt-2 text-xs text-ink-3">{lvl.next ? `${num(lvl.xpForNext)} XP to ${lvl.next.name}` : 'You have reached the highest level'}</p>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="size-6 text-maroon" />
              <h3 className="text-lg text-ink">Programme timeline</h3>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-ink-3">Start date</dt><dd className="font-semibold text-ink">{fmtDate(p.start_date)}</dd></div>
              <div><dt className="text-ink-3">Days elapsed</dt><dd className="font-semibold text-ink">{status.dayNumber}</dd></div>
              <div><dt className="text-ink-3">Target</dt><dd className="font-semibold text-ink">{p.target_days} days</dd></div>
              <div><dt className="text-ink-3">Pace</dt><dd className="font-semibold capitalize text-ink">{status.pace.replace('_', ' ')}</dd></div>
            </dl>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-ink-3"><span>Time</span><span>{Math.round(status.timeProgress * 100)}%</span></div>
              <ProgressBar value={status.timeProgress * 100} tone="gold" size="sm" label="Time elapsed" />
              <div className="mb-1 mt-3 flex justify-between text-xs text-ink-3"><span>Chapters</span><span>{Math.round(p.percent)}%</span></div>
              <ProgressBar value={p.percent} size="sm" label="Chapters completed" />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg text-ink">Recent badges</h3>
              <Link to="/app/achievements" className="text-sm font-semibold text-maroon-ink hover:underline">All</Link>
            </div>
            {d.recent_badges.length === 0 ? (
              <p className="text-sm text-ink-3">Complete your first chapter to earn your first badge.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {d.recent_badges.map((b) => (
                  <div key={b.code} className="flex flex-col items-center gap-1 text-center" title={b.name}>
                    <span className={cx('grid size-12 place-items-center rounded-2xl ring-2', TIER_STYLES[b.tier]?.bg, TIER_STYLES[b.tier]?.ring, TIER_STYLES[b.tier]?.text)}>
                      <BadgeIcon name={b.icon} className="size-6" />
                    </span>
                    <span className="line-clamp-2 text-[0.7rem] font-semibold text-ink-2">{b.name}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="border-gold/40 p-5">
            <div className="flex items-start gap-3">
              <HandHeart className="mt-0.5 size-6 shrink-0 text-gold" />
              <div>
                <p className="font-semibold text-ink">Guru Dakshina</p>
                <p className="mt-0.5 text-sm text-ink-3">
                  {d.contributed_paise > 0 ? 'Thank you for your Guru Dakshina. 🙏' : `Voluntary · suggested ₹${d.settings.suggested_contribution}. Optional and separate from the registration fee.`}
                </p>
                <Link to="/app/guru-dakshina" className="mt-2 inline-block text-sm font-semibold text-gold-ink hover:underline">Open Guru Dakshina →</Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-2 py-2.5">
      <p className="font-display text-2xl">{value}</p>
      <p className="text-[0.7rem] uppercase tracking-wider text-white/65">{label}</p>
    </div>
  )
}

function ChallengeCard({ kind, title, sanskrit, done, detail }: { kind: 'daily' | 'weekly'; title: string; sanskrit: string; done: boolean; detail: string }) {
  return (
    <Link to={`/app/challenges/${kind}`} className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between">
        <span className={cx('grid size-11 place-items-center rounded-xl', kind === 'daily' ? 'bg-saffron-soft text-saffron' : 'bg-maroon-soft text-maroon-ink')}>
          {kind === 'daily' ? <Target className="size-5" /> : <Swords className="size-5" />}
        </span>
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success"><CheckCircle2 className="size-3.5" /> Done</span>
        ) : (
          <span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-gold-ink">{kind === 'daily' ? 'Today' : 'This week'}</span>
        )}
      </div>
      <p className="mt-3 font-display text-lg text-ink">{title}</p>
      <p lang="sa" className="sanskrit text-sm text-ink-3">{sanskrit}</p>
      <p className="mt-2 text-sm text-ink-2">{detail}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-maroon-ink">
        {done ? 'Review' : 'Start'} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
