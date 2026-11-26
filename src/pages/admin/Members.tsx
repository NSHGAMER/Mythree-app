import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, cx, EmptyState, PageHeader, Pill, ProgressBar, Skeleton } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { downloadCsv, toCsv } from '../../lib/csv'
import { friendlyError } from '../../lib/errors'
import { EXAM_STATUS_LABEL, fmtDate, inr, relativeTime } from '../../lib/format'
import type { MemberRow } from '../../types'

const FILTERS = [
  { value: 'all', label: 'All members' },
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'All chapters done' },
  { value: 'exam_ready', label: 'Exam requested' },
  { value: 'beyond_target', label: 'Beyond target days' },
  { value: 'inactive', label: 'Inactive 14+ days' },
  { value: 'contributed', label: 'Contributed' },
  { value: 'not_contributed', label: 'Not contributed' },
]

const COLS: { key: string; label: string; sort?: string; className?: string }[] = [
  { key: 'name', label: 'Member', sort: 'name' },
  { key: 'registered', label: 'Registered', sort: 'registered_at' },
  { key: 'phone', label: 'Phone' },
  { key: 'current', label: 'Current chapter' },
  { key: 'progress', label: 'Progress', sort: 'progress' },
  { key: 'last', label: 'Last active', sort: 'last_active' },
  { key: 'score', label: 'Avg score', sort: 'score' },
  { key: 'days', label: 'Days', sort: 'days' },
  { key: 'exam', label: 'Final exam' },
  { key: 'gd', label: 'Guru Dakshina', sort: 'contribution' },
]

const PAGE = 50

export default function AdminMembers() {
  useDocumentTitle('Members')
  const navigate = useNavigate()
  const { toast } = useApp()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('registered_at')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search)
      setPage(0)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const { data, error, loading } = useAsync(() => api.admin.members({ search: q, filter, sort, dir, limit: PAGE, offset: page * PAGE }), [q, filter, sort, dir, page])
  const total = data?.[0]?.total_count ?? 0

  function toggleSort(s: string) {
    if (sort === s) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(s)
      setDir(s === 'name' ? 'asc' : 'desc')
    }
    setPage(0)
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const rows = await api.admin.members({ search: q, filter, sort, dir, limit: 5000, offset: 0 })
      const csv = toCsv(
        rows.map((r) => ({
          ...r,
          completion_pct: `${r.completion_pct}%`,
          contribution: inr(r.contribution_total_paise),
          exam: EXAM_STATUS_LABEL[r.exam_status] ?? r.exam_status,
        })) as unknown as Record<string, unknown>[],
        [
          { key: 'full_name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'email_verified', label: 'Email verified' },
          { key: 'phone', label: 'Phone' },
          { key: 'phone_verified', label: 'Phone verified' },
          { key: 'city', label: 'City' },
          { key: 'state', label: 'State' },
          { key: 'registered_at', label: 'Registered at' },
          { key: 'programme_start_date', label: 'Programme start' },
          { key: 'current_chapter', label: 'Current chapter' },
          { key: 'completed_chapters', label: 'Completed chapters' },
          { key: 'total_chapters', label: 'Total chapters' },
          { key: 'completion_pct', label: 'Completion' },
          { key: 'last_active', label: 'Last active' },
          { key: 'avg_score', label: 'Avg test score %' },
          { key: 'tests_taken', label: 'Tests taken' },
          { key: 'xp', label: 'XP' },
          { key: 'current_streak', label: 'Streak' },
          { key: 'days_taken', label: 'Days taken' },
          { key: 'exam', label: 'Final exam status' },
          { key: 'exam_requested_at', label: 'Exam requested at' },
          { key: 'contribution', label: 'Guru Dakshina total' },
        ],
      )
      downloadCsv(`mythree-members-${new Date().toISOString().slice(0, 10)}.csv`, csv)
      toast(`Exported ${rows.length} members`)
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Members" subtitle={`${total.toLocaleString('en-IN')} member${total === 1 ? '' : 's'} match`} actions={<Button variant="secondary" size="sm" loading={exporting} icon={<Download className="size-4" />} onClick={exportCsv}>Export CSV</Button>} />
      <Card className="mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone or city" className="h-11 w-full rounded-xl border border-line bg-bg-elevated pl-9 pr-3 text-sm text-ink focus:border-gold focus:outline-none" aria-label="Search members" />
        </div>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }} className="h-11 rounded-xl border border-line bg-bg-elevated px-3 text-sm text-ink" aria-label="Filter">
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </Card>

      {error ? (
        <EmptyState title="Couldn't load members">{friendlyError(error)}</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-sm">
              <thead className="sticky top-0 bg-surface-2 text-left text-xs uppercase tracking-wider text-ink-3">
                <tr>
                  {COLS.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-4 py-3 font-bold">
                      {c.sort ? (
                        <button onClick={() => toggleSort(c.sort!)} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink">
                          {c.label}
                          {sort === c.sort && (dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading && !data
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>{COLS.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
                    ))
                  : (data ?? []).map((m: MemberRow) => (
                      <tr key={m.id} onClick={() => navigate(`/admin/members/${m.id}`)} className="cursor-pointer transition hover:bg-surface-2/70">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink">{m.full_name}</p>
                          <p className="text-xs text-ink-3">{m.email}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-2">{fmtDate(m.registered_at)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-2">{m.phone ?? '—'} {m.phone_verified && <span className="text-success" title="Verified">✓</span>}</td>
                        <td className="max-w-48 truncate px-4 py-3 text-ink-2">{m.current_chapter ? `${m.current_chapter_position}. ${m.current_chapter}` : m.total_chapters > 0 ? 'All done' : '—'}</td>
                        <td className="w-44 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={m.completion_pct} size="sm" className="w-20" label="Progress" />
                            <span className="whitespace-nowrap text-xs text-ink-2">{m.completed_chapters}/{m.total_chapters}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-2">{relativeTime(m.last_active)}</td>
                        <td className="px-4 py-3 text-ink-2">{m.avg_score !== null ? `${m.avg_score}%` : '—'} <span className="text-xs text-ink-3">({m.tests_taken})</span></td>
                        <td className="px-4 py-3 text-ink-2">{m.days_taken}</td>
                        <td className="px-4 py-3">
                          <Pill tone={m.exam_status === 'not_requested' ? 'neutral' : m.exam_status === 'requested' ? 'gold' : m.exam_status === 'paper_dispatched' || m.exam_status === 'delivered' || m.exam_status === 'exam_completed' ? 'success' : 'info'}>
                            {EXAM_STATUS_LABEL[m.exam_status] ?? m.exam_status}
                          </Pill>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{m.contributed ? <span className="font-semibold text-success">{inr(m.contribution_total_paise)}</span> : <span className="text-ink-3">—</span>}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!loading && data?.length === 0 && <EmptyState icon={<Users className="size-6" />} title="No members found">Try a different search or filter.</EmptyState>}
          <div className={cx('flex items-center justify-between border-t border-line px-4 py-3 text-sm', total <= PAGE && 'hidden')}>
            <span className="text-ink-3">
              {page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} of {total.toLocaleString('en-IN')}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="size-4" />}>Prev</Button>
              <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
