import { Eye, EyeOff, LogIn, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../../components/Brand'
import { Alert, Button, Card, Input } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useAsync'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { fieldErrors, loginSchema } from '../../lib/validation'

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="w-full max-w-md p-6 sm:p-9">
      <div className="mb-7 text-center">
        <Logo size={64} className="mx-auto mb-4 shadow-[var(--shadow-glow)]" />
        <h1 className="text-3xl text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {children}
    </Card>
  )
}

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <Input
      {...props}
      type={show ? 'text' : 'password'}
      trailing={
        <button type="button" onClick={() => setShow((s) => !s)} className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-2" aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  )
}

export default function LoginPage() {
  useDocumentTitle('Login')
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resent, setResent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setErr('')
    setUnconfirmed(false)
    setBusy(true)
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
    setBusy(false)
    if (error) {
      if (/Email not confirmed/i.test(error.message)) setUnconfirmed(true)
      setErr(friendlyError(error))
      return
    }
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    navigate(from && from !== '/login' ? from : prof?.role === 'admin' ? '/admin' : '/app', { replace: true })
  }

  async function resend() {
    setBusy(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
    setBusy(false)
    if (error) setErr(friendlyError(error))
    else setResent(true)
  }

  return (
    <AuthCard title="Welcome back" subtitle={<span lang="sa" className="sanskrit text-base text-maroon-ink">स्वागतम्</span>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert tone="danger">{err}</Alert>}
        {unconfirmed && (
          <Alert tone="gold" icon={<MailCheck className="size-5" />}>
            {resent ? 'A new verification email is on its way.' : (
              <button type="button" onClick={resend} className="font-semibold underline">
                Resend verification email
              </button>
            )}
          </Alert>
        )}
        <Input label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
        <PasswordInput label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} required />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-maroon-ink hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={busy} className="w-full" icon={<LogIn className="size-5" />}>
          Login
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-3">
        New to Mythree?{' '}
        <Link to="/register" className="font-semibold text-maroon-ink hover:underline">
          Register free
        </Link>
      </p>
    </AuthCard>
  )
}
