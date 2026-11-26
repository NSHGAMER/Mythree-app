import { Award, BadgeCheck, CalendarDays, Flame, Mail, MapPin, Phone, Settings, ShieldAlert, Trophy, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonClass, Card, Pill, ProgressBar, StatCard } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks/useAsync'
import { fmtDate, initials, maskPhone, num } from '../../lib/format'
import { levelForXp } from '../../lib/gamification'
import { effectiveStreak } from '../../lib/programme'

export default function ProfilePage() {
  useDocumentTitle('My profile')
  const { profile, user } = useAuth()
  if (!profile) return null
  const lvl = levelForXp(profile.xp)
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-maroon via-[#9c2f3c] to-gold sm:h-36" />
        <div className="-mt-12 flex flex-wrap items-end gap-4 px-5 pb-6 sm:px-8">
          <span className="grid size-24 place-items-center rounded-full border-4 border-surface bg-gradient-to-br from-maroon to-gold font-display text-3xl text-white shadow-lg">{initials(profile.full_name)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl text-ink sm:text-3xl">{profile.full_name}</h1>
            <p className="text-sm text-ink-3">Level {lvl.level} · {lvl.name} · <span lang="sa" className="sanskrit">{lvl.sanskrit}</span></p>
          </div>
          <Link to="/app/settings" className={buttonClass('secondary', 'sm')}><Settings className="size-4" /> Edit profile</Link>
        </div>
        <div className="px-5 pb-6 sm:px-8">
          <ProgressBar value={lvl.progress * 100} tone="gold" label="Level progress" />
          <p className="mt-1.5 text-xs text-ink-3">{lvl.next ? `${num(lvl.xpForNext)} XP to ${lvl.next.name}` : 'Highest level reached'}</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Zap className="size-5" />} tone="gold" label="XP" value={num(profile.xp)} />
        <StatCard icon={<Flame className="size-5" />} tone="saffron" label="Streak" value={effectiveStreak(profile.last_active_date, profile.current_streak)} sub={`Best ${profile.longest_streak}`} />
        <StatCard icon={<CalendarDays className="size-5" />} tone="info" label="Started" value={fmtDate(profile.programme_start_date, { day: 'numeric', month: 'short' })} />
        <StatCard icon={<Trophy className="size-5" />} tone="maroon" label="Role" value={profile.role === 'admin' ? 'Admin' : 'Member'} />
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-xl text-ink">Contact & address</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row icon={<Mail />} label="Email">
            {profile.email} {user?.email_confirmed_at ? <Pill tone="success"><BadgeCheck className="size-3" /> Verified</Pill> : <Pill tone="danger">Unverified</Pill>}
          </Row>
          <Row icon={<Phone />} label="Mobile">
            {maskPhone(profile.phone)}{' '}
            {profile.phone_verified_at ? <Pill tone="success"><BadgeCheck className="size-3" /> Verified</Pill> : <Link to="/verify-phone"><Pill tone="gold"><ShieldAlert className="size-3" /> Verify</Pill></Link>}
          </Row>
          <Row icon={<MapPin />} label="Postal address">
            {profile.address_line1 ? (
              <span>
                {profile.address_line1}
                {profile.address_line2 ? `, ${profile.address_line2}` : ''}, {profile.city}, {profile.state} – {profile.pincode}
              </span>
            ) : (
              <Link to="/app/settings" className="font-semibold text-maroon-ink underline">Add address</Link>
            )}
          </Row>
          <Row icon={<Award />} label="Member since">{fmtDate(profile.created_at)}</Row>
        </dl>
      </Card>
    </div>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-ink-3 [&_svg]:size-5">{icon}</span>
      <div>
        <dt className="text-xs font-bold uppercase tracking-wider text-ink-3">{label}</dt>
        <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink">{children}</dd>
      </div>
    </div>
  )
}
