import { AnimatePresence, motion } from 'motion/react'
import {
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bell,
  CalendarClock,
  GraduationCap,
  ClipboardList,
  Flame,
  HandHeart,
  HelpCircle,
  Home,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Monitor,
  Moon,
  PlayCircle,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  Swords,
  Trophy,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { levelForXp } from '../lib/gamification'
import { initials } from '../lib/format'
import { effectiveStreak } from '../lib/programme'
import { Logo, Wordmark } from './Brand'
import { Chatbot } from './Chatbot'
import { CookieBanner } from './CookieBanner'
import { InstallBanner, OfflineBanner } from './Pwa'
import { buttonClass, cx, SkeletonCards } from './ui'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useApp()
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  return (
    <button
      onClick={() => setTheme(next)}
      className={cx('grid size-10 place-items-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink', className)}
      aria-label={`Theme: ${theme}. Switch to ${next}`}
      title={`Theme: ${theme}`}
    >
      <Icon className="size-5" />
    </button>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

export function PageFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SkeletonCards count={3} className="sm:grid-cols-3" />
    </div>
  )
}

// ======================================================================= Public
const publicLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/programme', label: 'Programme' },
  { to: '/contact', label: 'Contact' },
]

export function PublicLayout() {
  const { user, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <OfflineBanner />
      <header className="sticky top-0 z-50 border-b border-line/70 bg-bg/85 backdrop-blur-xl safe-top no-print">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[4.5rem]">
          <Wordmark />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {publicLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cx('rounded-lg px-3.5 py-2 text-sm font-semibold transition', isActive ? 'text-maroon-ink' : 'text-ink-2 hover:text-ink')
                }
              >
                {l.label}
              </NavLink>
            ))}
            <NavLink
              to="/guru-dakshina"
              className={({ isActive }) =>
                cx(
                  'ml-1 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold tracking-[0.12em] transition',
                  isActive ? 'border-gold bg-gold-soft text-gold-ink' : 'border-gold/50 text-gold-ink hover:bg-gold-soft',
                )
              }
            >
              <HandHeart className="size-4" /> GURU DAKSHINA
            </NavLink>
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {/* Wrapper controls visibility so it never conflicts with the buttons' own display class */}
            <div className="hidden items-center gap-1.5 sm:flex">
              {user ? (
                <Link to={isAdmin ? '/admin' : '/app'} className={buttonClass('primary', 'sm')}>
                  <LayoutDashboard className="size-4" /> {isAdmin ? 'Admin' : 'My Dashboard'}
                </Link>
              ) : (
                <>
                  <Link to="/login" className={buttonClass('ghost', 'sm')}>
                    Login
                  </Link>
                  <Link to="/register" className={buttonClass('primary', 'sm')}>
                    Register
                  </Link>
                </>
              )}
            </div>
            <button className="grid size-10 place-items-center rounded-xl text-ink lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-6" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-[#1a0f0c]/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="absolute inset-y-0 right-0 flex w-[82%] max-w-sm flex-col bg-bg p-5 safe-top"
              aria-label="Mobile"
            >
              <div className="mb-6 flex items-center justify-between">
                <Wordmark compact />
                <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl hover:bg-surface-2" aria-label="Close menu">
                  <X className="size-6" />
                </button>
              </div>
              {publicLinks.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cx('rounded-xl px-4 py-3.5 text-lg font-semibold', isActive ? 'bg-maroon-soft text-maroon-ink' : 'text-ink')}>
                  {l.label}
                </NavLink>
              ))}
              <NavLink to="/guru-dakshina" className="mt-2 flex items-center gap-2 rounded-xl border border-gold/60 bg-gold-soft px-4 py-3.5 text-sm font-bold tracking-[0.12em] text-gold-ink">
                <HandHeart className="size-5" /> GURU DAKSHINA
              </NavLink>
              <div className="mt-auto grid gap-3 pt-6">
                {user ? (
                  <Link to={isAdmin ? '/admin' : '/app'} className={buttonClass('primary', 'lg')}>
                    {isAdmin ? 'Admin dashboard' : 'My Dashboard'}
                  </Link>
                ) : (
                  <>
                    <Link to="/register" className={buttonClass('primary', 'lg')}>
                      Register
                    </Link>
                    <Link to="/login" className={buttonClass('outline', 'lg')}>
                      Login
                    </Link>
                  </>
                )}
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="main" className="flex-1">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <PublicFooter />
      <Chatbot />
      <CookieBanner />
      <InstallBanner />
    </div>
  )
}

