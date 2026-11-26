import { CalendarCheck, CheckCircle2, Flame, Swords, Target, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonClass, Card, cx, PageHeader, SkeletonCards } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { supabase } from '../../lib/supabase'

function last7Days() {
  const out: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    out.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d))
  }
  return out
}

export default function ChallengesPage() {
  useDocumentTitle('Challenges')
  const { settings } = useApp()
  const { data: dash, loading } = useAsync(() => api.dashboard(), [])
  const { data: recent } = useAsync(async () => {
    const { data } = await supabase.from('challenge_instances').select('kind, period_key, submitted_at, score, total, passed, xp_awarded').order('created_at', { ascending: false }).limit(30)
    return data ?? []
  }, [])
  const days = last7Days()
  const doneDays = new Set((recent ?? []).filter((r) => r.kind === 'daily' && r.submitted_at).map((r) => r.period_key))

  if (loading && !dash) return <SkeletonCards count={2} />

  return (
    <div>
      <PageHeader title="Challenges" sanskrit="अभ्यासः" subtitle="Short, regular practice is the secret to remembering. Challenges draw questions from chapters you have reached." />

      <Card className="mb-6 p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-semibold text-ink"><Flame className="size-5 text-saffron" /> This week</p>
          <p className="text-sm text-ink-3">{dash?.profile.current_streak ?? 0}-day streak</p>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {days.map((d) => {
            const done = doneDays.has(d)
            const label = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(`${d}T12:00:00+05:30`))
            return (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <span className={cx('grid size-10 place-items-center rounded-full', done ? 'bg-gradient-to-b from-saffron to-[#c96d0f] text-white' : 'bg-surface-3 text-ink-3')}>
                  {done ? <Flame className="size-5" /> : <span className="size-2 rounded-full bg-current opacity-40" />}
                </span>
                <span className="text-xs text-ink-3">{label}</span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col p-6">
          <span className="grid size-14 place-items-center rounded-2xl bg-saffron-soft text-saffron"><Target className="size-7" /></span>
          <h2 className="mt-4 text-2xl text-ink">Daily challenge</h2>
          <p lang="sa" className="sanskrit text-ink-3">दैनिकाभ्यासः</p>
          <p className="mt-3 flex-1 text-sm text-ink-2">{settings?.daily_question_count ?? 5} questions · resets at midnight IST · earn 10 XP + 4 XP per correct answer.</p>
          {dash?.daily?.submitted ? (
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-success-soft p-4">
              <span className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="size-5" /> {dash.daily.score}/{dash.daily.total} today</span>
              <Link to="/app/challenges/daily" className="text-sm font-semibold text-success underline">Review</Link>
            </div>
          ) : (
            <Link to="/app/challenges/daily" className={buttonClass('primary', 'lg', 'mt-5')}>Start today's challenge</Link>
          )}
        </Card>
        <Card className="flex flex-col p-6">
          <span className="grid size-14 place-items-center rounded-2xl bg-maroon-soft text-maroon-ink"><Swords className="size-7" /></span>
          <h2 className="mt-4 text-2xl text-ink">Weekly challenge</h2>
          <p lang="sa" className="sanskrit text-ink-3">साप्ताहिकपरीक्षा</p>
          <p className="mt-3 flex-1 text-sm text-ink-2">
            {settings?.weekly_question_count ?? 10} questions · resets every Monday · pass with {settings?.weekly_pass_percentage ?? 60}% for 100+ XP (20 XP for taking part).
          </p>
          {dash?.weekly?.submitted ? (
            <div className={cx('mt-5 flex items-center justify-between rounded-2xl p-4', dash.weekly.passed ? 'bg-success-soft text-success' : 'bg-surface-2 text-ink-2')}>
              <span className="flex items-center gap-2 font-semibold">{dash.weekly.passed ? <CheckCircle2 className="size-5" /> : <Zap className="size-5" />} {dash.weekly.score}/{dash.weekly.total} this week</span>
              <Link to="/app/challenges/weekly" className="text-sm font-semibold underline">Review</Link>
            </div>
          ) : (
            <Link to="/app/challenges/weekly" className={buttonClass('primary', 'lg', 'mt-5')}>Start weekly challenge</Link>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-10 flex items-center gap-2 text-xl text-ink"><CalendarCheck className="size-5 text-maroon" /> Recent challenges</h2>
      <Card className="divide-y divide-line">
        {(recent ?? []).filter((r) => r.submitted_at).length === 0 ? (
          <p className="p-5 text-sm text-ink-3">No challenges completed yet.</p>
        ) : (
          (recent ?? [])
            .filter((r) => r.submitted_at)
            .slice(0, 12)
            .map((r) => (
              <div key={`${r.kind}-${r.period_key}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="flex items-center gap-2 font-semibold capitalize text-ink">
                  {r.kind === 'daily' ? <Target className="size-4 text-saffron" /> : <Swords className="size-4 text-maroon" />} {r.kind} · {r.period_key}
                </span>
                <span className="text-ink-3">{r.score}/{r.total} · <span className="font-semibold text-gold-ink">+{r.xp_awarded} XP</span></span>
              </div>
            ))
        )}
      </Card>
    </div>
  )
}
