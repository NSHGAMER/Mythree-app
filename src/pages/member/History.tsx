import { CheckCircle2, Swords, Target, XCircle, Zap } from 'lucide-react'
import { useState } from 'react'
import { Card, EmptyState, PageHeader, Pill, SkeletonCards, Tabs } from '../../components/ui'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { fmtDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'

const REASONS: Record<string, string> = {
  chapter_pass: 'Chapter passed',
  chapter_perfect: 'Perfect score bonus',
  chapter_attempt: 'Effort bonus',
  daily_challenge: 'Daily challenge',
  weekly_challenge: 'Weekly challenge',
  badge: 'Badge earned',
}

export default function HistoryPage() {
  useDocumentTitle('Learning history')
  const [tab, setTab] = useState<'tests' | 'xp'>('tests')
  const { data, loading } = useAsync(async () => {
    const [att, xp, ch] = await Promise.all([
      supabase.from('test_attempts').select('id, chapter_id, started_at, submitted_at, score, total, percentage, passed, xp_awarded').not('submitted_at', 'is', null).order('submitted_at', { ascending: false }).limit(200),
      supabase.from('xp_events').select('id, amount, reason, ref_id, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('chapters').select('id, position, title'),
    ])
    const chapters = new Map((ch.data ?? []).map((c) => [c.id as string, c]))
    return { attempts: att.data ?? [], xp: xp.data ?? [], chapters }
  }, [])

  return (
    <div>
      <PageHeader title="Learning history" sanskrit="अध्ययनवृत्तम्" actions={<Tabs value={tab} onChange={setTab} items={[{ value: 'tests', label: 'Tests' }, { value: 'xp', label: 'XP log' }]} />} />
      {loading && !data ? (
        <SkeletonCards count={3} />
      ) : tab === 'tests' ? (
        data!.attempts.length === 0 ? (
          <EmptyState icon={<Target className="size-6" />} title="No tests yet">Your chapter test attempts will appear here.</EmptyState>
        ) : (
          <Card className="divide-y divide-line">
            {data!.attempts.map((a) => {
              const c = data!.chapters.get(a.chapter_id)
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  {a.passed ? <CheckCircle2 className="size-6 text-success" /> : <XCircle className="size-6 text-danger" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">Chapter {c?.position}: {c?.title}</p>
                    <p className="text-xs text-ink-3">{fmtDateTime(a.submitted_at)}</p>
                  </div>
                  <Pill tone={a.passed ? 'success' : 'neutral'}>{a.score}/{a.total} · {Math.round(Number(a.percentage))}%</Pill>
                  {a.xp_awarded > 0 && <Pill tone="gold"><Zap className="size-3" />+{a.xp_awarded}</Pill>}
                </div>
              )
            })}
          </Card>
        )
      ) : data!.xp.length === 0 ? (
        <EmptyState icon={<Zap className="size-6" />} title="No XP yet">Earn XP by passing chapters and completing challenges.</EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {data!.xp.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-9 place-items-center rounded-xl bg-gold-soft text-gold-ink">
                {e.reason.includes('weekly') ? <Swords className="size-4" /> : e.reason.includes('daily') ? <Target className="size-4" /> : <Zap className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{REASONS[e.reason] ?? e.reason}</p>
                <p className="text-xs text-ink-3">{fmtDateTime(e.created_at)}</p>
              </div>
              <span className="font-bold text-gold-ink">+{e.amount}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
