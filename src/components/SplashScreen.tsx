import { motion } from 'motion/react'
import { useEffect } from 'react'

/**
 * Animated splash shown once per browser session (and on every PWA cold start).
 * The official logo rises in with a sun-ray glow, then the screen fades into the homepage.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(onDone, reduce ? 500 : 2300)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_center,#fffaf0_0%,#fbf1dc_45%,#f1dcb8_100%)] dark:bg-[radial-gradient(ellipse_at_center,#2a1d15_0%,#1a120e_60%,#120c09_100%)]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.55, ease: 'easeInOut' } }}
      role="status"
      aria-label="Loading Mythree"
      onClick={onDone}
    >
      {/* rotating sun rays */}
      <motion.div
        className="absolute size-[560px] rounded-full opacity-50"
        style={{
          background:
            'repeating-conic-gradient(from 0deg, rgb(232 137 29 / 0.16) 0deg 6deg, transparent 6deg 15deg)',
          maskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
        }}
        initial={{ rotate: 0, scale: 0.6, opacity: 0 }}
        animate={{ rotate: 50, scale: 1, opacity: 0.6 }}
        transition={{ duration: 2.4, ease: 'easeOut' }}
        aria-hidden
      />
      <div className="relative flex flex-col items-center">
        <motion.div
          className="relative"
          initial={{ scale: 0.4, opacity: 0, rotate: -40 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 90, damping: 14, delay: 0.1 }}
        >
          <motion.div
            className="absolute -inset-6 rounded-full bg-gold/30 blur-2xl"
            animate={{ opacity: [0.35, 0.8, 0.35], scale: [0.95, 1.08, 0.95] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
          <img src="/images/logo.webp" alt="Mythree" width={168} height={168} className="relative size-36 rounded-full shadow-[0_20px_60px_-10px_rgb(122_31_43/0.45)] sm:size-42" />
        </motion.div>
        <motion.h1
          className="mt-7 font-display text-4xl tracking-wide text-maroon-ink sm:text-5xl"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.6 }}
        >
          Mythree
        </motion.h1>
        <motion.p
          lang="sa"
          className="sanskrit mt-1 text-2xl text-gold-ink"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.6 }}
        >
          संस्कृतगृहम्
        </motion.p>
        <motion.div className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-gold/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
          <motion.div className="h-full rounded-full bg-gradient-to-r from-maroon via-gold to-saffron" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ delay: 1.1, duration: 1.1, ease: 'easeInOut' }} />
        </motion.div>
        <motion.p
          lang="sa"
          className="sanskrit mt-5 text-sm text-ink-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
        >
          स्वाध्यायप्रवचनाभ्यां न प्रमदितव्यम्
        </motion.p>
      </div>
    </motion.div>
  )
}
