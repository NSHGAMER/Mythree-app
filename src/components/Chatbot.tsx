import { AnimatePresence, motion } from 'motion/react'
import { Bot, Loader2, MessageCircleQuestion, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { cx } from './ui'

interface Msg {
  from: 'bot' | 'user'
  text: string
  related?: { id: string; question: string; answer: string }[]
  fallback?: boolean
}

const SUGGESTIONS = [
  'How does the programme work?',
  'Is Guru Dakshina compulsory?',
  'What happens after 180 days?',
  'How do I take the final exam?',
  'How do I install the app?',
]

/** Minimum relevance before we trust an FAQ match. Below this we hand over to a human. */
export const CONFIDENCE_THRESHOLD = 0.5

export function Chatbot() {
  const { settings } = useApp()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      from: 'bot',
      text: 'Namaste! I am the Mythree helper. Ask me about the learning programme, tests, rewards, Guru Dakshina or the final exam. I only answer from our approved help guide.',
    },
  ])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, open])

  async function ask(q: string) {
    const question = q.trim()
    if (!question || busy) return
    setMsgs((m) => [...m, { from: 'user', text: question }])
    setInput('')
    setBusy(true)
    try {
      const { matches } = await api.faq(question)
      const best = matches[0]
      if (best && best.score >= CONFIDENCE_THRESHOLD) {
        setMsgs((m) => [
          ...m,
          { from: 'bot', text: best.answer, related: matches.slice(1).filter((x) => x.score >= CONFIDENCE_THRESHOLD) },
        ])
      } else {
        setMsgs((m) => [
          ...m,
          {
            from: 'bot',
            fallback: true,
            text: "I'm sorry, I don't have an approved answer for that yet, and I don't want to guess. Please contact the Mythree team and they will help you.",
          },
        ])
      }
    } catch (e) {
      setMsgs((m) => [...m, { from: 'bot', fallback: true, text: friendlyError(e) }])
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    ask(input)
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-[65] grid size-14 place-items-center rounded-full bg-maroon text-on-primary shadow-[0_10px_30px_-8px_rgb(122_31_43/0.7)] transition hover:scale-105 lg:bottom-6 no-print"
        aria-label={open ? 'Close help chat' : 'Open help chat'}
        aria-expanded={open}
      >
        {open ? <X className="size-6" /> : <MessageCircleQuestion className="size-6" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-3 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-[65] mx-auto flex max-h-[70dvh] max-w-md flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-lift)] sm:inset-x-auto sm:right-4 sm:w-[400px] lg:bottom-24"
            role="dialog"
            aria-label="Mythree help chat"
          >
            <div className="flex items-center gap-3 bg-gradient-to-r from-maroon to-[#9c2f3c] px-4 py-3 text-white">
              <div className="grid size-9 place-items-center rounded-full bg-white/15">
                <Bot className="size-5" />
              </div>
              <div>
                <p className="font-display text-lg leading-tight">Mythree Sahāyaka</p>
                <p className="text-xs text-white/75">Answers from the approved help guide</p>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin" aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={cx('flex', m.from === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cx(
                      'max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm',
                      m.from === 'user' ? 'rounded-br-md bg-maroon text-on-primary' : 'rounded-bl-md bg-surface-2 text-ink',
                    )}
                  >
                    {m.text}
                    {m.fallback && (
                      <div className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-ink-2">
                        {settings?.contact_email && <p>Email: {settings.contact_email}</p>}
                        {settings?.contact_phone && <p>Phone: {settings.contact_phone}</p>}
                        <Link to="/contact" className="font-semibold text-maroon-ink underline" onClick={() => setOpen(false)}>
                          Open the contact page →
                        </Link>
                      </div>
                    )}
                    {m.related && m.related.length > 0 && (
                      <div className="mt-2 border-t border-line pt-2">
                        <p className="text-xs font-semibold text-ink-3">Related questions</p>
                        {m.related.map((r) => (
                          <button key={r.id} onClick={() => ask(r.question)} className="mt-1 block text-left text-xs font-medium text-maroon-ink hover:underline">
                            {r.question}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-ink-3">
                  <Loader2 className="size-4 animate-spin" /> Looking that up…
                </div>
              )}
              {msgs.length === 1 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-gold hover:bg-gold-soft">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>
            <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={300}
                placeholder="Type your question…"
                className="h-11 flex-1 rounded-xl border border-line bg-bg-elevated px-3 text-sm text-ink focus:border-gold focus:outline-none"
                aria-label="Your question"
              />
              <button type="submit" disabled={!input.trim() || busy} className="grid size-11 place-items-center rounded-xl bg-maroon text-on-primary disabled:opacity-50" aria-label="Send">
                <Send className="size-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
