import { AnimatePresence, motion } from 'motion/react'
import { Cookie } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './ui'

export const COOKIE_KEY = 'mythree-cookie-consent'

export interface CookiePrefs {
  necessary: true
  preferences: boolean
  analytics: boolean
  decidedAt: string
}

export function readCookiePrefs(): CookiePrefs | null {
  try {
    const raw = localStorage.getItem(COOKIE_KEY)
    return raw ? (JSON.parse(raw) as CookiePrefs) : null
  } catch {
    return null
  }
}

export function saveCookiePrefs(p: Omit<CookiePrefs, 'necessary' | 'decidedAt'>) {
  const prefs: CookiePrefs = { necessary: true, ...p, decidedAt: new Date().toISOString() }
  try {
    localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs))
    if (!p.preferences) localStorage.removeItem('mythree-theme')
  } catch {
    /* ignore */
  }
  return prefs
}

export function CookieBanner() {
  const [show, setShow] = useState(() => readCookiePrefs() === null)
  const decide = (all: boolean) => {
    saveCookiePrefs({ preferences: all, analytics: false })
    setShow(false)
  }
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="fixed inset-x-3 bottom-3 z-[75] mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-lift)] sm:flex sm:items-center sm:gap-4 no-print"
          role="dialog"
          aria-label="Cookie preferences"
        >
          <Cookie className="mb-2 size-6 shrink-0 text-gold sm:mb-0" />
          <p className="flex-1 text-sm text-ink-2">
            Mythree uses only essential storage to keep you signed in and remember your choices. We do not use advertising or tracking cookies.{' '}
            <Link to="/cookies" className="font-semibold text-maroon-ink underline">
              Cookie preferences
            </Link>
          </p>
          <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
            <Button size="sm" variant="outline" onClick={() => decide(false)}>
              Essential only
            </Button>
            <Button size="sm" onClick={() => decide(true)}>
              Accept
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
