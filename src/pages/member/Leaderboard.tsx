import { motion } from 'motion/react'
import { Crown, EyeOff, Flame, Medal, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, cx, EmptyState, PageHeader, SkeletonCards, Tabs } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { initials, num } from '../../lib/format'
import type { LeaderboardRow } from '../../types'

const AVATAR_COLORS = ['from-maroon to-[#b4424f]', 'from-gold to-saffron', 'from-[#2f5d8a] to-[#5b8fc0]', 'from-success to-[#4fa772]', 'from-[#6b4a8a] to-[#9a77bb]', 'from-brown to-[#8f6a4a]']
const colorFor = (seed: string) => AVATAR_COLORS[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]

export default function LeaderboardPage() {
  useDocumentTitle('Leaderboard')
  const { profile } = useAuth()
  const [period, setPeriod] = useState<'week' | 'all'>('week')
  const { data, error, loading } = useAsync(() => api.leaderboard(period), [period])
  const rows = data?.rows ?? []
  const podium = rows.slice(0, 3)

  return (
    <div>
      <PageHeader title="Leaderboard" sanskrit="श्रेणीपटलम्" subtitle="Friendly encouragement. Only first names and initials are shown." actions={<Tabs value={period} onChange={setPeriod} items={[{ value: 'week', label: 'This week' }, { value: 'all', label: 'All time' }]} />} />
      {profile && !profile.show_on_leaderboard && (
        <p className="mb-4 flex items-center gap-2 text-sm text-ink-3"><EyeOff className="size-4" /> You are hidden from others. <Link className="font-semibold text-maroon-ink underline" to="/app/settings">Change</Link></p>
      )}
      {loading && !data ? (
        <SkeletonCards count={3} />
      ) : error ? (
        <EmptyState title="Couldn't load the leaderboard">{friendlyError(error)}</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Trophy className="size-6" />} title="No rankings yet">Be the first to earn XP {period === 'week' ? 'this week' : ''}!</EmptyState>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-3 items-end gap-3 sm:gap-6">
            {[podium[1], podium[0], podium[2]].map((r, i) =>
              r ? (
                <motion.div key={`${period}-${r.rank}-${r.name}`} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }} className="flex flex-col items-center text-center">
                  {r.rank === 1 && <Crown className="mb-1 size-7 fill-gold text-gold" />}
                  <Avatar row={r} size={r.rank === 1 ? 'lg' : 'md'} />
                  <p className="mt-2 max-w-full truncate text-sm font-bold text-ink">{r.name}</p>
                  <p className="text-xs font-semibold text-gold-ink">{num(r.score)} XP</p>
                  <div className={cx('mt-2 w-full rounded-t-2xl bg-gradient-to-b font-display text-2xl text-white', r.rank === 1 ? 'h-28 from-gold to-[#a77a1d]' : r.rank === 2 ? 'h-20 from-[#a9b1ba] to-[#7d8690]' : 'h-14 from-[#c08552] to-[#8a5a30]')}>
                    <span className="block pt-2">{r.rank}</span>
                  </div>
                </motion.div>
              ) : (
                <div key={i} />
              ),
            )}
          </div>
          <Card className="divide-y divide-line overflow-hidden">
            {rows.map((r) => (
              <div key={`${r.rank}-${r.name}-${r.avatar_seed}`} className={cx('flex items-center gap-3 px-4 py-3 sm:px-5', r.is_me && 'bg-gold-soft/60')}>
                <span className="w-8 text-center font-display text-lg text-ink-3">{r.rank <= 3 ? <Medal className={cx('mx-auto size-5', r.rank === 1 ? 'text-gold' : r.rank === 2 ? 'text-[#8d969f]' : 'text-[#b0773f]')} /> : r.rank}</span>
                <Avatar row={r} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                  {r.name} {r.is_me && <span className="ml-1 rounded-full bg-maroon px-2 py-0.5 text-[0.65rem] font-bold text-on-primary">YOU</span>}
                </span>
                {r.streak > 0 && <span className="hidden items-center gap-1 text-xs font-semibold text-saffron sm:flex"><Flame className="size-3.5" />{r.streak}</span>}
                <span className="font-bold text-ink">{num(r.score)} <span className="text-xs font-semibold text-ink-3">XP</span></span>
              </div>
            ))}
          </Card>
          {data?.me && !rows.some((r) => r.is_me) && (
            <Card className="mt-4 flex items-center justify-between bg-gold-soft/60 px-5 py-4">
              <span className="font-semibold text-ink">Your position</span>
              <span className="font-bold text-ink">#{data.me.rank} · {num(data.me.score)} XP</span>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Avatar({ row, size }: { row: LeaderboardRow; size: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'size-10 text-sm', md: 'size-14 text-lg', lg: 'size-20 text-2xl ring-4 ring-gold/40' }[size]
  return <span className={cx('grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white', s, colorFor(row.avatar_seed))}>{initials(row.name)}</span>
}
