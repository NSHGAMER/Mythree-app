import { CheckCircle2, MessageSquareText, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, buttonClass } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { maskPhone } from '../../lib/format'
import { AuthCard } from './Login'

export default function VerifyPhonePage() {
  useDocumentTitle('Verify mobile number')
  const { profile, refreshProfile } = useAuth()
  const { toast } = useApp()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (profile?.phone_verified_at) {
    return (
      <AuthCard title="Mobile verified">
        <div className="text-center">
          <CheckCircle2 className="mx-auto size-14 text-success" />
          <p className="mt-4 text-ink-2">{maskPhone(profile.phone)} is verified.</p>
          <Link to="/app" className={buttonClass('primary', 'lg', 'mt-6 w-full')}>Go to dashboard</Link>
        </div>
      </AuthCard>
    )
  }

  async function send() {
    setBusy(true)
    setErr('')
    try {
      const r = await api.sendOtp()
      setSent(true)
      setCooldown(r.resend_in ?? 60)
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch (e) {
      const msg = String((e as Error).message)
      if (msg.includes('SMS_NOT_CONFIGURED')) setUnavailable(true)
      setErr(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) return setErr('Enter the 6-digit code.')
    setBusy(true)
    setErr('')
    try {
      await api.verifyOtp(code)
      await refreshProfile()
      toast('Mobile number verified')
      navigate('/app', { replace: true })
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Verify your mobile" subtitle={`We will send a 6-digit code to ${maskPhone(profile?.phone ?? null)}`}>
      {err && <Alert tone={unavailable ? 'gold' : 'danger'} className="mb-4">{err}</Alert>}
      {!sent ? (
        <div className="space-y-3">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-maroon-soft text-maroon-ink">
            <Smartphone className="size-9" />
          </div>
          <Button size="lg" className="w-full" loading={busy} onClick={send} icon={<MessageSquareText className="size-5" />} disabled={unavailable}>
            Send OTP
          </Button>
          <Link to="/app" className={buttonClass('ghost', 'md', 'w-full')}>
            I’ll do this later
          </Link>
        </div>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <label htmlFor="otp" className="block text-center text-sm font-semibold text-ink-2">Enter the code</label>
          <input
            ref={inputRef}
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="h-16 w-full rounded-2xl border border-line bg-bg-elevated text-center font-display text-3xl tracking-[0.6em] text-ink focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/20"
            aria-label="6-digit verification code"
          />
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Verify
          </Button>
          <p className="text-center text-sm text-ink-3">
            Didn’t get it?{' '}
            {cooldown > 0 ? (
              <span>Resend in {cooldown}s</span>
            ) : (
              <button type="button" onClick={send} className="font-semibold text-maroon-ink hover:underline">
                Resend code
              </button>
            )}
          </p>
        </form>
      )}
    </AuthCard>
  )
}
