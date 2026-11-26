import { ArrowLeft, Construction, Home, Lock, RefreshCw, SearchX, ServerCrash } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/Brand'
import { buttonClass } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useAsync'

function StatusShell({ code, icon, title, children, actions }: { code: string; icon: ReactNode; title: string; children: ReactNode; actions?: ReactNode }) {
  useDocumentTitle(title)
  return (
    <div className="paisley-bg grid min-h-[70dvh] place-items-center px-4 py-16 text-center">
      <div className="max-w-lg">
        <div className="relative mx-auto mb-6 w-fit">
          <Logo size={96} className="opacity-90" />
          <span className="absolute -bottom-2 -right-2 grid size-11 place-items-center rounded-full border-4 border-bg bg-maroon text-on-primary">{icon}</span>
        </div>
        <p className="font-display text-7xl text-gold/70">{code}</p>
        <h1 className="mt-2 text-3xl text-ink">{title}</h1>
        <div className="mt-3 text-ink-3">{children}</div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {actions ?? (
            <>
              <button onClick={() => history.back()} className={buttonClass('outline')}>
                <ArrowLeft className="size-4" /> Go back
              </button>
              <Link to="/" className={buttonClass('primary')}>
                <Home className="size-4" /> Home
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <StatusShell code="404" icon={<SearchX className="size-5" />} title="Page not found">
      <p>
        <span lang="sa" className="sanskrit text-maroon-ink">पृष्ठं न लब्धम्</span> – this page does not exist or may have moved.
      </p>
    </StatusShell>
  )
}

export function ForbiddenPage() {
  return (
    <StatusShell code="403" icon={<Lock className="size-5" />} title="Access restricted">
      <p>You do not have permission to view this page. If you believe this is a mistake, please contact the Mythree team.</p>
    </StatusShell>
  )
}

export function ServerErrorPage() {
  return (
    <StatusShell
      code="500"
      icon={<ServerCrash className="size-5" />}
      title="Something went wrong"
      actions={
        <>
          <button onClick={() => window.location.reload()} className={buttonClass('primary')}>
            <RefreshCw className="size-4" /> Try again
          </button>
          <Link to="/" className={buttonClass('outline')}>
            Home
          </Link>
        </>
      }
    >
      <p>An unexpected error occurred on our side. Your progress is safe. Please try again in a moment.</p>
    </StatusShell>
  )
}

export function MaintenancePage({ message }: { message?: string }) {
  return (
    <StatusShell
      code="⚙"
      icon={<Construction className="size-5" />}
      title="We'll be right back"
      actions={
        <button onClick={() => window.location.reload()} className={buttonClass('primary')}>
          <RefreshCw className="size-4" /> Check again
        </button>
      }
    >
      <p>{message || 'Mythree is undergoing scheduled maintenance. Your progress is safe. Please check back shortly.'}</p>
    </StatusShell>
  )
}

export function SetupRequiredPage() {
  return (
    <StatusShell code="Setup" icon={<Construction className="size-5" />} title="Configuration required" actions={<span />}>
      <p>
        The application is not connected to its database yet. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (see
        .env.example) and rebuild.
      </p>
    </StatusShell>
  )
}
