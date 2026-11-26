import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, MailCheck, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, cx, Input, Select } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { fieldErrors, INDIAN_STATES, normalizeIndianMobile, passwordStrength, registerSchema, type RegisterInput } from '../../lib/validation'
import { AuthCard, PasswordInput } from './Login'

const STEPS = ['About you', 'Address', 'Security']
const STEP_FIELDS: (keyof RegisterInput)[][] = [
  ['full_name', 'email', 'phone', 'age'],
  ['address_line1', 'address_line2', 'city', 'state', 'pincode'],
  ['password', 'confirm_password', 'accept_terms'],
]

export default function RegisterPage() {
  useDocumentTitle('Register')
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Record<string, string | boolean>>({
    full_name: '', email: '', phone: '', age: '', address_line1: '', address_line2: '', city: '', state: 'Karnataka', pincode: '',
    password: '', confirm_password: '', accept_terms: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const strength = passwordStrength(String(form.password))

  function validateStep(s: number) {
    const parsed = registerSchema.safeParse(form)
    if (parsed.success) return true
    const errs = fieldErrors(parsed.error)
    const relevant = Object.fromEntries(Object.entries(errs).filter(([k]) => STEP_FIELDS[s].includes(k as keyof RegisterInput)))
    setErrors(relevant)
    return Object.keys(relevant).length === 0
  }

  async function next() {
    setErr('')
    if (!validateStep(step)) return
    if (step === 0) {
      const phone = normalizeIndianMobile(String(form.phone))
      if (phone) {
        setBusy(true)
        try {
          const ok = await api.phoneAvailable(phone)
          if (!ok) {
            setErrors({ phone: 'This mobile number is already registered. Try signing in instead.' })
            return
          }
        } catch (e) {
          setErr(friendlyError(e))
          return
        } finally {
          setBusy(false)
        }
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (step < STEPS.length - 1) return next()
    const parsed = registerSchema.safeParse(form)
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error)
      setErrors(errs)
      const firstBad = STEP_FIELDS.findIndex((f) => f.some((k) => errs[k]))
      if (firstBad >= 0) setStep(firstBad)
      return
    }
    const d = parsed.data
    setBusy(true)
    setErr('')
    const { data, error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: d.full_name,
          phone: d.phone,
          age: String(d.age),
          address_line1: d.address_line1,
          address_line2: d.address_line2 || '',
          city: d.city,
          state: d.state,
          pincode: d.pincode,
          country: 'India',
        },
      },
    })
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    // With email confirmation on, an existing email returns a user with no identities.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return setErr('An account with this email already exists. Please sign in or reset your password.')
    }
    setDone(d.email)
  }

  if (done) {
    return (
      <AuthCard title="Check your email" subtitle="One last step to activate your account">
        <div className="text-center">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-success-soft text-success">
            <MailCheck className="size-10" />
          </div>
          <p className="mt-5 text-ink-2">
            We sent a verification link to <strong className="text-ink">{done}</strong>. Open it to verify your email, then sign in.
          </p>
          <p className="mt-3 text-sm text-ink-3">Can’t find it? Check your spam or promotions folder.</p>
          <Link to="/login" className="mt-6 inline-block font-semibold text-maroon-ink hover:underline">
            Go to login →
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Join Mythree" subtitle="Free registration · your textbook is posted to your address">
      <ol className="mb-7 flex items-center gap-2" aria-label="Registration steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={cx('grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition', i < step ? 'bg-success text-white' : i === step ? 'bg-maroon text-on-primary' : 'bg-surface-3 text-ink-3')} aria-current={i === step ? 'step' : undefined}>
              {i < step ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cx('hidden text-xs font-semibold sm:block', i === step ? 'text-ink' : 'text-ink-3')}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>
      <form onSubmit={submit} noValidate>
        {err && <Alert tone="danger" className="mb-4">{err}</Alert>}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
            {step === 0 && (
              <>
                <Input label="Full name" autoComplete="name" value={String(form.full_name)} onChange={set('full_name')} error={errors.full_name} required />
                <Input label="Email" type="email" inputMode="email" autoComplete="email" value={String(form.email)} onChange={set('email')} error={errors.email} required />
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <Input label="Mobile number" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" value={String(form.phone)} onChange={set('phone')} error={errors.phone} hint="Indian mobile, 10 digits" required />
                  <Input label="Age" type="number" inputMode="numeric" min={5} max={120} value={String(form.age)} onChange={set('age')} error={errors.age} required />
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <p className="rounded-xl bg-gold-soft px-3 py-2 text-xs text-gold-ink">Your textbook and final exam paper will be posted to this address.</p>
                <Input label="House / flat, street" autoComplete="address-line1" value={String(form.address_line1)} onChange={set('address_line1')} error={errors.address_line1} required />
                <Input label="Area / landmark (optional)" autoComplete="address-line2" value={String(form.address_line2)} onChange={set('address_line2')} error={errors.address_line2} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="City / town" autoComplete="address-level2" value={String(form.city)} onChange={set('city')} error={errors.city} required />
                  <Input label="PIN code" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={String(form.pincode)} onChange={set('pincode')} error={errors.pincode} required />
                </div>
                <Select label="State" value={String(form.state)} onChange={set('state')} error={errors.state} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="Select state" required />
              </>
            )}
            {step === 2 && (
              <>
                <PasswordInput label="Create password" autoComplete="new-password" value={String(form.password)} onChange={set('password')} error={errors.password} required hint="At least 8 characters with a letter and a number" />
                {String(form.password).length > 0 && (
                  <div className="-mt-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={cx('h-1.5 flex-1 rounded-full', i < strength.score ? (strength.score >= 3 ? 'bg-success' : strength.score === 2 ? 'bg-gold' : 'bg-danger') : 'bg-surface-3')} />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-ink-3">Strength: {strength.label}</p>
                  </div>
                )}
                <PasswordInput label="Confirm password" autoComplete="new-password" value={String(form.confirm_password)} onChange={set('confirm_password')} error={errors.confirm_password} required />
                <label className="flex items-start gap-3 text-sm text-ink-2">
                  <input type="checkbox" checked={Boolean(form.accept_terms)} onChange={(e) => setForm((f) => ({ ...f, accept_terms: e.target.checked }))} className="mt-0.5 size-5 accent-[var(--maroon)]" />
                  <span>
                    I agree to the <Link to="/terms" target="_blank" className="font-semibold text-maroon-ink underline">Terms of Service</Link> and{' '}
                    <Link to="/privacy" target="_blank" className="font-semibold text-maroon-ink underline">Privacy Policy</Link>.
                  </span>
                </label>
                {errors.accept_terms && <p className="text-xs font-medium text-danger">{errors.accept_terms}</p>}
              </>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="mt-7 flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} icon={<ArrowLeft className="size-4" />}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="submit" className="flex-1" loading={busy}>
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="submit" className="flex-1" loading={busy} icon={<UserPlus className="size-4" />}>
              Create account
            </Button>
          )}
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-ink-3">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-maroon-ink hover:underline">
          Login
        </Link>
      </p>
    </AuthCard>
  )
}
