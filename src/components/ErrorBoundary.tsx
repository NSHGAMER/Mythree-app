import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Catches render errors and shows the branded 500 page instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Mythree] Unhandled UI error', error, info.componentStack)
    // A stale lazy chunk after a deploy: reload once to pick up the new build.
    if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(error.message)) {
      try {
        if (!sessionStorage.getItem('mythree-chunk-reload')) {
          sessionStorage.setItem('mythree-chunk-reload', '1')
          window.location.reload()
        }
      } catch {
        /* ignore */
      }
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)', color: 'var(--ink)', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: 440 }}>
          <img src="/images/logo.webp" alt="" width={88} height={88} style={{ margin: '0 auto 16px', borderRadius: 999 }} />
          <p style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold-ink)', fontWeight: 700 }}>Error 500</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, margin: '8px 0' }}>Something went wrong</h1>
          <p style={{ color: 'var(--ink-3)', fontSize: 15 }}>
            An unexpected error occurred. Your learning progress is saved on our servers and is safe. Please reload the page.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
            <button onClick={() => window.location.reload()} style={{ background: 'var(--maroon)', color: 'var(--on-primary)', border: 0, borderRadius: 12, padding: '12px 20px', fontWeight: 700, cursor: 'pointer' }}>
              Reload
            </button>
            <a href="/" style={{ border: '1px solid var(--border-strong)', borderRadius: 12, padding: '12px 20px', fontWeight: 700, color: 'var(--ink)', textDecoration: 'none' }}>
              Go home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
