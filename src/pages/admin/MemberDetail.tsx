import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Flame, Mail, MapPin, Phone, ShieldCheck, Trophy, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeIcon } from '../../components/BadgeIcon'
import { Button, Card, cx, EmptyState, Modal, PageHeader, Pill, ProgressBar, SkeletonCards, StatCard, Tabs } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { EXAM_STATUS_LABEL, fmtDate, fmtDateTime, inr, num } from '../../lib/format'
import { TIER_STYLES } from '../../lib/gamification'

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminMemberDetail() {
  const { id } = useParams()
  const { toast } = useApp()
  const { data, error, loading, reload } = useAsync(() => api.admin.member(id!) as Promise<any>, [id])
  const [tab, setTab] = useState<'chapters' | 'tests' | 'challenges' | 'badges' | 'payments'>('chapters')
  const [roleOpen, setRoleOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  useDocumentTitle(data?.profile?.full_name ?? 'Member')

  if (loading && !data) return <SkeletonCards count={3} />
  if (error || !data) return <EmptyState title="Member not found">{friendlyError(error)}</EmptyState>

  const p = data.profile
  const chapters: any[] = data.chapters
  const done = chapters.filter((c) => c.status === 'completed').length
  const pct = chapters.length ? (done / chapters.length) * 100 : 0

  async function changeRole() {
    setBusy(true)
    try {
      await api.admin.setRole(p.id, p.role === 'admin' ? 'member' : 'admin')
      toast('Role updated')
      setRoleOpen(false)
      reload()
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/members" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-ink"><ArrowLeft className="size-4" /> Members</Link>
      <PageHeader
        title={p.full_name}
        subtitle={`Registered ${fmtDate(p.created_at)} · Programme day ${p.days_since_start}`}
        actions={
          <>
            <Pill tone={p.role === 'admin' ? 'maroon' : 'neutral'}>{p.role}</Pill>
            <Button size="sm" variant="outline" icon={<ShieldCheck className="size-4" />} onClick={() => setRoleOpen(true)}>{p.role === 'admin' ? 'Remove admin' : 'Make admin'}</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card className="space-y-4 p-5">
          <Info icon={<Mail />} label="Email">{p.email} {p.email_verified ? <Pill tone="success">verified</Pill> : <Pill tone="danger">unverified</Pill>}</Info>
          <Info icon={<Phone />} label="Mobile">{p.phone ?? '—'} {p.phone_verified_at ? <Pill tone="success">verified</Pill> : <Pill tone="neutral">unverified</Pill>}</Info>
          <Info icon={<MapPin />} label="Residential address">
            {p.address_line1 ? `${p.address_line1}${p.address_line2 ? ', ' + p.address_line2 : ''}, ${p.city}, ${p.state} – ${p.pincode}` : '—'}
          </Info>
          <Info icon={<CalendarDays />} label="Age / start date">{p.age ?? '—'} yrs · started {fmtDate(p.programme_start_date)}</Info>
          <Info icon={<Clock />} label="Last sign in">{fmtDateTime(p.last_sign_in_at)}</Info>
          <div className="rounded-2xl bg-surface-2 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Final exam</p>
            {data.exam ? (
              <>
                <p className="mt-1 font-semibold text-ink">{EXAM_STATUS_LABEL[data.exam.status]}</p>
                <p className="text-sm text-ink-3">Requested {fmtDate(data.exam.requested_at)} · {data.exam.days_taken} days taken</p>
                <Link to="/admin/exams" className="mt-2 inline-block text-sm font-semibold text-maroon-ink hover:underline">Manage dispatch →</Link>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-2">
                Not requested · {data.eligibility.chapters_completed}/{data.eligibility.chapters_total} chapters
                {data.eligibility.eligible && <span className="ml-1 font-semibold text-success">(eligible)</span>}
              </p>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={<Zap className="size-5" />} tone="gold" label="XP" value={num(p.xp)} />
            <StatCard icon={<Flame className="size-5" />} tone="saffron" label="Streak" value={p.effective_streak} sub={`Best ${p.longest_streak}`} />
            <StatCard icon={<Clock className="size-5" />} tone="info" label="Test time" value={`${data.learning_minutes}m`} sub={`${data.active_days} active days`} />
            <StatCard icon={<Trophy className="size-5" />} tone="success" label="Badges" value={data.badges.length} />
          </div>
          <Card className="p-5">
            <div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-ink">Chapters completed</span><span className="text-ink-2">{done}/{chapters.length}</span></div>
            <ProgressBar value={pct} size="lg" label="Chapters completed" />
          </Card>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} className="max-w-full overflow-x-auto" items={[
        { value: 'chapters', label: 'Chapters' },
        { value: 'tests', label: `Tests (${data.attempts.length})` },
        { value: 'challenges', label: `Challenges (${data.challenges.length})` },
        { value: 'badges', label: 'Badges' },
        { value: 'payments', label: 'Guru Dakshina' },
      ]} />

      <Card className="overflow-x-auto">
        {tab === 'chapters' && (
          <Table head={['Chapter', 'Status', 'Best score', 'Attempts', 'Started', 'Completed']}>
            {chapters.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-ink">{c.position}. {c.title}</td>
                <td className="px-4 py-3"><Pill tone={c.status === 'completed' ? 'success' : c.status === 'in_progress' ? 'gold' : 'neutral'}>{c.status.replace('_', ' ')}</Pill></td>
                <td className="px-4 py-3">{Math.round(c.best_percentage)}% <span className="text-xs text-ink-3">(pass {c.pass_percentage}%)</span></td>
                <td className="px-4 py-3">{c.attempts}</td>
                <td className="px-4 py-3">{fmtDate(c.started_at)}</td>
                <td className="px-4 py-3">{c.completed_at ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="size-4" />{fmtDate(c.completed_at)}</span> : '—'}</td>
              </tr>
            ))}
          </Table>
        )}
        {tab === 'tests' && (
          <Table head={['Chapter', 'Submitted', 'Score', 'Result', 'XP']}>
            {data.attempts.map((a: any) => (
              <tr key={a.id}>
                <td className="px-4 py-3 text-ink">{a.position}. {a.chapter}</td>
                <td className="px-4 py-3">{a.submitted_at ? fmtDateTime(a.submitted_at) : <span className="text-ink-3">In progress</span>}</td>
                <td className="px-4 py-3">{a.score !== null ? `${a.score}/${a.total} (${Math.round(a.percentage)}%)` : '—'}</td>
                <td className="px-4 py-3">{a.passed === null ? '—' : <Pill tone={a.passed ? 'success' : 'danger'}>{a.passed ? 'Passed' : 'Not passed'}</Pill>}</td>
                <td className="px-4 py-3">+{a.xp_awarded}</td>
              </tr>
            ))}
          </Table>
        )}
        {tab === 'challenges' && (
          <Table head={['Type', 'Period', 'Submitted', 'Score', 'Result', 'XP']}>
            {data.challenges.map((c: any) => (
              <tr key={`${c.kind}-${c.period_key}`}>
                <td className="px-4 py-3 capitalize">{c.kind}</td>
                <td className="px-4 py-3">{c.period_key}</td>
                <td className="px-4 py-3">{c.submitted_at ? fmtDateTime(c.submitted_at) : <span className="text-ink-3">Not submitted</span>}</td>
                <td className="px-4 py-3">{c.score !== null ? `${c.score}/${c.total}` : '—'}</td>
                <td className="px-4 py-3">{c.passed === null ? '—' : c.passed ? 'Passed' : 'Not passed'}</td>
                <td className="px-4 py-3">+{c.xp_awarded}</td>
              </tr>
            ))}
          </Table>
        )}
        {tab === 'badges' && (
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
            {data.badges.length === 0 && <p className="text-sm text-ink-3">No badges yet.</p>}
            {data.badges.map((b: any) => (
              <div key={b.code} className="flex items-center gap-3">
                <span className={cx('grid size-11 place-items-center rounded-xl ring-2', TIER_STYLES[b.tier]?.bg, TIER_STYLES[b.tier]?.ring, TIER_STYLES[b.tier]?.text)}><BadgeIcon name={b.icon} className="size-5" /></span>
                <div><p className="text-sm font-semibold text-ink">{b.name}</p><p className="text-xs text-ink-3">{fmtDate(b.awarded_at)}</p></div>
              </div>
            ))}
          </div>
        )}
        {tab === 'payments' && (
          <Table head={['Amount', 'Status', 'Receipt', 'Created', 'Paid']}>
            {data.contributions.map((c: any, i: number) => (
              <tr key={i}>
                <td className="px-4 py-3 font-semibold">{inr(c.amount_paise)}</td>
                <td className="px-4 py-3"><Pill tone={c.status === 'paid' ? 'success' : c.status === 'failed' ? 'danger' : 'neutral'}>{c.status}</Pill></td>
                <td className="px-4 py-3 font-mono text-xs">{c.receipt_no ?? '—'}</td>
                <td className="px-4 py-3">{fmtDateTime(c.created_at)}</td>
                <td className="px-4 py-3">{fmtDateTime(c.paid_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={roleOpen} onClose={() => setRoleOpen(false)} title={p.role === 'admin' ? 'Remove admin access?' : 'Grant admin access?'} size="sm" footer={<><Button variant="outline" onClick={() => setRoleOpen(false)}>Cancel</Button><Button loading={busy} onClick={changeRole}>Confirm</Button></>}>
        <p className="text-sm text-ink-2">{p.role === 'admin' ? `${p.full_name} will lose access to the admin dashboard.` : `${p.full_name} will be able to see all members' personal data and change content and settings.`}</p>
      </Modal>
    </div>
  )
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-ink-3 [&_svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-3">{label}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 break-words text-sm text-ink">{children}</div>
      </div>
    </div>
  )
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full min-w-[640px] text-sm">
      <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-ink-3">
        <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-line text-ink-2">{children}</tbody>
    </table>
  )
}
