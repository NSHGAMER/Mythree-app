import { motion } from 'motion/react'
import { BadgeCheck, CheckCircle2, Clock, IndianRupee, Lock, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, buttonClass, Card, Pill, SkeletonCards } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { fmtDateTime, inr } from '../../lib/format'
import { loadRazorpay, type RazorpaySuccess } from '../../lib/razorpay'

type Phase = 'idle' | 'starting' | 'paying' | 'verifying' | 'checking' | 'confirmed' | 'failed'

/**
 * Mandatory registration fee. The registration is confirmed ONLY by the server after it has verified
 * the payment with Razorpay – never by the browser. Closing the tab mid-payment is safe:
 * "Check payment status" (and the webhook) confirm a captured payment later.
 */
export default function RegistrationPage() {
  useDocumentTitle('Complete registration')
  const { profile, refreshProfile } = useAuth()
  const { online } = useApp()
  const info = useAsync(() => api.myRegistration(), [])
  const [phase, setPhase] = useState<Phase>('idle')
  const [err, setErr] = useState('')
  const [uid, setUid] = useState<string | null>(null)

  const confirmed = phase === 'confirmed' || info.data?.status === 'confirmed'
  const memberUid = uid ?? info.data?.member_uid ?? profile?.member_uid ?? null
  const fee = info.data?.fee ?? 151
  const hasOpenOrder = (info.data?.payments ?? []).some((p) => p.status === 'created' && p.razorpay_order_id)

  const finish = useCallback(
    async (newUid?: string | null) => {
      if (newUid) setUid(newUid)
      setPhase('confirmed')
      await refreshProfile()
      info.reload()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshProfile],
  )

  const checkStatus = useCallback(
    async (silent = false) => {
      if (!navigator.onLine) return !silent && setErr('You are offline. Reconnect and check again.')
      setPhase((p) => (p === 'idle' || p === 'failed' ? 'checking' : p))
      try {
        const r = await api.registrationStatus()
        if (r.status === 'confirmed') return finish(r.member_uid)
        if (!silent) setErr(r.status === 'processing' ? 'Your bank is still processing the payment. Please check again in a minute.' : 'No completed payment was found yet. If money was deducted, wait a few minutes and check again.')
      } catch (e) {
        if (!silent) setErr(friendlyError(e))
      }
      setPhase((p) => (p === 'checking' ? 'idle' : p))
    },
    [finish],
  )

  // Recovery: if the member returns with an open order (e.g. tab closed during payment), check automatically.
  useEffect(() => {
    if (info.data && info.data.status !== 'confirmed' && hasOpenOrder) checkStatus(true)
  }, [info.data, hasOpenOrder, checkStatus])

  async function pay() {
    if (!navigator.onLine) return setErr('You are offline. Payments need an internet connection.')
    setErr('')
    setPhase('starting')
    try {
      const [order] = await Promise.all([api.registrationOrder(crypto.randomUUID()), loadRazorpay()])
      if (order.status === 'confirmed') return finish(order.member_uid)
      setPhase('paying')
      const rzp = new window.Razorpay!({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount_paise,
        currency: order.currency,
        name: 'Mythree – संस्कृतगृहम्',
        description: 'Registration fee',
        image: `${window.location.origin}/icons/icon-192.png`,
        prefill: order.prefill,
        notes: { purpose: 'registration' },
        theme: { color: '#7A1F2B' },
        modal: { ondismiss: () => setPhase((p) => (p === 'paying' ? 'idle' : p)), confirm_close: true },
        handler: async (resp: RazorpaySuccess) => {
          setPhase('verifying')
          try {
            const v = await api.registrationVerify(resp)
            if (v.duplicate) {
              setErr('This payment was received after your registration was already paid. It will be refunded – please contact us if you need help.')
              await finish(null)
              return
            }
            if (!v.verified) throw new Error('PAYMENT_VERIFICATION_FAILED')
            await finish(v.member_uid)
          } catch (e) {
            setErr(`${friendlyError(e)} Use “Check payment status” – you will not be charged again.`)
            setPhase('failed')
          }
        },
      })
      rzp.on('payment.failed', (r: unknown) => {
        const desc = (r as { error?: { description?: string } })?.error?.description
        setErr(desc ? `Payment failed: ${desc}. No money has been taken; you can try again.` : 'Payment failed. No money has been taken; you can try again.')
        setPhase('failed')
      })
      rzp.open()
    } catch (e) {
      setErr(friendlyError(e))
      setPhase('idle')
    }
  }

  if (info.loading && !info.data) return <SkeletonCards count={1} className="mx-auto max-w-xl" />

  if (confirmed) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-xl">
        <Card className="relative overflow-hidden p-8 text-center">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-maroon via-gold to-saffron" />
          <BadgeCheck className="mx-auto size-16 text-success" />
          <h1 className="mt-4 text-3xl text-ink">Welcome to Mythree!</h1>
          <p lang="sa" className="sanskrit mt-1 text-lg text-gold-ink">स्वागतम्</p>
          <p className="mt-4 text-sm text-ink-3">Your permanent member ID</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-wider text-maroon-ink">{memberUid ?? '…'}</p>
          <p className="mt-3 text-sm text-ink-2">Please note it down – the organisation uses it for your textbook, exam and results.</p>
          {err && <Alert tone="gold" className="mt-4 text-left">{err}</Alert>}
          <Link to="/app" className={buttonClass('primary', 'lg', 'mt-7')}>Start learning</Link>
        </Card>
      </motion.div>
    )
  }

  const latest = info.data?.payments?.[0]
  return (
    <div className="mx-auto max-w-xl">
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-maroon via-gold to-saffron" />
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-ink">One last step</p>
        <h1 className="mt-1 text-3xl text-ink">Complete your registration</h1>
        <p className="mt-2 text-sm text-ink-2">
          Namaste {profile?.full_name.split(' ')[0]}! Pay the registration fee to receive your member ID and unlock chapters, tests, challenges and the final exam.
        </p>
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-surface-2 px-5 py-4">
          <span className="flex items-center gap-2 font-semibold text-ink"><IndianRupee className="size-5 text-gold" /> Registration fee</span>
          <span className="font-display text-3xl text-maroon-ink">₹{fee}</span>
        </div>

        {err && <Alert tone={phase === 'failed' ? 'danger' : 'gold'} className="mt-4">{err}</Alert>}
        {phase === 'verifying' && <Alert tone="info" className="mt-4" icon={<Clock className="size-5" />}>Verifying your payment securely… please keep this page open.</Alert>}
        {info.data?.payment_required === false && <Alert tone="info" className="mt-4">Registration payment is currently not required. Press “Check payment status” to activate your account.</Alert>}

        <Button size="lg" variant="gold" className="mt-6 w-full" disabled={!online} loading={phase === 'starting' || phase === 'paying' || phase === 'verifying'} onClick={pay} icon={<Lock className="size-5" />}>
          Pay ₹{fee} securely
        </Button>
        <Button size="md" variant="outline" className="mt-3 w-full" loading={phase === 'checking'} onClick={() => checkStatus(false)} icon={<RefreshCw className="size-4" />}>
          Check payment status
        </Button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-3"><ShieldCheck className="size-4" /> Secured by Razorpay · UPI, cards, net banking · you are never charged twice for registration</p>

        {latest && (
          <div className="mt-6 border-t border-line pt-4 text-sm">
            <p className="mb-2 font-semibold text-ink">Payment attempts</p>
            <ul className="space-y-2">
              {info.data!.payments.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-ink-2">
                    {p.status === 'paid' ? <CheckCircle2 className="size-4 text-success" /> : p.status === 'failed' ? <XCircle className="size-4 text-danger" /> : <Clock className="size-4 text-ink-3" />}
                    {inr(p.amount_paise)} · {fmtDateTime(p.created_at)}
                  </span>
                  <Pill tone={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : 'neutral'}>{p.status === 'created' ? 'Pending' : p.status === 'paid' ? 'Successful' : 'Failed'}</Pill>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <p className="mt-4 text-center text-xs text-ink-3">
        Guru Dakshina is a separate, optional offering and is not required for registration. Need help? <Link to="/contact" className="font-semibold text-maroon-ink underline">Contact us</Link>
      </p>
    </div>
  )
}
