import { AnimatePresence, motion } from 'motion/react'
import { Download, PlusSquare, RefreshCw, Share, Smartphone, WifiOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useApp } from '../context/AppContext'
import { Button, Modal } from './ui'

// ---------------------------------------------------------------- platform detection
export function detectPlatform() {
  const ua = navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/i.test(ua)
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const isIOSSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)
  return { isIOS, isAndroid, isStandalone, isIOSSafari }
}

// Captured globally so the prompt is not lost before the component mounts.
let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((l) => l())
  })
}

export function useInstall() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  const platform = detectPlatform()
  return {
    ...platform,
    canPrompt: !!deferredPrompt,
    async prompt() {
      if (!deferredPrompt) return 'unavailable' as const
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      deferredPrompt = null
      force((n) => n + 1)
      return choice.outcome
    },
  }
}

const DISMISS_KEY = 'mythree-install-dismissed'

/** Bottom sheet offering installation. Android/desktop use the native prompt; iOS gets Safari instructions. */
export function InstallBanner() {
  const install = useInstall()
  const [dismissed, setDismissed] = useState(() => {
    try {
      const t = Number(localStorage.getItem(DISMISS_KEY) || 0)
      return Date.now() - t < 1000 * 60 * 60 * 24 * 14
    } catch {
      return false
    }
  })
  const [showIOS, setShowIOS] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 8000)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }

  const eligible = !install.isStandalone && !dismissed && ready && (install.canPrompt || install.isIOS)

  return (
    <>
      <AnimatePresence>
        {eligible && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-md rounded-2xl border border-gold/40 bg-surface p-4 shadow-[var(--shadow-lift)] sm:bottom-6 no-print"
            role="dialog"
            aria-label="Install Mythree"
          >
            <div className="flex items-start gap-3">
              <img src="/icons/icon-64.png" alt="" className="size-12 rounded-xl" width={48} height={48} />
              <div className="flex-1">
                <p className="font-display text-lg text-ink">Install Mythree</p>
                <p className="text-sm text-ink-3">Add Mythree to your home screen for a full-screen, app-like experience.</p>
              </div>
              <button onClick={dismiss} className="-m-1 rounded-lg p-1 text-ink-3 hover:bg-surface-2" aria-label="Not now">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={dismiss}>
                Not now
              </Button>
              {install.canPrompt ? (
                <Button size="sm" icon={<Download className="size-4" />} onClick={async () => (await install.prompt()) === 'accepted' && dismiss()}>
                  Install app
                </Button>
              ) : (
                <Button size="sm" icon={<Smartphone className="size-4" />} onClick={() => setShowIOS(true)}>
                  How to install
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <IOSInstallModal open={showIOS} onClose={() => setShowIOS(false)} />
    </>
  )
}

export function IOSInstallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isIOSSafari } = detectPlatform()
  return (
    <Modal open={open} onClose={onClose} title="Add Mythree to your iPhone" size="sm" footer={<Button onClick={onClose}>Got it</Button>}>
      {!isIOSSafari && (
        <p className="mb-4 rounded-xl bg-gold-soft px-3 py-2 text-sm text-gold-ink">
          On iPhone and iPad, installation works from <strong>Safari</strong>. Please open this page in Safari first.
        </p>
      )}
      <ol className="space-y-4 text-sm text-ink-2">
        <li className="flex gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-maroon-soft font-bold text-maroon-ink">1</span>
          <span>
            Tap the <Share className="inline size-4 align-text-bottom text-info" /> <strong>Share</strong> button in Safari's toolbar.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-maroon-soft font-bold text-maroon-ink">2</span>
          <span>
            Scroll down and choose <PlusSquare className="inline size-4 align-text-bottom" /> <strong>Add to Home Screen</strong>.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-maroon-soft font-bold text-maroon-ink">3</span>
          <span>
            Tap <strong>Add</strong>. Mythree will appear on your home screen and open full-screen.
          </span>
        </li>
      </ol>
    </Modal>
  )
}

/** Service worker registration with a polite "update available" prompt. */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    },
  })
  if (!needRefresh) return null
  return (
    <div className="fixed inset-x-3 top-3 z-[95] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-lift)] no-print" role="status">
      <RefreshCw className="size-5 text-maroon" />
      <p className="flex-1 text-sm text-ink">A new version of Mythree is available.</p>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>
        Update
      </Button>
    </div>
  )
}

export function OfflineBanner() {
  const { online } = useApp()
  if (online) return null
  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-xs font-semibold text-bg no-print" role="status">
      <WifiOff className="size-4" /> You are offline. You can browse, but tests, challenges and payments need a connection and will not be saved offline.
    </div>
  )
}
