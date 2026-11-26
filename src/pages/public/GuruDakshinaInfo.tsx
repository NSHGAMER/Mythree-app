import { HandHeart, ShieldCheck, Sparkles, Unlock } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { buttonClass, Card } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks/useAsync'
import { PageHero } from './About'

export default function GuruDakshinaInfo() {
  useDocumentTitle('Guru Dakshina')
  const { user } = useAuth()
  const { settings } = useApp()
  if (user) return <Navigate to="/app/guru-dakshina" replace />
  const amount = settings?.suggested_contribution ?? 151
  return (
    <>
      <PageHero eyebrow="Guru Dakshina" title="An offering of gratitude" sanskrit="गुरुदक्षिणा">
        In our tradition, a student offers Guru Dakshina to honour the teacher. On Mythree it is completely voluntary.
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-14">
        <Card className="relative overflow-hidden border-gold/50 p-8 text-center sm:p-12">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-maroon via-gold to-saffron" />
          <HandHeart className="mx-auto size-12 text-gold" />
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-ink-3">Suggested contribution</p>
          <p className="mt-1 font-display text-6xl text-maroon-ink">₹{amount}</p>
          <p className="mx-auto mt-4 max-w-lg text-ink-2">You may offer any amount you wish – or nothing at all. Contributions support printing and posting textbooks, exam papers and teachers.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/login" state={{ from: '/app/guru-dakshina' }} className={buttonClass('gold', 'lg')}>
              Sign in to contribute
            </Link>
            <Link to="/register" className={buttonClass('outline', 'lg')}>
              New here? Register free
            </Link>
          </div>
        </Card>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <Card className="p-5">
            <Unlock className="size-7 text-success" />
            <p className="mt-3 font-semibold text-ink">Never required</p>
            <p className="mt-1 text-sm text-ink-3">Registration, learning, tests, rewards and the final exam are all free.</p>
          </Card>
          <Card className="p-5">
            <ShieldCheck className="size-7 text-info" />
            <p className="mt-3 font-semibold text-ink">Secure payments</p>
            <p className="mt-1 text-sm text-ink-3">Processed by Razorpay (UPI, cards, net banking) and verified on our server.</p>
          </Card>
          <Card className="p-5">
            <Sparkles className="size-7 text-gold" />
            <p className="mt-3 font-semibold text-ink">Instant receipt</p>
            <p className="mt-1 text-sm text-ink-3">Every verified contribution gets a receipt you can view and print.</p>
          </Card>
        </div>
      </div>
    </>
  )
}
