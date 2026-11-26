import { Download, Pencil, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, EmptyState, Input, Modal, PageHeader, Pill, Select, SkeletonCards, Textarea } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { downloadCsv, toCsv } from '../../lib/csv'
import { friendlyError } from '../../lib/errors'
import { EXAM_STATUS_LABEL, fmtDate } from '../../lib/format'

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATUSES = ['requested', 'approved', 'paper_dispatched', 'delivered', 'exam_completed', 'on_hold', 'cancelled']
const tone = (s: string) => (s === 'requested' ? 'gold' : s === 'approved' ? 'info' : s === 'on_hold' ? 'saffron' : s === 'cancelled' ? 'danger' : 'success') as 'gold'

export default function AdminExams() {
  useDocumentTitle('Final exam & dispatch')
  const { toast } = useApp()
  const [status, setStatus] = useState('')
  const { data, loading, error, reload } = useAsync(() => api.admin.examRequests(status) as Promise<any[]>, [status])
  const [edit, setEdit] = useState<any | null>(null)
  const [form, setForm] = useState({ status: '', courier: '', tracking: '', notes: '' })
  const [busy, setBusy] = useState(false)

  function open(r: any) {
    setEdit(r)
    setForm({ status: r.status, courier: r.courier ?? '', tracking: r.tracking_number ?? '', notes: r.admin_notes ?? '' })
  }

  async function save() {
    setBusy(true)
    try {
      await api.admin.updateExam(edit.id, form.status, form.courier, form.tracking, form.notes)
      toast('Dispatch status updated')
      setEdit(null)
      reload()
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function exportLabels() {
    const rows = (data ?? []).map((r) => ({
      name: r.address_snapshot.full_name,
      phone: r.address_snapshot.phone,
      email: r.email,
      address_line1: r.address_snapshot.address_line1,
      address_line2: r.address_snapshot.address_line2,
      city: r.address_snapshot.city,
      state: r.address_snapshot.state,
      pincode: r.address_snapshot.pincode,
      requested_at: fmtDate(r.requested_at),
      days_taken: r.days_taken,
      status: EXAM_STATUS_LABEL[r.status],
      courier: r.courier,
      tracking: r.tracking_number,
    }))
    downloadCsv(`mythree-exam-dispatch-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
  }

  return (
    <div>
      <PageHeader
        title="Final exam & dispatch"
        subtitle="Members who declared readiness. Question papers are posted to the address captured at request time."
        actions={
          <>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-xl border border-line bg-bg-elevated px-3 text-sm" aria-label="Filter by status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{EXAM_STATUS_LABEL[s]}</option>)}
            </select>
            <Button size="sm" variant="secondary" icon={<Download className="size-4" />} onClick={exportLabels} disabled={!data?.length}>Export addresses</Button>
          </>
        }
      />
      {loading && !data ? (
        <SkeletonCards count={3} />
      ) : error ? (
        <EmptyState title="Couldn't load requests">{friendlyError(error)}</EmptyState>
      ) : !data?.length ? (
        <EmptyState icon={<ScrollText className="size-6" />} title="No requests">Requests appear here when members confirm they are ready for the final exam.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/admin/members/${r.user_id}`} className="font-display text-lg text-ink hover:text-maroon-ink">{r.full_name}</Link>
                  <p className="text-xs text-ink-3">{r.email} · {r.phone}</p>
                </div>
                <Pill tone={tone(r.status)}>{EXAM_STATUS_LABEL[r.status]}</Pill>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div><dt className="text-xs text-ink-3">Requested</dt><dd className="font-semibold text-ink">{fmtDate(r.requested_at)}</dd></div>
                <div><dt className="text-xs text-ink-3">Days taken</dt><dd className="font-semibold text-ink">{r.days_taken}</dd></div>
                <div><dt className="text-xs text-ink-3">Chapters</dt><dd className="font-semibold text-ink">{r.chapters_completed}</dd></div>
              </dl>
              <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
                <p className="font-semibold text-ink">{r.address_snapshot.full_name}</p>
                <p>{[r.address_snapshot.address_line1, r.address_snapshot.address_line2].filter(Boolean).join(', ')}</p>
                <p>{r.address_snapshot.city}, {r.address_snapshot.state} – {r.address_snapshot.pincode}</p>
                <p className="text-xs text-ink-3">Phone: {r.address_snapshot.phone}</p>
              </div>
              {(r.courier || r.tracking_number) && <p className="mt-3 text-xs text-ink-3">{r.courier} {r.tracking_number && `· Tracking ${r.tracking_number}`} {r.dispatched_at && `· Dispatched ${fmtDate(r.dispatched_at)}`}</p>}
              {r.admin_notes && <p className="mt-2 text-xs italic text-ink-3">Note: {r.admin_notes}</p>}
              <Button size="sm" variant="outline" className="mt-4" icon={<Pencil className="size-4" />} onClick={() => open(r)}>Update status</Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Update – ${edit?.full_name ?? ''}`} footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        <div className="space-y-4">
          <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={STATUSES.map((s) => ({ value: s, label: EXAM_STATUS_LABEL[s] }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Courier / post" value={form.courier} onChange={(e) => setForm((f) => ({ ...f, courier: e.target.value }))} maxLength={100} />
            <Input label="Tracking number" value={form.tracking} onChange={(e) => setForm((f) => ({ ...f, tracking: e.target.value }))} maxLength={100} />
          </div>
          <Textarea label="Internal notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} maxLength={2000} rows={3} />
        </div>
      </Modal>
    </div>
  )
}
