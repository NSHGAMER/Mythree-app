import { MessageCircleQuestion, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, EmptyState, Input, Modal, PageHeader, Pill, SkeletonCards, Tabs, Textarea, Toggle } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { friendlyError } from '../../lib/errors'
import { fmtDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Faq } from '../../types'

const EMPTY: Omit<Faq, 'id'> & { id?: string } = { question: '', answer: '', keywords: [], category: 'General', is_published: true, sort_order: 0 }

export default function AdminFaqs() {
  useDocumentTitle('Chatbot FAQs')
  const { toast } = useApp()
  const [tab, setTab] = useState<'faqs' | 'unanswered'>('faqs')
  const faqs = useAsync(async () => {
    const { data, error } = await supabase.from('faqs').select('id, question, answer, keywords, category, is_published, sort_order').order('category').order('sort_order')
    if (error) throw error
    return data as Faq[]
  }, [])
  const unanswered = useAsync(async () => {
    const { data } = await supabase.from('chatbot_queries').select('id, query, created_at').is('matched_faq_id', null).order('created_at', { ascending: false }).limit(200)
    return data ?? []
  }, [])
  const [edit, setEdit] = useState<(Omit<Faq, 'id'> & { id?: string }) | null>(null)
  const [kw, setKw] = useState('')
  const [busy, setBusy] = useState(false)

  function open(f: Omit<Faq, 'id'> & { id?: string }) {
    setEdit(f)
    setKw(f.keywords.join(', '))
  }

  async function save() {
    if (!edit) return
    if (edit.question.trim().length < 3 || edit.answer.trim().length < 1) return toast('Question and answer are required', 'error')
    setBusy(true)
    const row = { question: edit.question.trim(), answer: edit.answer.trim(), category: edit.category.trim() || 'General', is_published: edit.is_published, sort_order: Number(edit.sort_order) || 0, keywords: kw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) }
    const { error } = edit.id ? await supabase.from('faqs').update(row).eq('id', edit.id) : await supabase.from('faqs').insert(row)
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    toast('FAQ saved – the chatbot uses it immediately')
    setEdit(null)
    faqs.reload()
  }

  async function remove(f: Faq) {
    if (!confirm(`Delete “${f.question}”?`)) return
    const { error } = await supabase.from('faqs').delete().eq('id', f.id)
    if (error) return toast(friendlyError(error), 'error')
    toast('FAQ deleted')
    faqs.reload()
  }

  return (
    <div>
      <PageHeader
        title="Chatbot FAQs"
        subtitle="The help assistant answers only from these approved FAQs. Changes apply instantly – no code changes needed."
        actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => open({ ...EMPTY })}>New FAQ</Button>}
      />
      <Tabs className="mb-5" value={tab} onChange={setTab} items={[{ value: 'faqs', label: `FAQs (${faqs.data?.length ?? 0})` }, { value: 'unanswered', label: `Unanswered questions (${unanswered.data?.length ?? 0})` }]} />
      {tab === 'faqs' ? (
        faqs.loading && !faqs.data ? (
          <SkeletonCards count={3} />
        ) : !faqs.data?.length ? (
          <EmptyState icon={<MessageCircleQuestion className="size-6" />} title="No FAQs yet" action={<Button onClick={() => open({ ...EMPTY })}>Add the first FAQ</Button>} />
        ) : (
          <div className="space-y-3">
            {faqs.data.map((f) => (
              <Card key={f.id} className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-1.5">
                      <Pill tone="maroon">{f.category}</Pill>
                      {!f.is_published && <Pill tone="gold">Hidden</Pill>}
                    </div>
                    <p className="font-semibold text-ink">{f.question}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-3">{f.answer}</p>
                    {f.keywords.length > 0 && <p className="mt-1.5 text-xs text-ink-3">Keywords: {f.keywords.join(', ')}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => open(f)} aria-label="Edit"><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(f)} aria-label="Delete"><Trash2 className="size-4 text-danger" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : !unanswered.data?.length ? (
        <EmptyState title="No unanswered questions">Questions the chatbot could not answer confidently will appear here.</EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {unanswered.data.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <p className="min-w-0 flex-1 text-sm text-ink">“{u.query}”</p>
              <span className="text-xs text-ink-3">{fmtDateTime(u.created_at)}</span>
              <Button size="sm" variant="outline" onClick={() => open({ ...EMPTY, question: u.query })}>Create FAQ</Button>
            </div>
          ))}
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit FAQ' : 'New FAQ'} size="lg" footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save FAQ</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Input label="Question" value={edit.question} onChange={(e) => setEdit({ ...edit, question: e.target.value })} maxLength={300} />
            <Textarea label="Approved answer" value={edit.answer} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} rows={5} maxLength={4000} />
            <Input label="Keywords (comma separated)" value={kw} onChange={(e) => setKw(e.target.value)} hint="Words members might use, e.g. fee, payment, donate" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Category" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
              <Input label="Sort order" type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} />
            </div>
            <Toggle checked={edit.is_published} onChange={(v) => setEdit({ ...edit, is_published: v })} label="Published" description="Hidden FAQs are never used by the chatbot" />
          </div>
        )}
      </Modal>
    </div>
  )
}
