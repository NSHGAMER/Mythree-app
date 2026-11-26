import { ArrowLeft, Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Card, cx, EmptyState, Input, Modal, PageHeader, Pill, Select, SkeletonCards, Textarea, Toggle } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { QuestionType } from '../../types'

interface ChapterForm {
  title: string
  title_sanskrit: string
  description: string
  textbook_reference: string
  learning_objectives: string
  pass_percentage: number
  questions_per_test: string
  time_limit_minutes: string
  xp_reward: number
  is_published: boolean
}

interface QRow {
  id?: string
  type: QuestionType
  prompt: string
  options: string[]
  accepted_answers: string[]
  explanation: string
  difficulty: number
  is_active: boolean
}

const EMPTY_Q: QRow = { type: 'mcq', prompt: '', options: ['', '', '', ''], accepted_answers: ['0'], explanation: '', difficulty: 1, is_active: true }

export default function AdminChapterEditor() {
  const { id } = useParams()
  const { toast } = useApp()
  const chapter = useAsync(async () => {
    const { data, error } = await supabase.from('chapters').select('*').eq('id', id!).single()
    if (error) throw error
    return data
  }, [id])
  const questions = useAsync(async () => {
    const { data, error } = await supabase.from('questions').select('id, type, prompt, options, difficulty, is_active, position, question_keys(accepted_answers, explanation)').eq('chapter_id', id!).order('position').order('created_at')
    if (error) throw error
    return (data ?? []).map((q) => {
      const key = (q as unknown as { question_keys: { accepted_answers: string[]; explanation: string | null } | null }).question_keys
      return { ...q, accepted_answers: key?.accepted_answers ?? [], explanation: key?.explanation ?? '' } as unknown as QRow & { position: number }
    })
  }, [id])
  const [form, setForm] = useState<ChapterForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [editQ, setEditQ] = useState<QRow | null>(null)
  const [qBusy, setQBusy] = useState(false)
  const [qErr, setQErr] = useState('')
  useDocumentTitle(form?.title ?? 'Edit chapter')

  useEffect(() => {
    const c = chapter.data
    if (!c) return
    setForm({
      title: c.title,
      title_sanskrit: c.title_sanskrit ?? '',
      description: c.description ?? '',
      textbook_reference: c.textbook_reference ?? '',
      learning_objectives: (c.learning_objectives ?? []).join('\n'),
      pass_percentage: c.pass_percentage,
      questions_per_test: c.questions_per_test ? String(c.questions_per_test) : '',
      time_limit_minutes: c.time_limit_minutes ? String(c.time_limit_minutes) : '',
      xp_reward: c.xp_reward,
      is_published: c.is_published,
    })
  }, [chapter.data])

  if (chapter.loading && !chapter.data) return <SkeletonCards count={2} />
  if (chapter.error || !form) return <EmptyState title="Chapter not found">{friendlyError(chapter.error)}</EmptyState>

  const set = <K extends keyof ChapterForm>(k: K, v: ChapterForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  async function saveChapter() {
    if (!form) return
    setSaving(true)
    const { error } = await supabase
      .from('chapters')
      .update({
        title: form.title.trim(),
        title_sanskrit: form.title_sanskrit.trim() || null,
        description: form.description.trim() || null,
        textbook_reference: form.textbook_reference.trim() || null,
        learning_objectives: form.learning_objectives.split('\n').map((s) => s.trim()).filter(Boolean),
        pass_percentage: Number(form.pass_percentage),
        questions_per_test: form.questions_per_test ? Number(form.questions_per_test) : null,
        time_limit_minutes: form.time_limit_minutes ? Number(form.time_limit_minutes) : null,
        xp_reward: Number(form.xp_reward),
        is_published: form.is_published,
      })
      .eq('id', id!)
    setSaving(false)
    if (error) return toast(friendlyError(error), 'error')
    toast('Chapter saved')
  }

  async function saveQuestion() {
    if (!editQ) return
    setQErr('')
    if (editQ.prompt.trim().length < 1) return setQErr('Enter the question text.')
    const options = editQ.type === 'mcq' ? editQ.options.map((o) => o.trim()).filter(Boolean) : []
    if (editQ.type === 'mcq' && options.length < 2) return setQErr('Add at least two options.')
    setQBusy(true)
    try {
      await api.admin.saveQuestion({
        id: editQ.id ?? null,
        chapter_id: id,
        type: editQ.type,
        prompt: editQ.prompt,
        options,
        accepted_answers: editQ.accepted_answers.map((a) => a.trim()).filter(Boolean),
        explanation: editQ.explanation,
        difficulty: editQ.difficulty,
        is_active: editQ.is_active,
        position: editQ.id ? undefined : (questions.data?.length ?? 0),
      })
      toast('Question saved')
      setEditQ(null)
      questions.reload()
    } catch (e) {
      setQErr(friendlyError(e))
    } finally {
      setQBusy(false)
    }
  }

  async function deleteQuestion(qid: string) {
    if (!confirm('Delete this question? Past attempts keep their recorded scores.')) return
    const { error } = await supabase.from('questions').delete().eq('id', qid)
    if (error) return toast(friendlyError(error), 'error')
    toast('Question deleted')
    questions.reload()
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/chapters" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-ink"><ArrowLeft className="size-4" /> Chapters</Link>
      <PageHeader title={`Chapter ${chapter.data?.position}: ${form.title}`} actions={<Button loading={saving} icon={<Save className="size-4" />} onClick={saveChapter}>Save chapter</Button>} />

      <Card className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Input label="Title (English)" value={form.title} onChange={(e) => set('title', e.target.value)} required />
        <Input label="Title (Sanskrit)" value={form.title_sanskrit} onChange={(e) => set('title_sanskrit', e.target.value)} lang="sa" />
        <Textarea label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} wrapperClass="sm:col-span-2" rows={3} />
        <Input label="Textbook reference" value={form.textbook_reference} onChange={(e) => set('textbook_reference', e.target.value)} hint="e.g. Textbook pages 12–24" />
        <Textarea label="Learning objectives (one per line)" value={form.learning_objectives} onChange={(e) => set('learning_objectives', e.target.value)} rows={3} />
        <div className="grid grid-cols-2 gap-4 sm:col-span-2 lg:grid-cols-4">
          <Input label="Pass mark %" type="number" min={1} max={100} value={form.pass_percentage} onChange={(e) => set('pass_percentage', Number(e.target.value))} hint="Completion criterion" />
          <Input label="Questions per test" type="number" min={1} value={form.questions_per_test} onChange={(e) => set('questions_per_test', e.target.value)} hint="Blank = all questions" />
          <Input label="Time limit (min)" type="number" min={1} value={form.time_limit_minutes} onChange={(e) => set('time_limit_minutes', e.target.value)} hint="Blank = no limit" />
          <Input label="XP reward" type="number" min={0} max={1000} value={form.xp_reward} onChange={(e) => set('xp_reward', Number(e.target.value))} />
        </div>
        <div className="sm:col-span-2">
          <Toggle checked={form.is_published} onChange={(v) => set('is_published', v)} label="Published" description="Visible to members in the learning path" />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-ink">Questions ({questions.data?.length ?? 0})</h2>
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditQ({ ...EMPTY_Q, options: ['', '', '', ''] })}>Add question</Button>
      </div>
      {questions.loading && !questions.data ? (
        <SkeletonCards count={2} />
      ) : !questions.data?.length ? (
        <EmptyState title="No questions yet">Add questions so members can take this chapter’s test.</EmptyState>
      ) : (
        <div className="space-y-3">
          {questions.data.map((q, i) => (
            <Card key={q.id} className={cx('p-4 sm:p-5', !q.is_active && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-bold text-ink-2">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{q.prompt}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill tone="neutral">{q.type === 'mcq' ? 'Multiple choice' : q.type === 'true_false' ? 'True / False' : 'Fill in the blank'}</Pill>
                    {!q.is_active && <Pill tone="gold">Inactive</Pill>}
                    <Pill tone="success">
                      Answer: {q.type === 'mcq' ? q.options[Number(q.accepted_answers[0])] : q.type === 'true_false' ? (q.accepted_answers[0] === 'true' ? 'True' : 'False') : q.accepted_answers.join(' / ')}
                    </Pill>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditQ({ ...q, options: q.type === 'mcq' ? [...q.options] : ['', '', '', ''], explanation: q.explanation ?? '' })}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteQuestion(q.id!)} aria-label="Delete question"><Trash2 className="size-4 text-danger" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editQ} onClose={() => setEditQ(null)} title={editQ?.id ? 'Edit question' : 'New question'} size="lg" footer={<><Button variant="outline" onClick={() => setEditQ(null)}>Cancel</Button><Button loading={qBusy} onClick={saveQuestion}>Save question</Button></>}>
        {editQ && (
          <div className="space-y-4">
            {qErr && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{qErr}</p>}
            <Select
              label="Type"
              value={editQ.type}
              onChange={(e) => {
                const t = e.target.value as QuestionType
                setEditQ({ ...editQ, type: t, accepted_answers: t === 'mcq' ? ['0'] : t === 'true_false' ? ['true'] : [''] })
              }}
              options={[{ value: 'mcq', label: 'Multiple choice' }, { value: 'true_false', label: 'True / False' }, { value: 'fill_blank', label: 'Fill in the blank' }]}
            />
            <Textarea label="Question" value={editQ.prompt} onChange={(e) => setEditQ({ ...editQ, prompt: e.target.value })} rows={2} maxLength={1000} />
            {editQ.type === 'mcq' && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink-2">Options – select the correct one</legend>
                <div className="space-y-2">
                  {editQ.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="radio" name="correct" checked={editQ.accepted_answers[0] === String(i)} onChange={() => setEditQ({ ...editQ, accepted_answers: [String(i)] })} className="size-5 accent-[var(--success)]" aria-label={`Option ${i + 1} is correct`} />
                      <input value={o} onChange={(e) => setEditQ({ ...editQ, options: editQ.options.map((x, k) => (k === i ? e.target.value : x)) })} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="h-11 flex-1 rounded-xl border border-line bg-bg-elevated px-3 text-sm text-ink focus:border-gold focus:outline-none" />
                      {editQ.options.length > 2 && (
                        <button type="button" onClick={() => setEditQ({ ...editQ, options: editQ.options.filter((_, k) => k !== i), accepted_answers: [String(Math.max(0, Math.min(Number(editQ.accepted_answers[0]) - (Number(editQ.accepted_answers[0]) > i ? 1 : 0), editQ.options.length - 2)))] })} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2" aria-label="Remove option"><X className="size-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
                {editQ.options.length < 6 && <Button size="sm" variant="ghost" className="mt-2" icon={<Plus className="size-4" />} onClick={() => setEditQ({ ...editQ, options: [...editQ.options, ''] })}>Add option</Button>}
              </fieldset>
            )}
            {editQ.type === 'true_false' && (
              <Select label="Correct answer" value={editQ.accepted_answers[0]} onChange={(e) => setEditQ({ ...editQ, accepted_answers: [e.target.value] })} options={[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]} />
            )}
            {editQ.type === 'fill_blank' && (
              <Input label="Accepted answers (separate with | )" value={editQ.accepted_answers.join(' | ')} onChange={(e) => setEditQ({ ...editQ, accepted_answers: e.target.value.split('|') })} hint="Case and extra spaces are ignored. Add Devanāgarī and transliterated forms, e.g. अहम् | aham" />
            )}
            <Textarea label="Explanation shown after submission" value={editQ.explanation} onChange={(e) => setEditQ({ ...editQ, explanation: e.target.value })} rows={2} maxLength={2000} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Difficulty" value={String(editQ.difficulty)} onChange={(e) => setEditQ({ ...editQ, difficulty: Number(e.target.value) })} options={[{ value: '1', label: 'Easy' }, { value: '2', label: 'Medium' }, { value: '3', label: 'Hard' }]} />
              <div className="pt-7"><Toggle checked={editQ.is_active} onChange={(v) => setEditQ({ ...editQ, is_active: v })} label="Active" /></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
