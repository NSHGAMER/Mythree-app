import { CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { buttonClass, Spinner } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useAsync'
import { supabase } from '../../lib/supabase'
import { AuthCard } from './Login'

/** Landing page for email-verification links. */
export default function AuthCallbackPage() {
  useDocumentTitle('Verifying')
  const navigate = useNavigate()
  const [state, setState] = useState<'loading' | 'verified' | 'error'>('loading')
  const params = new URLSearchParams(window.location.search + window.location.hash.replace('#', '&'))
  const errorDesc = params.get('error_description')

  useEffect(() => {
    if (errorDesc) {
      setState('error')
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle()
        navigate(prof?.role === 'admin' ? '/admin' : '/app', { replace: true })
      } else {
        // Verified in another browser: the email is confirmed, the member just needs to sign in.
        setState('verified')
      }
    }, 1200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [errorDesc, navigate])

  return (
    <AuthCard title={state === 'error' ? 'Link problem' : state === 'verified' ? 'Email verified' : 'Verifying…'}>
      <div className="text-center">
        {state === 'loading' && <Spinner className="mx-auto size-8" />}
        {state === 'verified' && (
          <>
            <CheckCircle2 className="mx-auto size-14 text-success" />
            <p className="mt-4 text-ink-2">Your email is verified. Please sign in to start learning.</p>
            <Link to="/login" className={buttonClass('primary', 'lg', 'mt-6 w-full')}>Sign in</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="mx-auto size-14 text-danger" />
            <p className="mt-4 text-ink-2">{errorDesc || 'This link is invalid or has expired.'}</p>
            <Link to="/login" className={buttonClass('primary', 'lg', 'mt-6 w-full')}>Go to login</Link>
          </>
        )}
      </div>
    </AuthCard>
  )
}
