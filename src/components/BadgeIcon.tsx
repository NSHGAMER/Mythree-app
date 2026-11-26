import {
  Award,
  BookOpen,
  CalendarCheck,
  CalendarHeart,
  CalendarRange,
  Crosshair,
  Flame,
  Footprints,
  GraduationCap,
  Lamp,
  Milestone,
  ScrollText,
  Sparkles,
  Star,
  Sun,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  award: Award,
  'book-open': BookOpen,
  'calendar-check': CalendarCheck,
  'calendar-heart': CalendarHeart,
  'calendar-range': CalendarRange,
  crosshair: Crosshair,
  flame: Flame,
  footprints: Footprints,
  'graduation-cap': GraduationCap,
  lamp: Lamp,
  milestone: Milestone,
  'scroll-text': ScrollText,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  target: Target,
  trophy: Trophy,
}

export const BADGE_ICON_NAMES = Object.keys(ICONS)

export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Award
  return <Icon className={className} aria-hidden />
}
