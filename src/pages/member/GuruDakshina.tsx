import { motion } from 'motion/react'
import { CheckCircle2, Clock, FileText, HandHeart, Heart, Info, Lock, ShieldCheck, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, cx, EmptyState, PageHeader, Pill, SkeletonCards } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { fmtDateTime, inr } from '../../lib/format'
import { loadRazorpay, type RazorpaySuccess } from '../../lib/razorpay'
import type { Contribution } from '../../types'

type Phase = 'idle' | 'creating' | 'paying' | 'verifying' | 'success' | 'failed'

export default function GuruDakshinaPage() {
  useDocumentTitle('Guru Dakshina')
  const { settings, online } = useApp()
  const { profile } = useAuth()
  const suggested = settings?.suggested_contribution ?? 151
  const min = settings?.min_contribution ?? 11
  const presets = useMemo(() => Array.from(new Set([suggested, 251, 501, 1001])).sort((a, b) => a - b), [suggested])
  const [amount, setAmount] = useState<number>(suggested)
  const [custom, setCustom] = useState('')
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [err, setErr] = useState('')
  const [paid, setPaid] = useState<Contribution | null>(null)
  const cfg = useAsync(() => api.paymentsConfig().catch(() => ({ enabled: false, key_id: null, test_mode: false })), [])
  const history = useAsync(() => api.myContributions(), [])

  const value = custom ? Number(custom) : amount
  const valid = Number.isFinite(value) && value >= min && value <= 100000 && Number.isInteger(value)

  async function contribute() {
    if (!valid) return setErr(`Please enter a whole amount between ₹${min} and ₹1,00,000.`)
    if (!navigator.onLine) return setErr('You are offline. Contributions need an internet connection.')
    setErr('')
    setPhase('creating')
    const idem = crypto.randomUUID()
    try {
      const [order] = await Promise.all([api.createOrder(value, idem, note.trim() || undefined), loadRazorpay()])
      setPhase('paying')
      const rzp = new window.Razorpay!({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount_paise,
        currency: order.currency,
        name: 'Mythree – संस्कृतगृहम्',
        description: 'Guru Dakshina (voluntary)',
        image: `${window.location.origin}/icons/icon-192.png`,
        prefill: { name: profile?.full_name, email: profile?.email, contact: profile?.phone ?? undefined },
        notes: { purpose: 'guru_dakshina' },
        theme: { color: '#7A1F2B' },
        modal: {
          ondismiss: () => setPhase((p) => (p === 'paying' ? 'idle' : p)),
          confirm_close: true,
        },
        handler: async (resp: RazorpaySuccess) => {
          setPhase('verifying')
          try {
            const v = await api.verifyPayment(resp)
            if (!v.verified) throw new Error('PAYMENT_VERIFICATION_FAILED')
            setPaid(v.contribution)
            setPhase('success')
          } catch (e) {
            setErr(friendlyError(e))
            setPhase('failed')
          } finally {
            history.reload()
          }
        },
      })
      rzp.on('payment.failed', (r: unknown) => {
        const desc = (r as { error?: { description?: string } })?.error?.description
        setErr(desc ? `Payment failed: ${desc}` : 'Payment failed. No money has been taken. You can try again.')
        setPhase('failed')
        history.reload()
      })
      rzp.open()
    } catch (e) {
      setErr(friendlyError(e))
      setPhase('idle')
    }
  }

  const enabled = cfg.data?.enabled

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Guru Dakshina" sanskrit="गुरुदक्षिणा" subtitle="A voluntary offering of gratitude to support the programme." />

      <Alert tone="gold" icon={<Heart className="size-5" />} className="mb-6">
        Guru Dakshina is <strong>completely voluntary</strong>. Your learning, tests, rewards and final exam are never affected by whether you contribute.
      </Alert>

      {phase === 'success' && paid ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="p-8 text-center">
            <CheckCircle2 className="mx-auto size-16 text-success" />
            <h2 className="mt-4 text-3xl text-ink">Thank you! 🙏</h2>
            <p lang="sa" className="sanskrit mt-1 text-lg text-gold-ink">धन्यवादः</p>
            <p className="mt-3 text-ink-2">Your Guru Dakshina of <strong>{inr(paid.amount_paise)}</strong> has been received and verified.</p>
            <p className="mt-1 text-sm text-ink-3">Receipt no. {paid.receipt_no}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to={`/app/guru-dakshina/receipt/${paid.id}`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-maroon px-5 font-semibold text-on-primary"><FileText className="size-4" /> View receipt</Link>
              <Button variant="outline" onClick={() => { setPhase('idle'); setPaid(null) }}>Done</Button>
            </div>
          </Card>
        </motion.div>
      ) : (
        <Card className="relative overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-maroon via-gold to-saffron" />
          {cfg.loading ? (
            <div className="skeleton h-40" />
          ) : !enabled ? (
            <EmptyState icon={<HandHeart className="size-6" />} title="Online contributions are being set up">
              The secure payment gateway is not active yet. Please check back soon. Thank you for your intention!
            </EmptyState>
          ) : (
            <>
              <p className="text-sm font-bold uppercase tracking-widest text-ink-3">Choose an amount</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setAmount(p)
                      setCustom('')
                    }}
                    className={cx('relative rounded-2xl border-2 px-3 py-4 text-center transition', !custom && amount === p ? 'border-maroon bg-maroon-soft' : 'border-line hover:border-line-strong')}
                  >
                    {p === suggested && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-2 py-0.5 text-[0.65rem] font-bold uppercase text-[#2e1d12]">Suggested</span>}
                    <span className="font-display text-2xl text-ink">₹{p.toLocaleString('en-IN')}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-ink-2">Or enter another amount</span>
                  <div className="relative mt-1.5">
                    <span className="absolute inset-y-0 left-4 flex items-center font-semibold text-ink-3">₹</span>
                    <input type="number" inputMode="numeric" min={min} max={100000} value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))} placeholder={`Minimum ₹${min}`} className="h-12 w-full rounded-xl border border-line bg-bg-elevated pl-9 pr-3 text-ink focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/20" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink-2">Note (optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="In honour of…" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-bg-elevated px-3 text-ink focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/20" />
                </label>
              </div>
              {err && <Alert tone="danger" className="mt-4">{err}</Alert>}
              {phase === 'verifying' && <Alert tone="info" className="mt-4" icon={<Clock className="size-5" />}>Verifying your payment securely… please don’t close this page.</Alert>}
              <Button variant="gold" size="lg" className="mt-6 w-full" disabled={!valid || !online} loading={phase === 'creating' || phase === 'verifying' || phase === 'paying'} onClick={contribute} icon={<HandHeart className="size-5" />}>
                Offer {valid ? `₹${value.toLocaleString('en-IN')}` : ''} Guru Dakshina
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-3">
                <Lock className="size-3.5" /> Secured by Razorpay · UPI, cards, net banking {cfg.data?.test_mode && <Pill tone="info">Test mode</Pill>}
              </p>
            </>
          )}
        </Card>
      )}

      <h2 className="mb-3 mt-10 text-xl text-ink">Contribution history</h2>
      {history.loading && !history.data ? (
        <SkeletonCards count={1} />
      ) : !history.data?.length ? (
        <Card className="p-5 text-sm text-ink-3">No contributions yet.</Card>
      ) : (
        <Card className="divide-y divide-line">
          {history.data.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              {c.status === 'paid' ? <CheckCircle2 className="size-5 text-success" /> : c.status === 'failed' ? <XCircle className="size-5 text-danger" /> : <Clock className="size-5 text-ink-3" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{inr(c.amount_paise)}</p>
                <p className="text-xs text-ink-3">{fmtDateTime(c.paid_at ?? c.created_at)}</p>
              </div>
              <Pill tone={c.status === 'paid' ? 'success' : c.status === 'failed' ? 'danger' : 'neutral'}>{c.status === 'created' ? 'Not completed' : c.status === 'paid' ? 'Successful' : c.status}</Pill>
              {c.status === 'paid' && (
                <Link to={`/app/guru-dakshina/receipt/${c.id}`} className="text-sm font-semibold text-maroon-ink hover:underline">Receipt</Link>
              )}
            </div>
          ))}
        </Card>
      )}
      <p className="mt-4 flex items-start gap-2 text-xs text-ink-3">
        <Info className="mt-0.5 size-4 shrink-0" /> A contribution is shown as successful only after our server verifies it with Razorpay. If money was deducted but the status is “Not completed”, it will be reconciled automatically within a few minutes.
      </p>
      <p className="mt-2 flex items-start gap-2 text-xs text-ink-3"><ShieldCheck className="mt-0.5 size-4 shrink-0" /> Mythree never sees or stores your card or UPI details.</p>
    </div>
  )
}
