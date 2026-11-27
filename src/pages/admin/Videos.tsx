import { Pencil, Plus, Trash2, Video } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, PageHeader, Pill, Select, SkeletonCards, Textarea, Toggle } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { fmtDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { fmtDuration, youtubeId } from '../../lib/video'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Form {
  id?: string
  position: number
  title: string
  title_sanskrit: string
  description: string
  provider: 'youtube' | 'url'
  video_ref: string
  duration_min: string
  duration_sec: string
  publish_at: string
  is_published: boolean
  completion_percentage: number
}

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export default function AdminVideos() {
  useDocumentTitle('Video lessons')
  const { toast } = useApp()
  const list = useAsync(async () => {
    const { data, error } = await supabase.from('video_lessons').select('*').order('position').order('publish_at')
    if (error) throw error
    return data as any[]
  }, [])
  const stats = useAsync(() => api.admin.videoStats() as Promise<any[]>, [])
  const statFor = (id: string) => (stats.data ?? []).find((s) => s.id === id)
  const [edit, setEdit] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function open(v?: any) {
    setErr('')
    setEdit(
      v
        ? { id: v.id, position: v.position, title: v.title, title_sanskrit: v.title_sanskrit ?? '', description: v.description ?? '', provider: v.provider, video_ref: v.video_ref, duration_min: String(Math.floor(v.duration_seconds / 60)), duration_sec: String(v.duration_seconds % 60), publish_at: toLocalInput(v.publish_at), is_published: v.is_published, completion_percentage: v.completion_percentage }
        : { position: (list.data?.reduce((m, x) => Math.max(m, x.position), 0) ?? 0) + 1, title: '', title_sanskrit: '', description: '', provider: 'youtube', video_ref: '', duration_min: '', duration_sec: '0', publish_at: toLocalInput(new Date().toISOString()), is_published: true, completion_percentage: 90 },
    )
  }

  async function save() {
    if (!edit) return
    const ref = edit.provider === 'youtube' ? youtubeId(edit.video_ref) : edit.video_ref.trim()
    const duration = Number(edit.duration_min || 0) * 60 + Number(edit.duration_sec || 0)
    if (edit.title.trim().length < 2) return setErr('Enter a title.')
    if (!ref) return setErr(edit.provider === 'youtube' ? 'Paste a valid YouTube link or video ID.' : 'Enter the video URL.')
    if (edit.provider === 'url' && !/^https:\/\//.test(ref)) return setErr('Video URLs must start with https://')
    if (duration < 10) return setErr('Enter the video length (minutes and seconds).')
    setBusy(true)
    const row = {
      position: Number(edit.position), title: edit.title.trim(), title_sanskrit: edit.title_sanskrit.trim() || null, description: edit.description.trim() || null,
      provider: edit.provider, video_ref: ref, duration_seconds: duration, publish_at: new Date(edit.publish_at).toISOString(),
      is_published: edit.is_published, completion_percentage: Number(edit.completion_percentage),
    }
    const { error } = edit.id ? await supabase.from('video_lessons').update(row).eq('id', edit.id) : await supabase.from('video_lessons').insert(row)
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    toast('Lesson saved')
    setEdit(null)
    list.reload()
    stats.reload()
  }

  async function remove(v: any) {
    if (!confirm(`Delete “${v.title}”? Members' watch progress for this lesson will also be removed. To keep it, unpublish instead.`)) return
    const { error } = await supabase.from('video_lessons').delete().eq('id', v.id)
    if (error) return toast(friendlyError(error), 'error')
    toast('Lesson deleted')
    list.reload()
  }

  return (
    <div>
      <PageHeader
        title="Video lessons"
        subtitle="Lessons are shown in order. Members see a lesson only after its publish time and only once their registration is confirmed."
        actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => open()}>New lesson</Button>}
      />
      <Card className="mb-4 p-4 text-sm text-ink-2">
        <strong>Hosting:</strong> upload videos to YouTube as <em>Unlisted</em> and paste the link here (free, unlimited streaming). Unlisted videos are hidden from search but anyone with the link can watch them. Alternatively use a direct https MP4 link from your own storage.
      </Card>
      {list.loading && !list.data ? (
        <SkeletonCards count={3} />
      ) : !list.data?.length ? (
        <EmptyState icon={<Video className="size-6" />} title="No lessons yet" action={<Button onClick={() => open()}>Add the first lesson</Button>} />
      ) : (
        <Card className="divide-y divide-line">
          {list.data.map((v) => {
            const s = statFor(v.id)
            const scheduled = new Date(v.publish_at) > new Date()
            return (
              <div key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid size-10 place-items-center rounded-full bg-maroon-soft font-bold text-maroon-ink">{v.position}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{v.title}</p>
                  <p className="text-xs text-ink-3">{v.provider === 'youtube' ? 'YouTube' : 'MP4'} · {fmtDuration(v.duration_seconds)} · complete at {v.completion_percentage}% · publishes {fmtDateTime(v.publish_at)}</p>
                </div>
                {!v.is_published ? <Pill tone="neutral">Hidden</Pill> : scheduled ? <Pill tone="gold">Scheduled</Pill> : <Pill tone="success">Live</Pill>}
                {s && <Pill tone="info">{s.completed}/{s.started} completed · avg {s.avg_watched_pct ?? 0}%</Pill>}
                <Button size="sm" variant="ghost" onClick={() => open(v)} aria-label="Edit"><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(v)} aria-label="Delete"><Trash2 className="size-4 text-danger" /></Button>
              </div>
            )
          })}
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit lesson' : 'New lesson'} size="lg" footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save lesson</Button></>}>
        {edit && (
          <div className="space-y-4">
            {err && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
            <div className="grid gap-4 sm:grid-cols-[6rem_1fr]">
              <Input label="Order" type="number" min={1} value={edit.position} onChange={(e) => setEdit({ ...edit, position: Number(e.target.value) })} />
              <Input label="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </div>
            <Input label="Title (Sanskrit, optional)" value={edit.title_sanskrit} onChange={(e) => setEdit({ ...edit, title_sanskrit: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <Select label="Source" value={edit.provider} onChange={(e) => setEdit({ ...edit, provider: e.target.value as 'youtube' | 'url' })} options={[{ value: 'youtube', label: 'YouTube (unlisted)' }, { value: 'url', label: 'MP4 link' }]} />
              <Input label={edit.provider === 'youtube' ? 'YouTube link or video ID' : 'https:// link to MP4'} value={edit.video_ref} onChange={(e) => setEdit({ ...edit, video_ref: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Input label="Length – minutes" type="number" min={0} value={edit.duration_min} onChange={(e) => setEdit({ ...edit, duration_min: e.target.value })} />
              <Input label="seconds" type="number" min={0} max={59} value={edit.duration_sec} onChange={(e) => setEdit({ ...edit, duration_sec: e.target.value })} />
              <Input label="Complete at (%)" type="number" min={50} max={100} value={edit.completion_percentage} onChange={(e) => setEdit({ ...edit, completion_percentage: Number(e.target.value) })} />
              <Input label="Publish at" type="datetime-local" value={edit.publish_at} onChange={(e) => setEdit({ ...edit, publish_at: e.target.value })} />
            </div>
            <Textarea label="Description" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={3} />
            <Toggle checked={edit.is_published} onChange={(v) => setEdit({ ...edit, is_published: v })} label="Published" description="Hidden lessons are never shown to members, even after the publish time" />
          </div>
        )}
      </Modal>
    </div>
  )
}
