import { CheckCircle2, KeyRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Spinner } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useDocumentTitle } from '../../hooks/useAsync'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { passwordSchema } from '../../lib/validation'
import { AuthCard, PasswordInput } from './Login'

export default function ResetPasswordPage() {
  useDocumentTitle('Set a new password')
  const navigate = useNavigate()
  const { toast } = useApp()
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady('ok')
    })
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      setReady(data.session ? 'ok' : 'invalid')
    }, 1500)
    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(t)
    }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const p = passwordSchema.safeParse(pw)
    if (!p.success) return setErr(p.error.issues[0].message)
    if (pw !== pw2) return setErr('Passwords do not match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    toast('Password updated')
    navigate('/app', { replace: true })
  }

  return (
    <AuthCard title="Set a new password">
      {ready === 'checking' && (
        <div className="flex justify-center py-6"><Spinner /></div>
      )}
      {ready === 'invalid' && (
        <div className="text-center">
          <Alert tone="danger">This reset link is invalid or has expired. Please open the newest link on the same device where you requested it.</Alert>
          <Link to="/forgot-password" className="mt-5 inline-block font-semibold text-maroon-ink hover:underline">Request a new link</Link>
        </div>
      )}
      {ready === 'ok' && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <Alert tone="danger">{err}</Alert>}
          <PasswordInput label="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} hint="At least 8 characters with a letter and a number" required />
          <PasswordInput label="Confirm new password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          <Button type="submit" size="lg" className="w-full" loading={busy} icon={<KeyRound className="size-4" />}>
            Update password
          </Button>
        </form>
      )}
    </AuthCard>
  )
}

export function PasswordUpdated() {
  return <CheckCircle2 />
}
