import { CheckCircle2, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Alert, Button, Card, Input, Textarea } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { contactSchema, fieldErrors } from '../../lib/validation'
import { PageHero } from './About'

export default function ContactPage() {
  useDocumentTitle('Contact')
  const { settings } = useApp()
  const { profile } = useAuth()
  const [form, setForm] = useState({ name: profile?.full_name ?? '', email: profile?.email ?? '', phone: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = contactSchema.safeParse(form)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setStatus('sending')
    try {
      await api.contact(parsed.data)
      setStatus('sent')
    } catch (e) {
      setErr(friendlyError(e))
      setStatus('error')
    }
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <>
      <PageHero eyebrow="Contact" title="We would love to hear from you" sanskrit="सम्पर्कः" />
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          {settings?.contact_email && <ContactItem icon={<Mail />} label="Email" value={settings.contact_email} href={`mailto:${settings.contact_email}`} />}
          {settings?.contact_phone && <ContactItem icon={<Phone />} label="Phone" value={settings.contact_phone} href={`tel:${settings.contact_phone.replace(/\s/g, '')}`} />}
          {settings?.contact_whatsapp && (
            <ContactItem icon={<MessageCircle />} label="WhatsApp" value={settings.contact_whatsapp} href={`https://wa.me/${settings.contact_whatsapp.replace(/\D/g, '')}`} />
          )}
          {settings?.contact_address && <ContactItem icon={<MapPin />} label="Address" value={settings.contact_address} />}
          <Card className="p-5 text-sm text-ink-3">
            For quick answers about the programme, tests, rewards or Guru Dakshina, tap the help button at the bottom-right of the screen.
          </Card>
        </div>
        <Card className="p-6 sm:p-8">
          {status === 'sent' ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto size-14 text-success" />
              <h2 className="mt-4 text-2xl text-ink">Message received</h2>
              <p className="mt-2 text-ink-3">Thank you. The Mythree team will get back to you soon.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <h2 className="text-2xl text-ink">Send us a message</h2>
              {status === 'error' && <Alert tone="danger">{err}</Alert>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Your name" value={form.name} onChange={set('name')} error={errors.name} required autoComplete="name" />
                <Input label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} required autoComplete="email" />
              </div>
              <Input label="Phone (optional)" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" />
              <Textarea label="Message" value={form.message} onChange={set('message')} error={errors.message} required rows={5} maxLength={3000} />
              <Button type="submit" loading={status === 'sending'} icon={<Send className="size-4" />} className="w-full sm:w-auto">
                Send message
              </Button>
            </form>
          )}
        </Card>
      </div>
    </>
  )
}

function ContactItem({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const inner = (
    <Card className="flex items-center gap-4 p-5 transition hover:border-gold">
      <span className="grid size-12 place-items-center rounded-2xl bg-maroon-soft text-maroon-ink [&_svg]:size-5">{icon}</span>
      <span>
        <span className="block text-xs font-bold uppercase tracking-widest text-ink-3">{label}</span>
        <span className="block font-semibold text-ink">{value}</span>
      </span>
    </Card>
  )
  return href ? (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
      {inner}
    </a>
  ) : (
    inner
  )
}
