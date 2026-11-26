export const inr = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format(
    paise / 100,
  )

export const num = (n: number) => new Intl.NumberFormat('en-IN').format(n)

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '—'
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00+05:30`) : new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...opts }).format(d)
}

export function fmtDateTime(iso: string | null | undefined) {
  return fmtDate(iso, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function relativeTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return 'Never'
  const diff = (now - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d ago`
  return fmtDate(iso)
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function maskPhone(p: string | null) {
  if (!p) return '—'
  return p.replace(/^(\+\d{2})(\d{2})\d{4}(\d{4})$/, '$1 $2•• ••$3')
}

export const EXAM_STATUS_LABEL: Record<string, string> = {
  not_requested: 'Not requested',
  requested: 'Ready – awaiting review',
  approved: 'Approved',
  paper_dispatched: 'Paper dispatched',
  delivered: 'Paper delivered',
  exam_completed: 'Exam completed',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
}
