import { Bell, CheckCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, cx, EmptyState, PageHeader, SkeletonCards } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { friendlyError } from '../../lib/errors'
import { relativeTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'

export default function AdminNotifications() {
  useDocumentTitle('Notifications')
  const { toast } = useApp()
  const { data, loading, reload } = useAsync(async () => {
    const { data, error } = await supabase.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(200)
    if (error) throw error
    return data
  }, [])

  async function markAll() {
    const { error } = await supabase.from('admin_notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    if (error) return toast(friendlyError(error), 'error')
    reload()
  }
  async function markOne(id: number) {
    await supabase.from('admin_notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    reload()
  }

  return (
    <div>
      <PageHeader title="Notifications" actions={<Button size="sm" variant="secondary" icon={<CheckCheck className="size-4" />} onClick={markAll}>Mark all read</Button>} />
      {loading && !data ? (
        <SkeletonCards count={3} />
      ) : !data?.length ? (
        <EmptyState icon={<Bell className="size-6" />} title="All caught up" />
      ) : (
        <Card className="divide-y divide-line">
          {data.map((n) => (
            <div key={n.id} className={cx('flex items-start gap-3 px-5 py-4', !n.read_at && 'bg-gold-soft/40')}>
              <span className={cx('mt-1.5 size-2.5 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-maroon')} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{n.title}</p>
                {n.body && <p className="text-sm text-ink-2">{n.body}</p>}
                <p className="mt-1 text-xs text-ink-3">{relativeTime(n.created_at)}</p>
              </div>
              {n.link && (
                <Link to={n.link} onClick={() => markOne(n.id)} className="text-sm font-semibold text-maroon-ink hover:underline">Open</Link>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
