import { Download, HandHeart, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, PageHeader, Pill, SkeletonCards, StatCard } from '../../components/ui'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { downloadCsv, toCsv } from '../../lib/csv'
import { friendlyError } from '../../lib/errors'
import { fmtDateTime, inr, num } from '../../lib/format'
import { Table } from './MemberDetail'

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminContributions() {
  useDocumentTitle('Guru Dakshina')
  const { data, loading, error } = useAsync(() => api.admin.contributions() as Promise<any[]>, [])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('paid')
  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (r) => (!status || r.status === status) && (!q || `${r.full_name} ${r.email} ${r.receipt_no ?? ''} ${r.razorpay_payment_id ?? ''}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [data, q, status],
  )
  const paid = (data ?? []).filter((r) => r.status === 'paid')
  const total = paid.reduce((s, r) => s + r.amount_paise, 0)
  const thisMonth = paid.filter((r) => r.paid_at && new Date(r.paid_at).getMonth() === new Date().getMonth() && new Date(r.paid_at).getFullYear() === new Date().getFullYear()).reduce((s, r) => s + r.amount_paise, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guru Dakshina"
        subtitle="Voluntary contributions verified through Razorpay."
        actions={<Button size="sm" variant="secondary" icon={<Download className="size-4" />} disabled={!rows.length} onClick={() => downloadCsv(`mythree-guru-dakshina-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows.map((r) => ({ receipt: r.receipt_no, name: r.full_name, email: r.email, phone: r.phone, amount: r.amount_paise / 100, status: r.status, method: r.payment_method, payment_id: r.razorpay_payment_id, created_at: r.created_at, paid_at: r.paid_at }))))}>Export CSV</Button>}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={<HandHeart className="size-5" />} tone="gold" label="Total received" value={inr(total)} />
        <StatCard icon={<HandHeart className="size-5" />} tone="maroon" label="This month" value={inr(thisMonth)} />
        <StatCard icon={<HandHeart className="size-5" />} tone="success" label="Successful contributions" value={num(paid.length)} sub={`${new Set(paid.map((r) => r.email)).size} contributors`} />
      </div>
      <Card className="flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, receipt or payment ID" className="h-11 w-full rounded-xl border border-line bg-bg-elevated pl-9 pr-3 text-sm text-ink focus:border-gold focus:outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-xl border border-line bg-bg-elevated px-3 text-sm" aria-label="Status">
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="created">Not completed</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </Card>
      {loading && !data ? (
        <SkeletonCards count={2} />
      ) : error ? (
        <EmptyState title="Couldn't load contributions">{friendlyError(error)}</EmptyState>
      ) : !rows.length ? (
        <EmptyState icon={<HandHeart className="size-6" />} title="No contributions found" />
      ) : (
        <Card className="overflow-x-auto">
          <Table head={['Member', 'Amount', 'Status', 'Receipt', 'Payment ID', 'Method', 'Date']}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3"><p className="font-semibold text-ink">{r.full_name}</p><p className="text-xs text-ink-3">{r.email}</p></td>
                <td className="px-4 py-3 font-semibold text-ink">{inr(r.amount_paise)}</td>
                <td className="px-4 py-3"><Pill tone={r.status === 'paid' ? 'success' : r.status === 'failed' ? 'danger' : 'neutral'}>{r.status}</Pill></td>
                <td className="px-4 py-3 font-mono text-xs">{r.receipt_no ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.razorpay_payment_id ?? '—'}</td>
                <td className="px-4 py-3 uppercase">{r.payment_method ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">{fmtDateTime(r.paid_at ?? r.created_at)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  )
}
