import { Activity, BookOpenCheck, GraduationCap, HandHeart, MessageCircleQuestion, ScrollText, UserPlus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buttonClass, Card, EmptyState, PageHeader, SkeletonCards, StatCard } from '../../components/ui'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { inr, num } from '../../lib/format'

interface Analytics {
  members: number
  new_this_week: number
  active_7d: number
  active_today: number
  total_chapters: number
  completed_programme: number
  exam_requests: Record<string, number> | null
  contributions_total_paise: number
  contributors: number
  tests_submitted: number
  avg_test_score: number | null
  registrations_by_week: { week: string; count: number }[]
  activity_by_day: { day: string; active: number; xp: number }[]
  chapter_stats: { position: number; title: string; completed: number; attempts: number; avg_score: number | null; pass_rate: number | null }[]
  progress_distribution: { bucket: number; count: number }[]
  unread_notifications: number
  unanswered_questions_7d: number
}

const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 13 },
  labelStyle: { color: 'var(--ink-3)' },
}
const axis = { stroke: 'var(--ink-3)', fontSize: 12, tickLine: false, axisLine: false }

export default function AdminOverview() {
  useDocumentTitle('Admin overview')
  const { data, error, loading, reload } = useAsync(() => api.admin.analytics() as Promise<unknown> as Promise<Analytics>, [])

  if (loading && !data) return <SkeletonCards count={4} className="grid-cols-2 lg:grid-cols-4" />
  if (error || !data) return <EmptyState title="Couldn't load analytics" action={<button className={buttonClass('primary')} onClick={reload}>Retry</button>}>{friendlyError(error)}</EmptyState>

  const exams = data.exam_requests ?? {}
  const pendingExams = (exams.requested ?? 0) + (exams.approved ?? 0)
  const buckets = ['0–24%', '25–49%', '50–74%', '75–99%', '100%']
  const dist = buckets.map((label, i) => ({ label, count: data.progress_distribution.find((d) => d.bucket === i)?.count ?? 0 }))

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="Programme health at a glance." actions={<Link to="/admin/members" className={buttonClass('primary', 'sm')}><Users className="size-4" /> Member table</Link>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={<Users className="size-5" />} label="Members" value={num(data.members)} sub={`+${data.new_this_week} this week`} />
        <StatCard icon={<Activity className="size-5" />} tone="saffron" label="Active (7 days)" value={num(data.active_7d)} sub={`${data.active_today} learned today`} />
        <StatCard icon={<GraduationCap className="size-5" />} tone="success" label="Completed programme" value={num(data.completed_programme)} sub={`${data.total_chapters} chapters published`} />
        <StatCard icon={<HandHeart className="size-5" />} tone="gold" label="Guru Dakshina" value={inr(data.contributions_total_paise)} sub={`${data.contributors} contributors`} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={<BookOpenCheck className="size-5" />} tone="info" label="Tests submitted" value={num(data.tests_submitted)} sub={`Average ${data.avg_test_score ?? 0}%`} />
        <Link to="/admin/exams"><StatCard icon={<ScrollText className="size-5" />} tone="maroon" label="Exam requests pending" value={num(pendingExams)} sub={`${exams.paper_dispatched ?? 0} dispatched`} /></Link>
        <Link to="/admin/notifications"><StatCard icon={<UserPlus className="size-5" />} tone="gold" label="Unread notifications" value={num(data.unread_notifications)} /></Link>
        <Link to="/admin/faqs"><StatCard icon={<MessageCircleQuestion className="size-5" />} tone="saffron" label="Unanswered chatbot Qs" value={num(data.unanswered_questions_7d)} sub="Last 7 days" /></Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-lg text-ink">Daily active learners (30 days)</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={data.activity_by_day}>
                <defs>
                  <linearGradient id="ga" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--maroon)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--maroon)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" {...axis} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis {...axis} allowDecimals={false} width={32} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="active" name="Active learners" stroke="var(--maroon)" strokeWidth={2.5} fill="url(#ga)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-lg text-ink">New registrations per week</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.registrations_by_week}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week" {...axis} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis {...axis} allowDecimals={false} width={32} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="count" name="Registrations" fill="var(--gold)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-lg text-ink">Member progress distribution</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={dist}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} allowDecimals={false} width={32} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="count" name="Members" radius={[8, 8, 0, 0]}>
                  {dist.map((_, i) => (
                    <Cell key={i} fill={['var(--border-strong)', 'var(--saffron)', 'var(--gold)', 'var(--maroon)', 'var(--success)'][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-lg text-ink">Chapter pass rates</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.chapter_stats} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} {...axis} unit="%" />
                <YAxis type="category" dataKey="position" {...axis} width={28} tickFormatter={(v: number) => `Ch ${v}`} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [`${v ?? 0}%`, 'Pass rate']} labelFormatter={(l) => data.chapter_stats.find((c) => c.position === l)?.title ?? l} />
                <Bar dataKey="pass_rate" name="Pass rate" fill="var(--maroon)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-ink-3">
            <tr>
              <th className="px-4 py-3">Chapter</th>
              <th className="px-4 py-3 text-right">Completed by</th>
              <th className="px-4 py-3 text-right">Attempts</th>
              <th className="px-4 py-3 text-right">Avg score</th>
              <th className="px-4 py-3 text-right">Pass rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.chapter_stats.map((c) => (
              <tr key={c.position}>
                <td className="px-4 py-3 font-medium text-ink">{c.position}. {c.title}</td>
                <td className="px-4 py-3 text-right">{num(c.completed)}</td>
                <td className="px-4 py-3 text-right">{num(c.attempts)}</td>
                <td className="px-4 py-3 text-right">{c.avg_score ?? '—'}{c.avg_score !== null && '%'}</td>
                <td className="px-4 py-3 text-right">{c.pass_rate ?? '—'}{c.pass_rate !== null && '%'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
