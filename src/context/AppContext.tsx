import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'
import type { AppSettings } from '../types'

// ---------------------------------------------------------------- Theme
type ThemePref = 'light' | 'dark' | 'system'

function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem('mythree-theme')
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

// ---------------------------------------------------------------- Toasts
interface Toast {
  id: number
  tone: 'success' | 'error' | 'info'
  text: string
}

// ---------------------------------------------------------------- Context
interface AppState {
  theme: ThemePref
  resolvedTheme: 'light' | 'dark'
  setTheme: (t: ThemePref) => void
  settings: AppSettings | null
  reloadSettings: (fresh?: boolean) => Promise<void>
  toast: (text: string, tone?: Toast['tone']) => void
  online: boolean
}

const AppContext = createContext<AppState | null>(null)

export const DEFAULT_SETTINGS: AppSettings = {
  suggested_contribution: 151,
  min_contribution: 11,
  programme_days: 180,
  default_pass_percentage: 70,
  sequential_unlock: true,
  daily_question_count: 5,
  weekly_question_count: 10,
  weekly_pass_percentage: 60,
  final_exam_min_weekly_passed: 0,
  require_phone_verification: false,
  contact_email: null,
  contact_phone: null,
  contact_whatsapp: null,
  contact_address: null,
  maintenance_mode: false,
  maintenance_message: null,
  registration_fee: 151,
  registration_payment_required: true,
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(readThemePref)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [online, setOnline] = useState(() => navigator.onLine)
  const nextId = useRef(1)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const fn = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq?.addEventListener('change', fn)
    return () => mq?.removeEventListener('change', fn)
  }, [])

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', resolvedTheme === 'dark' ? '#1B1310' : '#7A1F2B'))
  }, [resolvedTheme])

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t)
    try {
      if (t === 'system') localStorage.removeItem('mythree-theme')
      else localStorage.setItem('mythree-theme', t)
    } catch {
      /* storage unavailable */
    }
  }, [])

  const reloadSettings = useCallback(async (fresh = true) => {
    if (!isSupabaseConfigured) {
      setSettings(DEFAULT_SETTINGS)
      return
    }
    try {
      setSettings(await api.settings(fresh))
    } catch {
      setSettings((s) => s ?? DEFAULT_SETTINGS)
    }
  }, [])

  useEffect(() => {
    reloadSettings(false) // cached copy first (stale-while-revalidate)
  }, [reloadSettings])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = nextId.current++
    setToasts((t) => [...t.slice(-3), { id, tone, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3800)
  }, [])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, settings, reloadSettings, toast, online }),
    [theme, resolvedTheme, setTheme, settings, reloadSettings, toast, online],
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink shadow-[var(--shadow-lift)]"
              role={t.tone === 'error' ? 'alert' : 'status'}
            >
              {t.tone === 'success' && <CheckCircle2 className="size-5 shrink-0 text-success" />}
              {t.tone === 'error' && <XCircle className="size-5 shrink-0 text-danger" />}
              {t.tone === 'info' && <Info className="size-5 shrink-0 text-info" />}
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
