import { CalendarClock, FileUp, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, PageHeader, Pill, SkeletonCards, Textarea, Toggle } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { fmtDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'

/* eslint-disable @typescript-eslint/no-explicit-any */
const monthLabel = (d: string) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d))
const localInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

interface Form {
  id?: string
  cohort_month: string
  title: string
  exam_starts_at: string
  entry_closes_at: string
  duration_minutes: number
  upload_grace_minutes: number
  max_marks: number
  pass_marks: number
  instructions: string
  is_published: boolean
  question_paper_path: string | null
}

export default function AdminExamSchedules() {
  useDocumentTitle('Exam schedules')
  const { toast } = useApp()
  const cohorts = useAsync(() => api.admin.examCohorts() as Promise<any[]>, [])
  const [edit, setEdit] = useState<Form | null>(null)
  const [paper, setPaper] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  function open(c: any) {
    const s = c.schedule
    const suggested = new Date(c.suggested_month)
    const start = new Date(Date.UTC(suggested.getUTCFullYear(), suggested.getUTCMonth(), 15, 4, 30)) // 10:00 IST on the 15th
    setPaper(null)
    setEdit(
      s
        ? { id: s.id, cohort_month: s.cohort_month, title: s.title, exam_starts_at: localInput(s.exam_starts_at), entry_closes_at: localInput(s.entry_closes_at), duration_minutes: s.duration_minutes, upload_grace_minutes: s.upload_grace_minutes, max_marks: Number(s.max_marks), pass_marks: Number(s.pass_marks), instructions: s.instructions ?? '', is_published: s.is_published, question_paper_path: s.question_paper_path }
        : { cohort_month: c.cohort_month, title: 'Mythree Final Examination', exam_starts_at: localInput(start.toISOString()), entry_closes_at: localInput(new Date(start.getTime() + 2 * 3600_000).toISOString()), duration_minutes: 180, upload_grace_minutes: 15, max_marks: 100, pass_marks: 35, instructions: '', is_published: false, question_paper_path: null },
    )
  }

  async function save() {
    if (!edit) return
    setBusy(true)
    try {
      let paperPath = edit.question_paper_path
      if (paper) {
        if (paper.type !== 'application/pdf') throw new Error('The question paper must be a PDF.')
        paperPath = `${edit.cohort_month}/question-paper-${Date.now()}.pdf`
        const { error } = await supabase.storage.from('exam-papers').upload(paperPath, paper, { contentType: 'application/pdf', upsert: false })
        if (error) throw error
      }
      const row = {
        cohort_month: edit.cohort_month, title: edit.title.trim() || 'Mythree Final Examination',
        exam_starts_at: new Date(edit.exam_starts_at).toISOString(), entry_closes_at: new Date(edit.entry_closes_at).toISOString(),
        duration_minutes: Number(edit.duration_minutes), upload_grace_minutes: Number(edit.upload_grace_minutes),
        max_marks: Number(edit.max_marks), pass_marks: Number(edit.pass_marks), instructions: edit.instructions.trim() || null,
        is_published: edit.is_published, question_paper_path: paperPath,
      }
      const { error } = edit.id ? await supabase.from('exam_schedules').update(row).eq('id', edit.id) : await supabase.from('exam_schedules').insert(row)
      if (error) throw error
      toast('Exam schedule saved')
      setEdit(null)
      cohorts.reload()
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Exam schedules"
        subtitle="Members are grouped by registration month. Each batch is suggested an exam about three months later (November → February). Set the exact date, upload the question paper and publish."
      />
      {cohorts.loading && !cohorts.data ? (
        <SkeletonCards count={3} />
      ) : !cohorts.data?.length ? (
        <EmptyState icon={<CalendarClock className="size-6" />} title="No registered batches yet">Batches appear here when members complete registration.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cohorts.data.map((c) => (
            <Card key={c.cohort_month} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Registered in</p>
                  <p className="font-display text-xl text-ink">{monthLabel(c.cohort_month)}</p>
                  <p className="text-sm text-ink-3">Suggested exam: {monthLabel(c.suggested_month)}</p>
                </div>
                {c.schedule ? <Pill tone={c.schedule.is_published ? 'success' : 'gold'}>{c.schedule.is_published ? 'Published' : 'Draft'}</Pill> : <Pill tone="neutral">Not scheduled</Pill>}
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
                {[['Members', c.members], ['Online', c.online], ['Offline', c.offline], ['Ready', c.ready]].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-surface-2 py-2"><p className="font-display text-lg text-ink">{v}</p><p className="text-xs text-ink-3">{l}</p></div>
                ))}
              </div>
              {c.schedule && (
                <p className="mt-3 text-sm text-ink-2">
                  {fmtDateTime(c.schedule.exam_starts_at)} · {c.schedule.duration_minutes / 60} h · entry until {fmtDateTime(c.schedule.entry_closes_at)} · {c.schedule.question_paper_path ? 'paper uploaded' : <span className="text-danger">no paper yet</span>}
                </p>
              )}
              <Button size="sm" variant={c.schedule ? 'outline' : 'primary'} className="mt-4" icon={c.schedule ? <Pencil className="size-4" /> : <Plus className="size-4" />} onClick={() => open(c)}>
                {c.schedule ? 'Edit schedule' : 'Schedule exam'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `Exam for ${monthLabel(edit.cohort_month)} batch` : ''} size="lg" footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save schedule</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Input label="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Exam opens (date & time)" type="datetime-local" value={edit.exam_starts_at} onChange={(e) => setEdit({ ...edit, exam_starts_at: e.target.value })} />
              <Input label="Latest start time (online)" type="datetime-local" value={edit.entry_closes_at} onChange={(e) => setEdit({ ...edit, entry_closes_at: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Input label="Duration (minutes)" type="number" min={10} value={edit.duration_minutes} onChange={(e) => setEdit({ ...edit, duration_minutes: Number(e.target.value) })} />
              <Input label="Upload grace (min)" type="number" min={0} max={120} value={edit.upload_grace_minutes} onChange={(e) => setEdit({ ...edit, upload_grace_minutes: Number(e.target.value) })} hint="Extra time to photograph pages" />
              <Input label="Max marks" type="number" min={1} value={edit.max_marks} onChange={(e) => setEdit({ ...edit, max_marks: Number(e.target.value) })} />
              <Input label="Pass marks" type="number" min={0} value={edit.pass_marks} onChange={(e) => setEdit({ ...edit, pass_marks: Number(e.target.value) })} />
            </div>
            <Textarea label="Instructions for members" value={edit.instructions} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} rows={3} />
            <label className="block">
              <span className="text-sm font-semibold text-ink-2">Question paper (PDF, private)</span>
              <span className="mt-1.5 flex items-center gap-3 rounded-xl border border-dashed border-line-strong p-3 text-sm text-ink-3">
                <FileUp className="size-5" />
                <input type="file" accept="application/pdf" onChange={(e) => setPaper(e.target.files?.[0] ?? null)} />
              </span>
              <span className="mt-1 block text-xs text-ink-3">{edit.question_paper_path ? `Current: ${edit.question_paper_path}` : 'Members can open it only after pressing START.'}</span>
            </label>
            <Toggle checked={edit.is_published} onChange={(v) => setEdit({ ...edit, is_published: v })} label="Publish to members" description="Members of this batch see the date and countdown" />
          </div>
        )}
      </Modal>
    </div>
  )
}
