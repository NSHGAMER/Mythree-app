import { CalendarClock, CheckCircle2, Clock, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, cx, EmptyState, PageHeader, ProgressBar, SkeletonCards } from '../../components/ui'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { fmtDateTime } from '../../lib/format'
import { fmtDuration } from '../../lib/video'

export default function VideosPage() {
  useDocumentTitle('Video classes')
  const { data, loading, error } = useAsync(() => api.myVideos(), [])
  const videos = data?.videos ?? []
  const done = videos.filter((v) => v.completed_at).length
  const pct = videos.length ? (done / videos.length) * 100 : 0

  return (
    <div>
      <PageHeader title="Video classes" sanskrit="चलचित्रपाठाः" subtitle="Lessons appear here in order as they are published. Watch at least the required part of each lesson to complete it." />
      {loading && !data ? (
        <SkeletonCards count={3} />
      ) : error ? (
        <EmptyState title="Couldn't load lessons">{friendlyError(error)}</EmptyState>
      ) : (
        <>
          <Card className="mb-6 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-ink">{done} of {videos.length} lessons completed · {videos.length - done} remaining</span>
              <span className="font-bold text-maroon-ink">{Math.round(pct)}%</span>
            </div>
            <ProgressBar value={pct} className="mt-2" size="lg" label="Video lessons completed" />
          </Card>
          {videos.length === 0 ? (
            <EmptyState icon={<PlayCircle className="size-6" />} title="No lessons published yet">New video classes will appear here when they are released.</EmptyState>
          ) : (
            <div className="space-y-3">
              {videos.map((v) => {
                const watchedPct = Math.min(100, (v.watched_seconds / v.duration_seconds) * 100)
                return (
                  <Link key={v.id} to={`/app/videos/${v.id}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:p-5">
                    <span className={cx('grid size-12 shrink-0 place-items-center rounded-2xl', v.completed_at ? 'bg-success-soft text-success' : 'bg-maroon-soft text-maroon-ink')}>
                      {v.completed_at ? <CheckCircle2 className="size-6" /> : <PlayCircle className="size-6" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{v.position}. {v.title}</p>
                      {v.title_sanskrit && <p lang="sa" className="sanskrit truncate text-sm text-ink-3">{v.title_sanskrit}</p>}
                      <div className="mt-2 flex items-center gap-3">
                        <ProgressBar value={watchedPct} size="sm" tone={v.completed_at ? 'success' : 'gold'} className="max-w-48" label={`Watched ${Math.round(watchedPct)}%`} />
                        <span className="flex items-center gap-1 text-xs text-ink-3"><Clock className="size-3.5" />{fmtDuration(v.duration_seconds)}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
          {data!.upcoming.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 flex items-center gap-2 text-lg text-ink"><CalendarClock className="size-5 text-gold" /> Coming soon</h2>
              <Card className="divide-y divide-line">
                {data!.upcoming.map((u) => (
                  <div key={`${u.position}-${u.publish_at}`} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-ink-2">{u.position}. {u.title}</span>
                    <span className="text-ink-3">{fmtDateTime(u.publish_at)}</span>
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
