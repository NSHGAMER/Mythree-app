import { ArrowDown, ArrowUp, BookPlus, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, Input, Modal, PageHeader, Pill, SkeletonCards } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

interface ChapterRow {
  id: string
  position: number
  title: string
  title_sanskrit: string | null
  is_published: boolean
  pass_percentage: number
  questions: { count: number }[]
}

export default function AdminChapters() {
  useDocumentTitle('Chapters')
  const { toast } = useApp()
  const navigate = useNavigate()
  const { data, loading, error, reload, setData } = useAsync(async () => {
    const { data, error } = await supabase.from('chapters').select('id, position, title, title_sanskrit, is_published, pass_percentage, questions(count)').order('position')
    if (error) throw error
    return data as unknown as ChapterRow[]
  }, [])
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [del, setDel] = useState<ChapterRow | null>(null)
  const [busy, setBusy] = useState(false)

  async function create() {
    if (title.trim().length < 2) return
    setBusy(true)
    const next = (data?.reduce((m, c) => Math.max(m, c.position), 0) ?? 0) + 1
    const { data: row, error } = await supabase.from('chapters').insert({ title: title.trim(), position: next, is_published: false }).select('id').single()
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    setCreating(false)
    setTitle('')
    navigate(`/admin/chapters/${row.id}`)
  }

  async function togglePublish(c: ChapterRow) {
    const { error } = await supabase.from('chapters').update({ is_published: !c.is_published }).eq('id', c.id)
    if (error) return toast(friendlyError(error), 'error')
    toast(c.is_published ? 'Chapter hidden from members' : 'Chapter published')
    reload()
  }

  async function move(i: number, d: -1 | 1) {
    if (!data) return
    const arr = [...data]
    const j = i + d
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setData(arr.map((c, k) => ({ ...c, position: k + 1 })))
    try {
      await api.admin.reorderChapters(arr.map((c) => c.id))
    } catch (e) {
      toast(friendlyError(e), 'error')
      reload()
    }
  }

  async function remove() {
    if (!del) return
    setBusy(true)
    const { error } = await supabase.from('chapters').delete().eq('id', del.id)
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    toast('Chapter deleted')
    setDel(null)
    reload()
  }

  return (
    <div>
      <PageHeader title="Chapters & questions" subtitle="Organise the curriculum. Members see only published chapters, in this order." actions={<Button size="sm" icon={<BookPlus className="size-4" />} onClick={() => setCreating(true)}>New chapter</Button>} />
      {loading && !data ? (
        <SkeletonCards count={4} />
      ) : error ? (
        <EmptyState title="Couldn't load chapters">{friendlyError(error)}</EmptyState>
      ) : !data?.length ? (
        <EmptyState title="No chapters yet" action={<Button onClick={() => setCreating(true)}>Create the first chapter</Button>} />
      ) : (
        <Card className="divide-y divide-line">
          {data.map((c, i) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-0.5 text-ink-3 hover:bg-surface-2 disabled:opacity-30" aria-label="Move up"><ArrowUp className="size-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === data.length - 1} className="rounded p-0.5 text-ink-3 hover:bg-surface-2 disabled:opacity-30" aria-label="Move down"><ArrowDown className="size-4" /></button>
              </div>
              <span className="grid size-10 place-items-center rounded-full bg-maroon-soft font-bold text-maroon-ink">{c.position}</span>
              <div className="min-w-0 flex-1">
                <Link to={`/admin/chapters/${c.id}`} className="font-semibold text-ink hover:text-maroon-ink">{c.title}</Link>
                {c.title_sanskrit && <p lang="sa" className="sanskrit text-sm text-ink-3">{c.title_sanskrit}</p>}
              </div>
              <Pill tone="neutral">{c.questions?.[0]?.count ?? 0} questions</Pill>
              <Pill tone="neutral">Pass {c.pass_percentage}%</Pill>
              <Pill tone={c.is_published ? 'success' : 'gold'}>{c.is_published ? 'Published' : 'Draft'}</Pill>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => togglePublish(c)} aria-label={c.is_published ? 'Unpublish' : 'Publish'}>{c.is_published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/chapters/${c.id}`)} aria-label="Edit"><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setDel(c)} aria-label="Delete"><Trash2 className="size-4 text-danger" /></Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New chapter" size="sm" footer={<><Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button><Button loading={busy} onClick={create}>Create</Button></>}>
        <Input label="Chapter title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <p className="mt-2 text-xs text-ink-3">New chapters start as drafts. Add questions, then publish.</p>
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete chapter?" size="sm" footer={<><Button variant="outline" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={remove}>Delete</Button></>}>
        <p className="text-sm text-ink-2">
          “{del?.title}” and all its questions, attempts and member progress for it will be permanently deleted. To keep history, unpublish it instead.
        </p>
      </Modal>
    </div>
  )
}
