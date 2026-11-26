import { MailCheck, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Input } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useAsync'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { AuthCard } from './Login'

export default function ForgotPasswordPage() {
  useDocumentTitle('Forgot password')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr('Enter a valid email address.')
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` })
    setBusy(false)
    // Do not reveal whether the email exists – always show the same confirmation (except rate limits).
    if (error && /rate|too many/i.test(error.message)) return setErr(friendlyError(error))
    setSent(true)
  }

  return (
    <AuthCard title="Reset your password" subtitle="We will email you a secure link">
      {sent ? (
        <div className="text-center">
          <MailCheck className="mx-auto size-14 text-success" />
          <p className="mt-4 text-ink-2">If an account exists for <strong>{email}</strong>, a reset link is on its way. Open it on this same device.</p>
          <Link to="/login" className="mt-6 inline-block font-semibold text-maroon-ink hover:underline">Back to login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <Alert tone="danger">{err}</Alert>}
          <Input label="Registered email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" size="lg" className="w-full" loading={busy} icon={<Send className="size-4" />}>
            Send reset link
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="font-semibold text-maroon-ink hover:underline">Back to login</Link>
          </p>
        </form>
      )}
    </AuthCard>
  )
}
