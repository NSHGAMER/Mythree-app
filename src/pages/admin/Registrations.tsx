import { BadgeCheck, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, EmptyState, Input, Modal, PageHeader, Pill, Skeleton } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { downloadCsv, toCsv } from '../../lib/csv'
import { friendlyError } from '../../lib/errors'
import { fmtDate, fmtDateTime, inr } from '../../lib/format'
import { Table } from './MemberDetail'

/* eslint-disable @typescript-eslint/no-explicit-any */
const PAGE = 50
const STATUS_TONE: Record<string, 'success' | 'gold' | 'danger'> = { confirmed: 'success', pending_payment: 'gold', cancelled: 'danger' }
const STATUS_LABEL: Record<string, string> = { confirmed: 'Confirmed', pending_payment: 'Payment pending', cancelled: 'Cancelled' }

export default function AdminRegistrations() {
  useDocumentTitle('Registrations')
  const { toast } = useApp()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [confirming, setConfirming] = useState<any | null>(null)
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search)
      setPage(0)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const { data, loading, error, reload } = useAsync(() => api.admin.registrations({ search: q, status, limit: PAGE, offset: page * PAGE }), [q, status, page])
  const rows = (data?.rows ?? []) as any[]
  const total = data?.total ?? 0

  async function confirm() {
    if (!confirming) return
    setBusy(true)
    try {
      const uid = await api.admin.confirmRegistration(confirming.id, reference)
      toast(`Registration confirmed · UID ${uid}`)
      setConfirming(null)
      setReference('')
      reload()
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function exportCsv() {
    const all = await api.admin.registrations({ search: q, status, limit: 500, offset: 0 })
    downloadCsv(
      `mythree-registrations-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        (all.rows as any[]).map((r) => ({
          uid: r.member_uid, name: r.full_name, email: r.email, phone: r.phone, guardian_name: r.guardian_name, guardian_phone: r.guardian_phone,
          date_of_birth: r.date_of_birth, age: r.age, exam_preference: r.exam_preference, status: STATUS_LABEL[r.registration_status],
          registered_at: r.created_at, confirmed_at: r.registration_confirmed_at, payment_status: r.payment?.status, receipt: r.payment?.receipt_no,
          razorpay_payment_id: r.payment?.razorpay_payment_id, manual_reference: r.payment?.manual_reference,
        })),
      ),
    )
  }

  return (
    <div>
      <PageHeader
        title="Registrations & member IDs"
        subtitle={`${total.toLocaleString('en-IN')} member${total === 1 ? '' : 's'} · registration is confirmed only after the ₹151 fee is verified`}
        actions={<Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={exportCsv}>Export CSV</Button>}
      />
      <Card className="mb-4 flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search UID, name, email or phone" className="h-11 w-full rounded-xl border border-line bg-bg-elevated pl-9 pr-3 text-sm text-ink focus:border-gold focus:outline-none" aria-label="Search registrations" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} className="h-11 rounded-xl border border-line bg-bg-elevated px-3 text-sm" aria-label="Status">
          <option value="">All statuses</option>
          <option value="pending_payment">Payment pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </Card>
      {error ? (
        <EmptyState title="Couldn't load registrations">{friendlyError(error)}</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <Table head={['UID', 'Member', 'Contact', 'Age', 'Exam', 'Status', 'Payment', '']}>
            {loading && !data
              ? Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>)
              : rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-maroon-ink">{r.member_uid ?? '—'}</td>
                    <td className="px-4 py-3"><Link to={`/admin/members/${r.id}`} className="font-semibold text-ink hover:underline">{r.full_name}</Link><p className="text-xs text-ink-3">{r.email} · {fmtDate(r.created_at)}</p></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">{r.phone ?? '—'}{r.guardian_phone && <span className="block text-ink-3">Guardian: {r.guardian_name} · {r.guardian_phone}</span>}</td>
                    <td className="px-4 py-3">{r.age ?? '—'}</td>
                    <td className="px-4 py-3 capitalize">{r.exam_preference}</td>
                    <td className="px-4 py-3"><Pill tone={STATUS_TONE[r.registration_status]}>{STATUS_LABEL[r.registration_status]}</Pill></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {r.payment ? (
                        <>
                          <span className="font-semibold">{inr(r.payment.amount_paise)} · {r.payment.status}</span>
                          <span className="block text-ink-3">{r.payment.receipt_no ?? ''} {r.payment.manual_reference ? `· manual: ${r.payment.manual_reference}` : ''} {r.payment.paid_at ? `· ${fmtDateTime(r.payment.paid_at)}` : ''}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.registration_status !== 'confirmed' && (
                        <Button size="sm" variant="outline" icon={<BadgeCheck className="size-4" />} onClick={() => setConfirming(r)}>Confirm</Button>
                      )}
                    </td>
                  </tr>
                ))}
          </Table>
          {!loading && rows.length === 0 && <EmptyState title="No registrations found" />}
          {total > PAGE && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
              <span className="text-ink-3">{page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} of {total}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="size-4" />}>Prev</Button>
                <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="size-4" /></Button>
              </div>
            </div>
          )}
        </Card>
      )}
      <Modal open={!!confirming} onClose={() => setConfirming(null)} title={`Confirm registration – ${confirming?.full_name ?? ''}`} footer={<><Button variant="outline" onClick={() => setConfirming(null)}>Cancel</Button><Button loading={busy} onClick={confirm}>Confirm & assign UID</Button></>}>
        <p className="text-sm text-ink-2">Use only when the fee was paid outside the app (cash, bank transfer) or a gateway payment needs manual reconciliation. This is recorded in the audit log.</p>
        <Input label="Payment reference" value={reference} onChange={(e) => setReference(e.target.value)} hint="Receipt number, UPI reference or Razorpay payment ID" wrapperClass="mt-4" />
      </Modal>
    </div>
  )
}
