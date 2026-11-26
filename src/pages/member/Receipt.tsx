import { ArrowLeft, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '../../components/Brand'
import { Button, buttonClass, EmptyState, SkeletonCards } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { fmtDateTime, inr } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Contribution } from '../../types'

export default function ReceiptPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { data, loading } = useAsync(async () => {
    const { data } = await supabase.from('contributions').select('*').eq('id', id!).eq('status', 'paid').maybeSingle()
    return data as Contribution | null
  }, [id])
  useDocumentTitle(data?.receipt_no ? `Receipt ${data.receipt_no}` : 'Receipt')

  if (loading) return <SkeletonCards count={1} />
  if (!data) return <EmptyState title="Receipt not found" action={<Link to="/app/guru-dakshina" className={buttonClass('primary')}>Back</Link>}>Receipts are available only for verified contributions.</EmptyState>

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between no-print">
        <Link to="/app/guru-dakshina" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-ink"><ArrowLeft className="size-4" /> Back</Link>
        <Button variant="secondary" size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print / Save PDF</Button>
      </div>
      <div className="card overflow-hidden bg-white p-8 text-[#2e1d12] sm:p-10" style={{ colorScheme: 'light' }}>
        <div className="flex items-start justify-between gap-4 border-b-2 border-[#c9962b] pb-5">
          <div className="flex items-center gap-3">
            <Logo size={64} />
            <div>
              <p className="font-display text-2xl text-[#7a1f2b]">Mythree – संस्कृतगृहम्</p>
              <p className="text-xs">Maitrī Samskṛta-Samskṛti Pratiṣṭhāna (R), Bengaluru</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-[#85695a]">Receipt</p>
            <p className="font-mono text-sm font-bold">{data.receipt_no}</p>
          </div>
        </div>
        <p className="mt-6 text-center font-display text-xl">Guru Dakshina – Voluntary Contribution</p>
        <table className="mt-6 w-full text-sm">
          <tbody className="[&_td]:py-2 [&_td:first-child]:text-[#85695a] [&_tr]:border-b [&_tr]:border-[#eee3d0]">
            <tr><td>Received from</td><td className="text-right font-semibold">{profile?.full_name}</td></tr>
            <tr><td>Email</td><td className="text-right">{profile?.email}</td></tr>
            <tr><td>Date</td><td className="text-right">{fmtDateTime(data.paid_at)}</td></tr>
            <tr><td>Payment reference</td><td className="text-right font-mono text-xs">{data.razorpay_payment_id}</td></tr>
            {data.payment_method && <tr><td>Method</td><td className="text-right uppercase">{data.payment_method}</td></tr>}
            {data.note && <tr><td>Note</td><td className="text-right">{data.note}</td></tr>}
          </tbody>
        </table>
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-[#fbf1dc] px-5 py-4">
          <span className="font-semibold">Amount received</span>
          <span className="font-display text-3xl text-[#7a1f2b]">{inr(data.amount_paise)}</span>
        </div>
        <p className="mt-6 text-center text-xs text-[#85695a]">
          This is a computer-generated acknowledgement of a voluntary contribution verified through Razorpay. No signature is required.
        </p>
        <p lang="sa" className="sanskrit mt-3 text-center text-[#8a6216]">स्वाध्यायप्रवचनाभ्यां न प्रमदितव्यम्</p>
      </div>
    </div>
  )
}