export function PublicFooter() {
  const { settings } = useApp()
  return (
    <footer className="mt-16 border-t border-line bg-surface-2/60 no-print">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <Logo size={52} />
            <div>
              <p className="font-display text-2xl text-maroon-ink">Mythree</p>
              <p className="sanskrit text-gold-ink" lang="sa">संस्कृतगृहम्</p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm text-ink-3">
            A home for Sanskrit learning. Read your printed textbook, practise in the app, and grow with a community of learners.
          </p>
          <p className="mt-3 text-sm text-ink-2" lang="kn" style={{ fontFamily: 'var(--font-kannada)' }}>
            ಮೈತ್ರೀ ಸಂಸ್ಕೃತ-ಸಂಸ್ಕೃತಿ ಪ್ರತಿಷ್ಠಾನ(ರಿ), ಬೆಂಗಳೂರು
          </p>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-3">Explore</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="text-ink-2 hover:text-maroon-ink" to="/about">About us</Link></li>
            <li><Link className="text-ink-2 hover:text-maroon-ink" to="/programme">Learning programme</Link></li>
            <li><Link className="text-ink-2 hover:text-maroon-ink" to="/guru-dakshina">Guru Dakshina</Link></li>
            <li><Link className="text-ink-2 hover:text-maroon-ink" to="/contact">Contact</Link></li>
            <li><Link className="text-ink-2 hover:text-maroon-ink" to="/install">Install the app</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-3">Legal</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="text-ink-2 hover:text-maroon-ink" to="/privacy">Privacy Policy</Link></li>
            <li><Link className="text-ink-2 hover:text-maroon-ink" to="/terms">Terms of Service</Link></li>
            <li><Link className="text-ink-2 hover:text-maroon-ink" to="/cookies">Cookie Preferences</Link></li>
          </ul>
          {settings?.contact_email && (
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-2">
              <Mail className="size-4" /> {settings.contact_email}
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-ink-3">
        © {new Date().getFullYear()} Mythree – संस्कृतगृहम्. All rights reserved.
      </div>
    </footer>
  )
}

// ======================================================================= Member app
const memberNav = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/learn', label: 'Learn', icon: BookOpen },
  { to: '/app/videos', label: 'Video classes', icon: PlayCircle },
  { to: '/app/challenges', label: 'Challenges', icon: Swords },
  { to: '/app/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/app/achievements', label: 'Achievements', icon: Award },
  { to: '/app/history', label: 'History', icon: ClipboardList },
  { to: '/app/final-exam', label: 'Final Exam', icon: ScrollText },
  { to: '/app/exam', label: 'Exam & results', icon: GraduationCap },
]
const mobileNav = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/learn', label: 'Learn', icon: BookOpen },
  { to: '/app/challenges', label: 'Practice', icon: Swords },
  { to: '/app/leaderboard', label: 'Ranks', icon: Trophy },
  { to: '/app/profile', label: 'Me', icon: User },
]

