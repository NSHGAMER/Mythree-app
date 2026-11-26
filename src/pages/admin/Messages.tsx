import { Check, Mail } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader, Pill, SkeletonCards } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { friendlyError } from '../../lib/errors'
import { fmtDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'

export default function AdminMessages() {
  useDocumentTitle('Messages')
  const { toast } = useApp()
  const { data, loading, reload } = useAsync(async () => {
    const { data, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) throw error
    return data
  }, [])

  async function markHandled(id: number) {
    const { error } = await supabase.from('contact_messages').update({ handled_at: new Date().toISOString() }).eq('id', id)
    if (error) return toast(friendlyError(error), 'error')
    reload()
  }

  return (
    <div>
      <PageHeader title="Contact messages" subtitle="Messages sent from the public contact form." />
      {loading && !data ? (
        <SkeletonCards count={3} />
      ) : !data?.length ? (
        <EmptyState icon={<Mail className="size-6" />} title="No messages yet" />
      ) : (
        <div className="space-y-3">
          {data.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{m.name}</p>
                  <p className="text-xs text-ink-3">
                    <a href={`mailto:${m.email}`} className="underline">{m.email}</a> {m.phone && `· ${m.phone}`} · {fmtDateTime(m.created_at)}
                  </p>
                </div>
                {m.handled_at ? <Pill tone="success">Handled</Pill> : <Button size="sm" variant="outline" icon={<Check className="size-4" />} onClick={() => markHandled(m.id)}>Mark handled</Button>}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{m.message}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
