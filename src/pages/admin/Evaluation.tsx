import { CheckCircle2, Download, Eye, FileSpreadsheet, Megaphone, Search, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { Alert, Button, Card, EmptyState, Input, Modal, PageHeader, Pill, Select, SkeletonCards, Tabs, Textarea, Toggle } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { normaliseResultRows, RESULT_TEMPLATE_HEADERS, signedUrl } from '../../lib/exam'
import { fmtDate, fmtDateTime } from '../../lib/format'
import { downloadXlsx, readSpreadsheet } from '../../lib/sheets'
import { supabase } from '../../lib/supabase'
import { Table } from './MemberDetail'

/* eslint-disable @typescript-eslint/no-explicit-any */
type ResultStatus = 'pass' | 'fail' | 'absent' | 'withheld'

export default function AdminEvaluation() {
  useDocumentTitle('Evaluation & results')
  const [tab, setTab] = useState<'online' | 'results'>('online')
  const cohorts = useAsync(() => api.admin.examCohorts() as Promise<any[]>, [])
  const schedules = (cohorts.data ?? []).map((c) => c.schedule).filter(Boolean)
  return (
    <div>
      <PageHeader title="Evaluation & results" subtitle="Mark online answer sheets, record offline results, import marks from Excel and publish results to members." />
      <Tabs className="mb-5" value={tab} onChange={setTab} items={[{ value: 'online', label: 'Online answer sheets' }, { value: 'results', label: 'Results, offline & Excel import' }]} />
      {tab === 'online' ? <OnlineSubmissions schedules={schedules} /> : <ResultsTab schedules={schedules} />}
    </div>
  )
}

function OnlineSubmissions({ schedules }: { schedules: any[] }) {
  const { toast } = useApp()
  const [schedule, setSchedule] = useState('')
  const [status, setStatus] = useState('submitted')
  const subs = useAsync(() => api.admin.examSubmissions(schedule, status) as Promise<any[]>, [schedule, status])
  const [open, setOpen] = useState<any | null>(null)
  const [images, setImages] = useState<{ page_no: number; url: string; path: string }[]>([])
  const [form, setForm] = useState({ marks: '', remarks: '', result: 'pass' as ResultStatus, publish: false, overwrite: false })
  const [busy, setBusy] = useState(false)

  async function view(s: any) {
    setOpen(s)
    setImages([])
    setForm({ marks: s.result?.marks ?? '', remarks: s.result?.remarks ?? '', result: s.result?.result ?? 'pass', publish: false, overwrite: false })
    const { data } = await supabase.from('exam_submission_pages').select('page_no, storage_path').eq('session_id', s.session_id).order('page_no')
    const list = await Promise.all((data ?? []).map(async (p) => ({ page_no: p.page_no, path: p.storage_path, url: await signedUrl('answer-sheets', p.storage_path, 1800).catch(() => '') })))
    setImages(list)
  }

  async function save() {
    if (!open) return
    setBusy(true)
    try {
      const marks = form.marks === '' ? null : Number(form.marks)
      await api.admin.saveResult({ user: open.user_id, schedule: open.schedule_id, mode: 'online', examDate: open.exam_starts_at?.slice(0, 10) ?? null, marks, max: Number(open.max_marks), remarks: form.remarks, result: form.result, publish: form.publish, overwrite: form.overwrite })
      toast(form.publish ? 'Result saved and published' : 'Evaluation saved (not yet published)')
      subs.reload()
      setOpen(null)
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function downloadZip() {
    if (!open || !images.length) return
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (const im of images) {
      const blob = await (await fetch(im.url)).blob()
      zip.file(`${open.member_uid ?? open.user_id}-page-${String(im.page_no).padStart(2, '0')}.jpg`, blob)
    }
    const out = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(out)
    a.download = `${open.member_uid ?? 'member'}-answer-sheets.zip`
    a.click()
  }

  async function purge() {
    if (!open || !confirm('Delete these answer-sheet images from storage? Download the ZIP first – this cannot be undone.')) return
    try {
      await api.admin.markPurged(open.session_id)
      const { error } = await supabase.storage.from('answer-sheets').remove(images.map((i) => i.path))
      if (error) throw error
      toast('Images removed from storage')
      setOpen(null)
      subs.reload()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  return (
    <>
      <Card className="mb-4 flex flex-col gap-3 p-3 sm:flex-row">
        <select value={schedule} onChange={(e) => setSchedule(e.target.value)} className="h-11 flex-1 rounded-xl border border-line bg-bg-elevated px-3 text-sm" aria-label="Exam">
          <option value="">All exams</option>
          {schedules.map((s) => <option key={s.id} value={s.id}>{s.title} · {fmtDate(s.exam_starts_at)}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-xl border border-line bg-bg-elevated px-3 text-sm" aria-label="Status">
          <option value="submitted">Submitted</option>
          <option value="in_progress">In progress</option>
          <option value="expired">Expired (not submitted)</option>
          <option value="">All</option>
        </select>
      </Card>
      {subs.loading && !subs.data ? (
        <SkeletonCards count={2} />
      ) : !subs.data?.length ? (
        <EmptyState title="No submissions" />
      ) : (
        <Card className="overflow-x-auto">
          <Table head={['UID', 'Member', 'Started', 'Submitted', 'Pages', 'Evaluation', '']}>
            {subs.data.map((s) => (
              <tr key={s.session_id}>
                <td className="px-4 py-3 font-mono font-semibold text-maroon-ink">{s.member_uid ?? '—'}</td>
                <td className="px-4 py-3"><p className="font-semibold text-ink">{s.full_name}</p><p className="text-xs text-ink-3">{s.email}</p></td>
                <td className="whitespace-nowrap px-4 py-3">{fmtDateTime(s.started_at)}</td>
                <td className="whitespace-nowrap px-4 py-3">{s.submitted_at ? fmtDateTime(s.submitted_at) : <Pill tone={s.status === 'expired' ? 'danger' : 'gold'}>{s.status}</Pill>}</td>
                <td className="px-4 py-3">{s.pages_count}{s.purged_at && <span className="block text-xs text-ink-3">images removed</span>}</td>
                <td className="px-4 py-3">{s.result ? <Pill tone={s.result.published_at ? 'success' : 'gold'}>{s.result.marks ?? '—'}/{s.result.max_marks} · {s.result.result} {s.result.published_at ? '· published' : '· draft'}</Pill> : <Pill tone="neutral">Not evaluated</Pill>}</td>
                <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" icon={<Eye className="size-4" />} onClick={() => view(s)}>Evaluate</Button></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.full_name} · ${open.member_uid ?? ''}` : ''} size="lg" footer={<><Button variant="ghost" icon={<Download className="size-4" />} onClick={downloadZip} disabled={!images.length}>Download ZIP</Button>{open?.result && !open?.purged_at && <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={purge}>Remove images</Button>}<Button loading={busy} onClick={save}>Save evaluation</Button></>}>
        {open && (
          <div className="space-y-4">
            <p className="text-sm text-ink-3">{open.schedule_title} · started {fmtDateTime(open.started_at)} · submitted {fmtDateTime(open.submitted_at)} · max {open.max_marks}, pass {open.pass_marks}</p>
            {open.purged_at ? (
              <Alert tone="info">Images were removed from storage on {fmtDateTime(open.purged_at)} after download.</Alert>
            ) : (
              <div className="grid max-h-[45vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {images.map((im) => (
                  <a key={im.page_no} href={im.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-line">
                    <img src={im.url} alt={`Page ${im.page_no}`} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                    <span className="block px-2 py-1 text-xs text-ink-3">Page {im.page_no}</span>
                  </a>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label={`Marks (out of ${open.max_marks})`} type="number" min={0} max={open.max_marks} value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value, result: e.target.value !== '' && Number(e.target.value) >= Number(open.pass_marks) ? 'pass' : form.result === 'pass' && e.target.value !== '' ? 'fail' : form.result })} />
              <Select label="Result" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as ResultStatus })} options={[{ value: 'pass', label: 'PASS' }, { value: 'fail', label: 'FAIL' }, { value: 'absent', label: 'ABSENT' }, { value: 'withheld', label: 'WITHHELD' }]} />
              <div className="pt-7"><Toggle checked={form.publish} onChange={(v) => setForm({ ...form, publish: v })} label="Publish now" /></div>
            </div>
            <Textarea label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={2} />
            {open.result?.published_at && <Toggle checked={form.overwrite} onChange={(v) => setForm({ ...form, overwrite: v })} label="Overwrite published result" description="Required to change a result members can already see (recorded in the audit log)" />}
          </div>
        )}
      </Modal>
    </>
  )
}

function ResultsTab({ schedules }: { schedules: any[] }) {
  const { toast } = useApp()
  const [schedule, setSchedule] = useState('')
  const sched = schedules.find((s) => s.id === schedule)
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.admin.importResults>> | null>(null)
  const [publish, setPublish] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uidQuery, setUidQuery] = useState('')
  const [member, setMember] = useState<any | null>(null)
  const [single, setSingle] = useState({ marks: '', remarks: '', result: 'pass' as ResultStatus, publish: false, exam_date: '' })

  async function template() {
    const all = await api.admin.registrations({ status: 'confirmed', limit: 500 })
    await downloadXlsx(`mythree-results-template${sched ? '-' + sched.cohort_month : ''}.xlsx`, 'Results', RESULT_TEMPLATE_HEADERS, (all.rows as any[]).map((r) => [r.member_uid, r.full_name, null, null, null]))
  }

  async function onFile(f: File | null) {
    setFile(f)
    setPreview(null)
    if (!f) return
    try {
      const raw = await readSpreadsheet(f)
      const norm = normaliseResultRows(raw)
      setRows(norm)
      setBusy(true)
      setPreview(await api.admin.importResults(norm, schedule || null, Number(sched?.max_marks ?? 100), f.name, true, false))
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function applyImport() {
    if (!file) return
    setBusy(true)
    try {
      const r = await api.admin.importResults(rows, schedule || null, Number(sched?.max_marks ?? 100), file.name, false, publish)
      toast(`Imported ${r.applied} result(s); ${r.issues.length} row(s) skipped`)
      setPreview(r)
      setFile(null)
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function findMember() {
    const r = await api.admin.registrations({ search: uidQuery.trim(), limit: 1 })
    setMember((r.rows as any[])[0] ?? null)
    if (!(r.rows as any[]).length) toast('No member found for that UID', 'error')
  }

  async function saveSingle() {
    if (!member) return
    setBusy(true)
    try {
      await api.admin.saveResult({ user: member.id, schedule: schedule || null, mode: member.exam_preference, examDate: single.exam_date || sched?.exam_starts_at?.slice(0, 10) || null, marks: single.marks === '' ? null : Number(single.marks), max: Number(sched?.max_marks ?? 100), remarks: single.remarks, result: single.result, publish: single.publish })
      toast('Result saved')
      setMember(null)
      setUidQuery('')
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function publishAll() {
    if (!schedule || !confirm('Publish all saved results for this exam? Members will see them immediately.')) return
    try {
      const n = await api.admin.publishResults(schedule)
      toast(`${n} result(s) published`)
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <Select label="Exam" wrapperClass="flex-1" value={schedule} onChange={(e) => setSchedule(e.target.value)} options={schedules.map((s) => ({ value: s.id, label: `${s.title} · ${fmtDate(s.exam_starts_at)} (max ${s.max_marks})` }))} placeholder="Choose the exam" />
        <Button variant="gold" icon={<Megaphone className="size-4" />} disabled={!schedule} onClick={publishAll}>Publish all saved results</Button>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-lg text-ink">Record a result (offline or online)</h2>
        <div className="flex gap-2">
          <Input label="Member UID" value={uidQuery} onChange={(e) => setUidQuery(e.target.value.toUpperCase())} wrapperClass="flex-1" />
          <Button className="mt-7" variant="secondary" icon={<Search className="size-4" />} onClick={findMember} disabled={uidQuery.trim().length < 4}>Find</Button>
        </div>
        {member && (
          <div className="space-y-4 rounded-2xl bg-surface-2 p-4">
            <p className="text-sm"><strong>{member.full_name}</strong> · <span className="font-mono">{member.member_uid}</span> · {member.exam_preference} exam</p>
            <div className="grid gap-4 sm:grid-cols-4">
              <Input label={`Marks (max ${sched?.max_marks ?? 100})`} type="number" value={single.marks} onChange={(e) => setSingle({ ...single, marks: e.target.value })} />
              <Select label="Result" value={single.result} onChange={(e) => setSingle({ ...single, result: e.target.value as ResultStatus })} options={[{ value: 'pass', label: 'PASS' }, { value: 'fail', label: 'FAIL' }, { value: 'absent', label: 'ABSENT' }, { value: 'withheld', label: 'WITHHELD' }]} />
              <Input label="Exam date" type="date" value={single.exam_date} onChange={(e) => setSingle({ ...single, exam_date: e.target.value })} />
              <div className="pt-7"><Toggle checked={single.publish} onChange={(v) => setSingle({ ...single, publish: v })} label="Publish" /></div>
            </div>
            <Textarea label="Remarks" value={single.remarks} onChange={(e) => setSingle({ ...single, remarks: e.target.value })} rows={2} />
            <Button loading={busy} onClick={saveSingle} icon={<CheckCircle2 className="size-4" />}>Save result</Button>
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg text-ink">Import results from Excel</h2>
          <Button variant="secondary" size="sm" icon={<FileSpreadsheet className="size-4" />} onClick={template}>Download template</Button>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
          <li>Download the template (pre-filled with registered members' UIDs and names).</li>
          <li>Enter Marks, Remarks and Result (PASS / FAIL / ABSENT / WITHHELD). Keep the UID column.</li>
          <li>Upload the file (.xlsx or .csv), check the preview, then confirm.</li>
        </ol>
        <label className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong p-4 text-sm text-ink-3">
          <Upload className="size-5" />
          <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
        {busy && !preview && <p className="text-sm text-ink-3">Validating…</p>}
        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Pill tone="neutral">{preview.rows_total} rows</Pill>
              <Pill tone="success">{preview.valid} valid</Pill>
              <Pill tone={preview.issues.length ? 'danger' : 'neutral'}>{preview.issues.length} with issues</Pill>
              {!preview.dry_run && <Pill tone="gold">{preview.applied} imported</Pill>}
            </div>
            {preview.issues.length > 0 && (
              <Card className="max-h-56 overflow-auto">
                <Table head={['Row', 'UID', 'Issue']}>
                  {preview.issues.map((i, n) => <tr key={n}><td className="px-4 py-2">{i.row}</td><td className="px-4 py-2 font-mono">{i.uid}</td><td className="px-4 py-2 text-danger">{i.issue}</td></tr>)}
                </Table>
              </Card>
            )}
            {preview.dry_run && preview.valid > 0 && (
              <div className="flex flex-wrap items-center gap-4">
                <Toggle checked={publish} onChange={setPublish} label="Publish imported results immediately" />
                <Button loading={busy} onClick={applyImport}>Import {preview.valid} valid row(s)</Button>
              </div>
            )}
            <p className="text-xs text-ink-3">Rows for results that are already published are never changed by an import. Every import is recorded.</p>
          </div>
        )}
      </Card>
    </div>
  )
}
