import { ArrowLeft, CheckCircle2, Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Card, EmptyState, ProgressBar, SkeletonCards } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api, invalidateLearning } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { fmtDuration, loadYouTube, type YTPlayer } from '../../lib/video'

const HEARTBEAT_MS = 10_000

/**
 * Plays a lesson and reports the playback position every 10 s. The SERVER decides how much was watched:
 * it only credits forward playback at real-time speed, so seeking ahead or refreshing cannot complete a lesson.
 */
export default function VideoLessonPage() {
  const { id } = useParams()
  const { toast } = useApp()
  const { data, loading, error } = useAsync(() => api.myVideos(), [id])
  const video = data?.videos.find((v) => v.id === id)
  useDocumentTitle(video?.title ?? 'Video class')
  const holder = useRef<HTMLDivElement>(null)
  const mp4 = useRef<HTMLVideoElement>(null)
  const yt = useRef<YTPlayer | null>(null)
  const [progress, setProgress] = useState<{ watched: number; completed: boolean } | null>(null)
  const [playerErr, setPlayerErr] = useState('')
  const lastSent = useRef(0)
  const completedRef = useRef(false)

  const watched = progress?.watched ?? video?.watched_seconds ?? 0
  const completed = progress?.completed ?? !!video?.completed_at

  async function send(position: number) {
    if (!video || !navigator.onLine) return
    lastSent.current = Date.now()
    try {
      const r = await api.recordVideoProgress(video.id, Math.floor(position))
      if (r.completed && !completedRef.current && !video.completed_at) {
        completedRef.current = true
        invalidateLearning()
        toast('Lesson completed! +15 XP')
      }
      setProgress({ watched: r.watched_seconds, completed: r.completed })
    } catch {
      /* transient: the next heartbeat retries; progress is never claimed client-side */
    }
  }

  // YouTube player
  useEffect(() => {
    if (!video || video.provider !== 'youtube' || !holder.current) return
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined
    loadYouTube()
      .then((YT) => {
        if (cancelled || !holder.current) return
        yt.current = new YT.Player(holder.current, {
          videoId: video.video_ref,
          host: 'https://www.youtube-nocookie.com',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: Math.max(0, video.last_position - 2) },
          events: {
            onStateChange: (e: { data: number }) => {
              if (e.data === YT.PlayerState.PLAYING) {
                send(yt.current!.getCurrentTime())
                clearInterval(timer)
                timer = setInterval(() => send(yt.current!.getCurrentTime()), HEARTBEAT_MS)
              } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                clearInterval(timer)
                send(yt.current!.getCurrentTime())
              }
            },
          },
        })
      })
      .catch((e) => setPlayerErr(friendlyError(e)))
    return () => {
      cancelled = true
      clearInterval(timer)
      yt.current?.destroy()
      yt.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id])

  // Direct MP4 player
  useEffect(() => {
    const el = mp4.current
    if (!video || video.provider !== 'url' || !el) return
    let timer: ReturnType<typeof setInterval> | undefined
    const onPlay = () => {
      send(el.currentTime)
      clearInterval(timer)
      timer = setInterval(() => send(el.currentTime), HEARTBEAT_MS)
    }
    const onStop = () => {
      clearInterval(timer)
      send(el.currentTime)
    }
    el.currentTime = Math.max(0, video.last_position - 2)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onStop)
    el.addEventListener('ended', onStop)
    return () => {
      clearInterval(timer)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onStop)
      el.removeEventListener('ended', onStop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id])

  if (loading && !data) return <SkeletonCards count={1} />
  if (error) return <EmptyState title="Couldn't load this lesson">{friendlyError(error)}</EmptyState>
  if (!video) return <EmptyState title="Lesson not available" action={<Link to="/app/videos" className="font-semibold text-maroon-ink underline">All lessons</Link>}>It may not be published yet.</EmptyState>

  const pct = Math.min(100, (watched / video.duration_seconds) * 100)
  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/app/videos" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-ink"><ArrowLeft className="size-4" /> All lessons</Link>
      <Card className="overflow-hidden">
        <div className="aspect-video w-full bg-black">
          {video.provider === 'youtube' ? (
            <div ref={holder} className="size-full" />
          ) : (
            <video ref={mp4} src={video.video_ref} controls playsInline preload="metadata" className="size-full" controlsList="nodownload" />
          )}
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-ink">Lesson {video.position}</p>
          <h1 className="mt-1 text-2xl text-ink sm:text-3xl">{video.title}</h1>
          {video.title_sanskrit && <p lang="sa" className="sanskrit text-lg text-maroon-ink">{video.title_sanskrit}</p>}
          {playerErr && <Alert tone="danger" className="mt-4">{playerErr}</Alert>}
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-sm"><span className="text-ink-2">Watched {fmtDuration(watched)} of {fmtDuration(video.duration_seconds)}</span><span className="font-semibold text-ink">{Math.round(pct)}%</span></div>
            <ProgressBar value={pct} tone={completed ? 'success' : 'gold'} label="Watched" />
          </div>
          {completed ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="size-4" /> Completed</p>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-xs text-ink-3"><Info className="mt-0.5 size-4 shrink-0" /> Watch at least {video.completion_percentage}% of the lesson to complete it. Skipping ahead does not count; you can resume where you left off.</p>
          )}
          {video.description && <p className="mt-4 whitespace-pre-line text-sm text-ink-2">{video.description}</p>}
        </div>
      </Card>
    </div>
  )
}
