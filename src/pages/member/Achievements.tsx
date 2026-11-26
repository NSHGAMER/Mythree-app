import { Lock } from 'lucide-react'
import { BadgeIcon } from '../../components/BadgeIcon'
import { Card, cx, PageHeader, ProgressBar, SkeletonCards } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { fmtDate, num } from '../../lib/format'
import { LEVELS, levelForXp, TIER_STYLES } from '../../lib/gamification'
import { supabase } from '../../lib/supabase'

interface BadgeRow {
  code: string
  name: string
  name_sanskrit: string | null
  description: string
  icon: string
  tier: string
  xp_bonus: number
  sort_order: number
}

export default function AchievementsPage() {
  useDocumentTitle('Achievements')
  const { profile } = useAuth()
  const { data, loading } = useAsync(async () => {
    const [b, ub] = await Promise.all([
      supabase.from('badges').select('code,name,name_sanskrit,description,icon,tier,xp_bonus,sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('user_badges').select('badge_code, awarded_at'),
    ])
    if (b.error) throw b.error
    return { badges: (b.data ?? []) as BadgeRow[], earned: new Map((ub.data ?? []).map((x) => [x.badge_code as string, x.awarded_at as string])) }
  }, [])
  const lvl = levelForXp(profile?.xp ?? 0)

  return (
    <div>
      <PageHeader title="Achievements" sanskrit="उपलब्धयः" subtitle="Levels and badges celebrate your consistency and progress." />

      <Card className="mb-8 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-3">Level {lvl.level} of {LEVELS.length}</p>
            <p className="font-display text-2xl text-ink">{lvl.name} <span lang="sa" className="sanskrit text-lg text-gold-ink">{lvl.sanskrit}</span></p>
          </div>
          <p className="text-sm font-semibold text-ink-2">{num(lvl.xp)} XP</p>
        </div>
        <ProgressBar value={lvl.progress * 100} tone="gold" size="lg" className="mt-3" label="Level progress" />
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {LEVELS.map((l) => (
            <div key={l.level} className={cx('min-w-28 shrink-0 rounded-xl border p-3 text-center', l.level <= lvl.level ? 'border-gold/50 bg-gold-soft/60' : 'border-line opacity-60')}>
              <p className="text-xs font-bold text-ink-3">Lv {l.level}</p>
              <p lang="sa" className="sanskrit text-sm text-ink">{l.sanskrit}</p>
              <p className="text-[0.7rem] text-ink-3">{num(l.minXp)} XP</p>
            </div>
          ))}
        </div>
      </Card>

      {loading && !data ? (
        <SkeletonCards count={6} className="grid-cols-2 sm:grid-cols-3" />
      ) : (
        <>
          <p className="mb-4 text-sm font-semibold text-ink-2">{data?.earned.size ?? 0} of {data?.badges.length ?? 0} badges earned</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data?.badges.map((b) => {
              const at = data.earned.get(b.code)
              const t = TIER_STYLES[b.tier]
              return (
                <Card key={b.code} className={cx('flex flex-col items-center p-5 text-center transition', !at && 'opacity-70')}>
                  <span className={cx('relative grid size-16 place-items-center rounded-2xl ring-2', at ? `${t.bg} ${t.ring} ${t.text}` : 'bg-surface-3 text-ink-3 ring-line grayscale')}>
                    <BadgeIcon name={b.icon} className="size-8" />
                    {!at && <Lock className="absolute -bottom-1.5 -right-1.5 size-6 rounded-full bg-surface p-1 text-ink-3" />}
                  </span>
                  <p className="mt-3 font-semibold text-ink">{b.name}</p>
                  {b.name_sanskrit && <p lang="sa" className="sanskrit text-sm text-gold-ink">{b.name_sanskrit}</p>}
                  <p className="mt-1 text-xs text-ink-3">{b.description}</p>
                  <p className="mt-2 text-[0.7rem] font-bold uppercase tracking-wider text-ink-3">
                    {t?.label}
                    {b.xp_bonus > 0 && ` · +${b.xp_bonus} XP`}
                  </p>
                  {at && <p className="mt-1 text-[0.7rem] text-success">Earned {fmtDate(at)}</p>}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
