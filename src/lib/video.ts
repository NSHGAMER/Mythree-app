// Video helpers: YouTube id parsing and a lazy loader for the YouTube IFrame Player API.

export function youtubeId(input: string): string | null {
  const s = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  try {
    const u = new URL(s)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1, 12) || null
    if (u.hostname.endsWith('youtube.com') || u.hostname.endsWith('youtube-nocookie.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v')!.slice(0, 11)
      const m = u.pathname.match(/\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})/)
      if (m) return m[2]
    }
  } catch {
    /* not a URL */
  }
  return null
}

export function fmtDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

/** Mirrors the server rule: completed when watched ≥ completion % of the duration. */
export function isVideoComplete(watchedSeconds: number, durationSeconds: number, completionPct: number) {
  return durationSeconds > 0 && watchedSeconds * 100 >= durationSeconds * completionPct
}

interface YTPlayer {
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  seekTo(s: number, allowSeekAhead: boolean): void
  destroy(): void
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let ytLoader: Promise<YTNamespace> | null = null
export function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (ytLoader) return ytLoader
  ytLoader = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT!)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      ytLoader = null
      reject(new Error('Could not load the video player. Check your connection.'))
    }
    document.head.appendChild(s)
  })
  return ytLoader
}
export type { YTPlayer }
