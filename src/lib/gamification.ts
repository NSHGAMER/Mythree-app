// Display-side helpers. XP itself is always calculated and stored by the database;
// these functions only turn the server's numbers into levels and labels.

export interface Level {
  level: number
  name: string
  sanskrit: string
  minXp: number
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Beginner', sanskrit: 'आरम्भकः', minXp: 0 },
  { level: 2, name: 'Seeker', sanskrit: 'जिज्ञासुः', minXp: 200 },
  { level: 3, name: 'Disciple', sanskrit: 'शिष्यः', minXp: 500 },
  { level: 4, name: 'Practitioner', sanskrit: 'अभ्यासी', minXp: 1000 },
  { level: 5, name: 'Student', sanskrit: 'अध्येता', minXp: 1800 },
  { level: 6, name: 'Scholar', sanskrit: 'विद्यार्थी', minXp: 2800 },
  { level: 7, name: 'Learned', sanskrit: 'पण्डितः', minXp: 4000 },
  { level: 8, name: 'Erudite', sanskrit: 'विद्वान्', minXp: 6000 },
  { level: 9, name: 'Teacher', sanskrit: 'आचार्यः', minXp: 9000 },
]

export function levelForXp(xp: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0))
  let current = LEVELS[0]
  for (const l of LEVELS) if (safe >= l.minXp) current = l
  const next = LEVELS.find((l) => l.minXp > safe) ?? null
  const span = next ? next.minXp - current.minXp : 1
  const into = safe - current.minXp
  return {
    ...current,
    xp: safe,
    next,
    xpIntoLevel: into,
    xpForNext: next ? next.minXp - safe : 0,
    progress: next ? Math.min(1, into / span) : 1,
  }
}

/** Mirrors the server XP rules so the UI can explain what a member will earn. */
export const XP_RULES = {
  chapterPassDefault: 100,
  perfectBonus: 20,
  failedAttempt: 5,
  failedAttemptCap: 3,
  dailyBase: 10,
  dailyPerCorrect: 4,
  weeklyPassBase: 100,
  weeklyPerCorrect: 5,
  weeklyParticipation: 20,
}

export function previewDailyXp(correct: number) {
  return XP_RULES.dailyBase + XP_RULES.dailyPerCorrect * Math.max(0, correct)
}

export function previewWeeklyXp(correct: number, passed: boolean) {
  return passed ? XP_RULES.weeklyPassBase + XP_RULES.weeklyPerCorrect * Math.max(0, correct) : XP_RULES.weeklyParticipation
}

export const TIER_STYLES: Record<string, { ring: string; bg: string; text: string; label: string }> = {
  bronze: { ring: 'ring-[#c08552]/50', bg: 'bg-[#f6e3d2] dark:bg-[#3a2618]', text: 'text-[#8a5228] dark:text-[#e0a77a]', label: 'Bronze' },
  silver: { ring: 'ring-[#9aa3ad]/60', bg: 'bg-[#eceff2] dark:bg-[#262b31]', text: 'text-[#5b6570] dark:text-[#c4ccd5]', label: 'Silver' },
  gold: { ring: 'ring-gold/60', bg: 'bg-gold-soft', text: 'text-gold-ink', label: 'Gold' },
  platinum: { ring: 'ring-maroon/50', bg: 'bg-maroon-soft', text: 'text-maroon-ink', label: 'Platinum' },
}