function UserMenu({ admin = false }: { admin?: boolean }) {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  if (!profile) return null
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2" aria-haspopup="menu" aria-expanded={open}>
        <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-maroon to-gold text-sm font-bold text-white">{initials(profile.full_name)}</span>
        <span className="hidden max-w-32 truncate text-sm font-semibold text-ink md:block">{profile.full_name.split(' ')[0]}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]" onClick={() => setOpen(false)}>
            <p className="truncate px-3 py-2 text-xs text-ink-3">{profile.email}</p>
            <Link role="menuitem" to="/app/profile" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><User className="size-4" /> My profile</Link>
            <Link role="menuitem" to="/app/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><Settings className="size-4" /> Account settings</Link>
            <Link role="menuitem" to="/app/guru-dakshina" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><HandHeart className="size-4" /> Guru Dakshina</Link>
            {isAdmin && !admin && <Link role="menuitem" to="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><ShieldCheck className="size-4" /> Admin dashboard</Link>}
            {admin && <Link role="menuitem" to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><Home className="size-4" /> Public website</Link>}
            <button
              role="menuitem"
              onClick={async () => {
                await signOut()
                navigate('/login', { replace: true })
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Pages a member may open before the registration fee is verified.
const PENDING_ALLOWED = ['/app/registration', '/app/settings', '/app/profile']

export function MemberLayout() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const lvl = levelForXp(profile?.xp ?? 0)
  if (profile && profile.role === 'member' && profile.registration_status && profile.registration_status !== 'confirmed' && !PENDING_ALLOWED.includes(pathname)) {
    return <Navigate to="/app/registration" replace />
  }
  return (
    <div className="min-h-dvh lg:pl-64">
      <ScrollToTop />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface/80 px-4 py-5 backdrop-blur lg:flex no-print">
        <Wordmark to="/app" />
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Member">
          {memberNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.95rem] font-semibold transition', isActive ? 'bg-maroon-soft text-maroon-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
              <Icon className="size-5" /> {label}
            </NavLink>
          ))}
          <NavLink to="/app/guru-dakshina" className={({ isActive }) => cx('mt-3 flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-bold tracking-[0.12em] transition', isActive ? 'border-gold bg-gold-soft text-gold-ink' : 'border-gold/40 text-gold-ink hover:bg-gold-soft')}>
            <HandHeart className="size-5" /> GURU DAKSHINA
          </NavLink>
        </nav>
        <div className="rounded-2xl bg-gradient-to-br from-maroon to-[#4a1219] p-4 text-white">
          <p className="text-xs uppercase tracking-widest text-white/70">Level {lvl.level}</p>
          <p className="font-display text-lg">{lvl.name}</p>
          <p className="sanskrit text-sm text-[#f1cf7d]" lang="sa">{lvl.sanskrit}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-[#f1cf7d]" style={{ width: `${lvl.progress * 100}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-white/70">{lvl.next ? `${lvl.xpForNext} XP to ${lvl.next.name}` : 'Highest level reached'}</p>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-xl safe-top no-print">
        <OfflineBanner />
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="lg:hidden">
            <Wordmark to="/app" compact />
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-1 rounded-full bg-saffron-soft px-3 py-1.5 text-sm font-bold text-saffron" title="Daily streak">
              <Flame className="size-4" /> {profile ? effectiveStreak(profile.last_active_date, profile.current_streak) : 0}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-gold-soft px-3 py-1.5 text-sm font-bold text-gold-ink" title="Total XP">
              <Zap className="size-4" /> {profile?.xp ?? 0}
            </div>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-xl safe-bottom lg:hidden no-print" aria-label="Member mobile">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {mobileNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold transition', isActive ? 'text-maroon-ink' : 'text-ink-3')}>
              {({ isActive }) => (
                <>
                  <span className={cx('grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-maroon-soft')}>
                    <Icon className="size-5" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      <Chatbot />
      <InstallBanner />
    </div>
  )
}

// ======================================================================= Admin
const adminNav = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/registrations', label: 'Registrations & UIDs', icon: BadgeCheck },
  { to: '/admin/exams', label: 'Final exam & dispatch', icon: ScrollText },
  { to: '/admin/exam-schedules', label: 'Exam schedules', icon: CalendarClock },
  { to: '/admin/evaluation', label: 'Evaluation & results', icon: GraduationCap },
  { to: '/admin/chapters', label: 'Chapters & questions', icon: BookOpen },
  { to: '/admin/challenges', label: 'Daily & weekly tests', icon: Swords },
  { to: '/admin/videos', label: 'Video lessons', icon: PlayCircle },
  { to: '/admin/contributions', label: 'Guru Dakshina', icon: IndianRupee },
  { to: '/admin/faqs', label: 'Chatbot FAQs', icon: HelpCircle },
  { to: '/admin/messages', label: 'Messages', icon: Mail },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {adminNav.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition', isActive ? 'bg-[#f1cf7d]/15 text-[#f6dc9c]' : 'text-[#e9dccb]/75 hover:bg-white/5 hover:text-white')}>
          <Icon className="size-[1.15rem]" /> {label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-dvh lg:pl-72">
      <ScrollToTop />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-[#2a1210] px-5 py-6 lg:flex no-print">
        <AdminBrand />
        <div className="mt-8 flex-1 overflow-y-auto">{nav}</div>
        <Link to="/app" className="mt-4 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-semibold text-[#e9dccb]/80 hover:bg-white/5">Member view →</Link>
      </aside>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} className="absolute inset-y-0 left-0 flex w-[80%] max-w-xs flex-col bg-[#2a1210] p-5 safe-top">
              <AdminBrand />
              <div className="mt-6 flex-1 overflow-y-auto">{nav}</div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-xl safe-top no-print">
        <OfflineBanner />
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <button className="grid size-10 place-items-center rounded-xl lg:hidden" onClick={() => setOpen(true)} aria-label="Open admin menu">
            <Menu className="size-6" />
          </button>
          <p className="hidden text-sm font-semibold text-ink-3 lg:block">Administration</p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu admin />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[90rem] px-4 pb-16 pt-6 sm:px-6">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

function AdminBrand() {
  return (
    <Link to="/admin" className="flex items-center gap-3">
      <Logo size={44} />
      <div>
        <p className="font-display text-xl text-[#f6dc9c]">Mythree</p>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e9dccb]/60">Admin</p>
      </div>
    </Link>
  )
}

export function CenteredShell({ children }: { children: ReactNode }) {
  return (
    <div className="paisley-bg flex min-h-dvh flex-col">
      <OfflineBanner />
      <div className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Wordmark />
        <ThemeToggle />
      </div>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center">
        {children}
      </main>
    </div>
  )
}
