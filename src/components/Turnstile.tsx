import { useEffect, useRef } from 'react'

// Cloudflare Turnstile (free CAPTCHA). Rendered only when VITE_TURNSTILE_SITE_KEY is set, so the app behaves
// exactly as before until the owner configures it. The token is passed to Supabase Auth (captchaToken), which
// verifies it with the secret key stored in Supabase – the secret never reaches the browser.
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || ''
export const captchaEnabled = TURNSTILE_SITE_KEY.length > 0

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loader: Promise<TurnstileApi> | null = null
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')))
    s.onerror = () => {
      loader = null
      reject(new Error('turnstile'))
    }
    document.head.appendChild(s)
  })
  return loader
}

/** Shows the Turnstile check and reports a fresh token (or null when it expires / fails). `resetKey` re-runs it. */
export function Turnstile({ onToken, resetKey = 0, action }: { onToken: (token: string | null) => void; resetKey?: number; action?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const cb = useRef(onToken)
  cb.current = onToken

  useEffect(() => {
    if (!captchaEnabled || !box.current) return
    let id: string | undefined
    let alive = true
    loadTurnstile()
      .then((t) => {
        if (!alive || !box.current) return
        id = t.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          callback: (token: string) => cb.current(token),
          'expired-callback': () => cb.current(null),
          'error-callback': () => cb.current(null),
        })
      })
      .catch(() => cb.current(null))
    return () => {
      alive = false
      if (id && window.turnstile) window.turnstile.remove(id)
    }
  }, [resetKey, action])

  if (!captchaEnabled) return null
  return <div ref={box} className="flex min-h-[65px] justify-center" data-testid="turnstile" />
}
