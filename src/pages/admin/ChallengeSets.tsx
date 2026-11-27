import { Pencil, Plus, Swords, Target, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Card, cx, EmptyState, Input, Modal, PageHeader, Pill, Select, SkeletonCards, Toggle } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { friendlyError } from '../../lib/errors'
import { fmtDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SetForm {
  id?: string
  kind: 'daily' | 'weekly'
  title: string
  available_from: string
  available_to: string
  question_ids: string[]
  xp_base: number
  xp_per_correct: number
  pass_percentage: string
  is_active: boolean
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

export default function AdminChallengeSets() {
  useDocumentTitle('Daily & weekly tests')
  const { toast } = useApp()
  const sets = useAsync(async () => {
    const { data, error } = await supabase.from('challenge_sets').select('*').order('available_from', { ascending: false })
    if (error) throw error
    return data as any[]
  }, [])
  const bank = useAsync(async () => {
    const { data, error } = await supabase.from('questions').select('id, prompt, type, is_active, chapter_id, chapters(position, title)').eq('is_active', true).order('chapter_id')
    if (error) throw error
    return data as any[]
  }, [])
  const [edit, setEdit] = useState<SetForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')
  const byChapter = useMemo(() => {
    const m = new Map<string, { title: string; position: number; qs: any[] }>()
    for (const q of bank.data ?? []) {
      const k = q.chapter_id
      if (!m.has(k)) m.set(k, { title: q.chapters?.title ?? '', position: q.chapters?.position ?? 0, qs: [] })
      m.get(k)!.qs.push(q)
    }
    return [...m.entries()].sort((a, b) => a[1].position - b[1].position)
  }, [bank.data])

  function open(s?: any) {
    setEdit(
      s
        ? { id: s.id, kind: s.kind, title: s.title, available_from: s.available_from, available_to: s.available_to, question_ids: s.question_ids, xp_base: s.xp_base, xp_per_correct: s.xp_per_correct, pass_percentage: s.pass_percentage ? String(s.pass_percentage) : '', is_active: s.is_active }
        : { kind: 'daily', title: '', available_from: today(), available_to: today(), question_ids: [], xp_base: 10, xp_per_correct: 4, pass_percentage: '', is_active: true },
    )
  }

  async function save() {
    if (!edit) return
    if (edit.title.trim().length < 2) return toast('Enter a title', 'error')
    if (!edit.question_ids.length) return toast('Choose at least one question', 'error')
    if (edit.available_to < edit.available_from) return toast('End date must be on or after the start date', 'error')
    setBusy(true)
    const row = { kind: edit.kind, title: edit.title.trim(), available_from: edit.available_from, available_to: edit.available_to, question_ids: edit.question_ids, xp_base: Number(edit.xp_base), xp_per_correct: Number(edit.xp_per_correct), pass_percentage: edit.pass_percentage ? Number(edit.pass_percentage) : null, is_active: edit.is_active }
    const { error } = edit.id ? await supabase.from('challenge_sets').update(row).eq('id', edit.id) : await supabase.from('challenge_sets').insert(row)
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    toast('Challenge saved')
    setEdit(null)
    sets.reload()
  }

  async function remove(s: any) {
    if (!confirm(`Delete “${s.title}”? Members who already took it keep their results.`)) return
    const { error } = await supabase.from('challenge_sets').delete().eq('id', s.id)
    if (error) return toast(friendlyError(error), 'error')
    sets.reload()
  }

  const toggleQ = (id: string) => setEdit((e) => (e ? { ...e, question_ids: e.question_ids.includes(id) ? e.question_ids.filter((x) => x !== id) : [...e.question_ids, id] } : e))

  return (
    <div>
      <PageHeader title="Daily & weekly tests" subtitle="Configure the questions, dates and rewards for daily and weekly challenges. When no set covers today, members get an automatic challenge from chapters they have reached." actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => open()}>New challenge</Button>} />
      {sets.loading && !sets.data ? (
        <SkeletonCards count={2} />
      ) : !sets.data?.length ? (
        <EmptyState icon={<Swords className="size-6" />} title="No configured challenges">Automatic challenges are being used. Create one to control questions, dates and XP.</EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {sets.data.map((s) => {
            const live = s.is_active && today() >= s.available_from && today() <= s.available_to
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span className={cx('grid size-10 place-items-center rounded-xl', s.kind === 'daily' ? 'bg-saffron-soft text-saffron' : 'bg-maroon-soft text-maroon-ink')}>{s.kind === 'daily' ? <Target className="size-5" /> : <Swords className="size-5" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{s.title}</p>
                  <p className="text-xs text-ink-3 capitalize">{s.kind} · {fmtDate(s.available_from)} – {fmtDate(s.available_to)} · {s.question_ids.length} questions · {s.xp_base} XP + {s.xp_per_correct}/correct{s.pass_percentage ? ` · pass ${s.pass_percentage}%` : ''}</p>
                </div>
                <Pill tone={live ? 'success' : s.is_active ? 'gold' : 'neutral'}>{live ? 'Live today' : s.is_active ? 'Scheduled' : 'Inactive'}</Pill>
                <Button size="sm" variant="ghost" onClick={() => open(s)} aria-label="Edit"><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(s)} aria-label="Delete"><Trash2 className="size-4 text-danger" /></Button>
              </div>
            )
          })}
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit challenge' : 'New challenge'} size="lg" footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <Select label="Type" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as 'daily' | 'weekly', xp_base: e.target.value === 'weekly' ? 100 : 10, xp_per_correct: e.target.value === 'weekly' ? 5 : 4 })} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} />
              <Input label="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Input label="Available from" type="date" value={edit.available_from} onChange={(e) => setEdit({ ...edit, available_from: e.target.value })} />
              <Input label="Available to" type="date" value={edit.available_to} onChange={(e) => setEdit({ ...edit, available_to: e.target.value })} />
              <Input label="Base XP" type="number" min={0} value={edit.xp_base} onChange={(e) => setEdit({ ...edit, xp_base: Number(e.target.value) })} />
              <Input label="XP / correct" type="number" min={0} value={edit.xp_per_correct} onChange={(e) => setEdit({ ...edit, xp_per_correct: Number(e.target.value) })} />
              <Input label="Pass % (optional)" type="number" min={1} max={100} value={edit.pass_percentage} onChange={(e) => setEdit({ ...edit, pass_percentage: e.target.value })} />
            </div>
            <Toggle checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Active" />
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink-2">Questions ({edit.question_ids.length} selected)</p>
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter questions" className="h-9 rounded-lg border border-line bg-bg-elevated px-3 text-sm" />
              </div>
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-line p-3">
                {byChapter.map(([cid, c]) => (
                  <div key={cid}>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-3">Ch {c.position}. {c.title}</p>
                    {c.qs.filter((q) => !filter || q.prompt.toLowerCase().includes(filter.toLowerCase())).map((q) => (
                      <label key={q.id} className="flex items-start gap-2 py-1 text-sm text-ink">
                        <input type="checkbox" checked={edit.question_ids.includes(q.id)} onChange={() => toggleQ(q.id)} className="mt-0.5 size-4 accent-[var(--maroon)]" />
                        <span>{q.prompt}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
