import { motion } from 'motion/react'
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Flame,
  HandHeart,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  ScrollText,
  Smartphone,
  Sparkles,
  Swords,
  Trophy,
  UserPlus,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { OrnamentDivider } from '../../components/Brand'
import { buttonClass, Card, SectionTitle } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks/useAsync'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

export default function HomePage() {
  useDocumentTitle('')
  const { user, isAdmin } = useAuth()
  const { settings } = useApp()
  const days = settings?.programme_days ?? 180

  return (
    <div className="overflow-x-clip">
      {/* ------------------------------------------------------------ HERO */}
      <section className="paisley-bg relative">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-soft/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gold-ink">
              <Sparkles className="size-3.5" /> {days}-day guided programme
            </p>
            <h1 className="mt-5 text-[2.6rem] leading-[1.05] text-ink sm:text-6xl">
              Bring <span className="text-gradient-gold">Sanskrit</span> home, one chapter at a time.
            </h1>
            <p className="mt-4 text-2xl text-maroon-ink sm:text-3xl">
              <span lang="kn" style={{ fontFamily: 'var(--font-kannada)' }}>ನಮ್ಮ ಮನೆ</span> –{' '}
              <span lang="sa" className="sanskrit">संस्कृतगृहम्</span>
            </p>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
              Read your printed textbook at your own pace, then practise in Mythree with chapter tests, daily challenges,
              streaks and rewards. When you are ready, your final exam paper arrives by post.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Link to={isAdmin ? '/admin' : '/app'} className={buttonClass('primary', 'lg')}>
                  Continue learning <ArrowRight className="size-5" />
                </Link>
              ) : (
                <Link to="/register" className={buttonClass('primary', 'lg')}>
                  Register free <ArrowRight className="size-5" />
                </Link>
              )}
              <Link to="/programme" className={buttonClass('outline', 'lg')}>
                Explore the programme
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
              {['Free to learn – always', 'Learn at your own pace', 'Works on any phone'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success" /> {t}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div className="relative mx-auto w-full max-w-md lg:max-w-none" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
            <div className="absolute -inset-4 rounded-[2.2rem] bg-gradient-to-br from-gold/40 via-saffron/20 to-maroon/30 blur-2xl" aria-hidden />
            <div className="relative overflow-hidden rounded-[2rem] border-4 border-[#e8cf9a] shadow-[var(--shadow-lift)] dark:border-[#5a4530]">
              <picture>
                <source type="image/webp" srcSet="/images/promo-480.webp 480w, /images/promo-800.webp 800w, /images/promo-1080.webp 1080w" sizes="(min-width: 1024px) 520px, 90vw" />
                <img src="/images/promo-1080.jpg" alt="A family learning Sanskrit together under a banyan tree – Namma Mane Samskritagriham" width={1080} height={1144} className="h-auto w-full" fetchPriority="high" />
              </picture>
            </div>
            <FloatingChip className="-left-3 top-10 sm:-left-8" delay={0.9} icon={<Flame className="size-5 text-saffron" />} title="12-day streak" sub="Keep the lamp lit" />
            <FloatingChip className="-right-2 bottom-24 sm:-right-8" delay={1.1} icon={<Trophy className="size-5 text-gold" />} title="Chapter 4 passed" sub="+100 XP · 92%" />
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------ HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <motion.div {...fadeUp}>
          <SectionTitle eyebrow="How it works" title="A simple path from first letter to final exam" subtitle="The textbook is your teacher; Mythree is your practice companion and progress tracker." />
        </motion.div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <UserPlus />, title: 'Register free', text: 'Create your account with your postal address so we can send your textbook.' },
            { icon: <PackageCheck />, title: 'Receive your textbook', text: 'The organisation posts the printed Sanskrit textbook to your home.' },
            { icon: <BookOpenCheck />, title: 'Read, then test', text: 'Study a chapter from the book, then take its test in the app to complete it.' },
            { icon: <ScrollText />, title: 'Final exam by post', text: 'Finish every chapter, tap “I am ready”, and your question paper is posted to you.' },
          ].map((s, i) => (
            <motion.div key={s.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }}>
              <Card className="relative h-full p-6">
                <span className="absolute right-5 top-4 font-display text-5xl text-gold/25">{i + 1}</span>
                <div className="grid size-12 place-items-center rounded-2xl bg-maroon-soft text-maroon-ink [&_svg]:size-6">{s.icon}</div>
                <h3 className="mt-4 text-xl text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-3">{s.text}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ FEATURES */}
      <section className="border-y border-line bg-surface-2/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <motion.div {...fadeUp} className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-ink">Learning that keeps you going</p>
            <h2 className="mx-auto mt-2 max-w-2xl text-3xl text-ink sm:text-4xl">Gentle motivation, every single day</h2>
            <OrnamentDivider className="mt-5" />
          </motion.div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={<BookOpenCheck />} tone="maroon" title="Chapter-wise path" text="Each chapter unlocks the next. Tests are graded instantly with explanations for every answer." />
            <Feature icon={<Swords />} tone="saffron" title="Daily & weekly challenges" text="A short daily quiz and a weekly challenge keep earlier chapters fresh in your memory." />
            <Feature icon={<Flame />} tone="saffron" title="Streaks" text="Light the lamp each day you learn. Long streaks earn special badges and bonus XP." />
            <Feature icon={<Zap />} tone="gold" title="XP & levels" text="Grow from आरम्भकः to आचार्यः. Every point is calculated and verified on our server." />
            <Feature icon={<Award />} tone="gold" title="Badges & milestones" text="Nineteen achievements celebrate your consistency, accuracy and progress." />
            <Feature icon={<Trophy />} tone="maroon" title="Leaderboards" text="Weekly and all-time rankings with a friendly spirit. You can hide yourself any time." />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ PROGRAMME */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <SectionTitle eyebrow="The programme" title={`${days} days is a guide, not a deadline`} />
            <p className="mt-4 text-ink-2">
              The programme is designed to be completed in about {days} days, roughly one chapter every two weeks. Finish sooner if you are
              keen, or take longer if life gets busy – your progress is always kept and your learning is never locked.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-ink-2">
              {[
                'See your start date, days elapsed and current chapter at a glance',
                'Track completed and remaining chapters with a clear percentage',
                'Retake chapter tests as often as you like – your best score counts',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> {t}
                </li>
              ))}
            </ul>
            <Link to="/programme" className={buttonClass('secondary', 'md', 'mt-7')}>
              Programme details <ArrowRight className="size-4" />
            </Link>
          </motion.div>
          <motion.div {...fadeUp}>
            <Card className="p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-ink-3">Sample progress</p>
                  <p className="mt-1 font-display text-2xl text-ink">Day 64 of {days}</p>
                </div>
                <CalendarDays className="size-8 text-gold" />
              </div>
              <div className="mt-6 space-y-3">
                {['वर्णमाला', 'सम्भाषणम्', 'सर्वनामानि', 'अकारान्तशब्दाः', 'स्त्रीलिङ्गशब्दाः'].map((c, i) => (
                  <div key={c} className="flex items-center gap-3">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${i < 4 ? 'bg-success-soft text-success' : 'bg-gold-soft text-gold-ink ring-2 ring-gold'}`}>
                      {i < 4 ? <CheckCircle2 className="size-5" /> : i + 1}
                    </span>
                    <span lang="sa" className="sanskrit flex-1 text-ink">{c}</span>
                    <span className="text-xs font-semibold text-ink-3">{i < 4 ? `${[92, 85, 100, 78][i]}%` : 'Current'}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-maroon to-gold" />
              </div>
              <p className="mt-2 text-xs text-ink-3">4 of 12 chapters · 33% complete · ahead of pace</p>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------ ABOUT */}
      <section className="relative overflow-hidden bg-[#2a1210] text-[#f4e9da]">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-conic-gradient(from 0deg at 50% 120%, #e0b24c 0deg 4deg, transparent 4deg 12deg)' }} aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[auto_1fr]">
          <motion.img {...fadeUp} src="/images/logo.webp" alt="Mythree emblem" width={220} height={220} className="mx-auto size-44 rounded-full shadow-[0_0_80px_-10px_rgb(224_178_76/0.6)] sm:size-56" />
          <motion.div {...fadeUp}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e0b24c]">About us</p>
            <h2 className="mt-2 text-3xl text-white sm:text-4xl">Maitrī Samskṛta-Samskṛti Pratiṣṭhāna</h2>
            <p className="mt-1 text-[#e0b24c]" lang="kn" style={{ fontFamily: 'var(--font-kannada)' }}>ಮೈತ್ರೀ ಸಂಸ್ಕೃತ-ಸಂಸ್ಕೃತಿ ಪ್ರತಿಷ್ಠಾನ(ರಿ), ಬೆಂಗಳೂರು</p>
            <p className="mt-5 max-w-2xl leading-relaxed text-[#f4e9da]/80">
              Mythree brings Sanskrit into every home – grandparents, parents and children learning together. Our emblem carries the
              Upaniṣadic call <span lang="sa" className="sanskrit text-[#f6dc9c]">स्वाध्यायप्रवचनाभ्यां न प्रमदितव्यम्</span> – “never neglect
              self-study and teaching”.
            </p>
            <Link to="/about" className="mt-7 inline-flex items-center gap-2 font-semibold text-[#f6dc9c] hover:underline">
              Read our story <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------ GURU DAKSHINA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <motion.div {...fadeUp}>
          <Card className="relative overflow-hidden border-gold/40 p-8 sm:p-12">
            <div className="absolute -right-16 -top-16 size-64 rounded-full bg-gold/15 blur-3xl" aria-hidden />
            <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-ink">Guru Dakshina · गुरुदक्षिणा</p>
                <h2 className="mt-2 text-3xl text-ink">An offering of gratitude – entirely voluntary</h2>
                <p className="mt-3 max-w-2xl text-ink-2">
                  Learning on Mythree is free. If you wish, you may offer a Guru Dakshina (suggested ₹{settings?.suggested_contribution ?? 151}) to
                  support textbooks, postage and teachers. It never affects your access, tests, rewards or exam.
                </p>
              </div>
              <Link to="/guru-dakshina" className={buttonClass('gold', 'lg')}>
                <HandHeart className="size-5" /> GURU DAKSHINA
              </Link>
            </div>
          </Card>
        </motion.div>
      </section>

      {/* ------------------------------------------------------------ INSTALL + CONTACT */}
      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-6 md:grid-cols-2">
        <motion.div {...fadeUp}>
          <Card className="flex h-full flex-col p-7">
            <Smartphone className="size-8 text-maroon" />
            <h3 className="mt-4 text-2xl text-ink">Install Mythree on your phone</h3>
            <p className="mt-2 flex-1 text-sm text-ink-3">Add Mythree to your home screen on Android or iPhone for a fast, full-screen app experience – no app store needed.</p>
            <Link to="/install" className={buttonClass('secondary', 'md', 'mt-5 self-start')}>
              How to install
            </Link>
          </Card>
        </motion.div>
        <motion.div {...fadeUp}>
          <Card className="flex h-full flex-col p-7">
            <Mail className="size-8 text-maroon" />
            <h3 className="mt-4 text-2xl text-ink">We are here to help</h3>
            <div className="mt-2 flex-1 space-y-1.5 text-sm text-ink-2">
              {settings?.contact_email && <p className="flex items-center gap-2"><Mail className="size-4 text-ink-3" /> {settings.contact_email}</p>}
              {settings?.contact_phone && <p className="flex items-center gap-2"><Phone className="size-4 text-ink-3" /> {settings.contact_phone}</p>}
              {settings?.contact_address && <p className="flex items-center gap-2"><MapPin className="size-4 text-ink-3" /> {settings.contact_address}</p>}
              <p className="text-ink-3">Questions about textbooks, tests or the final exam? Write to us or ask our help assistant.</p>
            </div>
            <Link to="/contact" className={buttonClass('secondary', 'md', 'mt-5 self-start')}>
              Contact us
            </Link>
          </Card>
        </motion.div>
      </section>
    </div>
  )
}

function FloatingChip({ className, icon, title, sub, delay }: { className: string; icon: ReactNode; title: string; sub: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={`absolute flex items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-[var(--shadow-lift)] backdrop-blur animate-float ${className}`}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-surface-2">{icon}</span>
      <span>
        <span className="block text-sm font-bold text-ink">{title}</span>
        <span className="block text-xs text-ink-3">{sub}</span>
      </span>
    </motion.div>
  )
}

function Feature({ icon, title, text, tone }: { icon: ReactNode; title: string; text: string; tone: 'maroon' | 'gold' | 'saffron' }) {
  const tones = { maroon: 'bg-maroon-soft text-maroon-ink', gold: 'bg-gold-soft text-gold-ink', saffron: 'bg-saffron-soft text-saffron' }
  return (
    <motion.div {...fadeUp}>
      <Card className="group h-full p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
        <div className={`grid size-12 place-items-center rounded-2xl ${tones[tone]} [&_svg]:size-6`}>{icon}</div>
        <h3 className="mt-4 text-xl text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">{text}</p>
      </Card>
    </motion.div>
  )
}
