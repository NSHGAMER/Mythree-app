// Pure helpers for the 180-day programme. Nothing here ever locks a member out:
// the target is guidance only.

export const IST_TZ = 'Asia/Kolkata'

/** Today's date in India as YYYY-MM-DD. */
export function istToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10))
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10))
  return Math.round((b - a) / 86_400_000)
}

export interface ProgrammeStatus {
  dayNumber: number
  targetDays: number
  daysRemainingToTarget: number
  beyondTarget: boolean
  timeProgress: number
  completionProgress: number
  pace: 'ahead' | 'on_track' | 'behind' | 'complete' | 'not_started'
  expectedChapters: number
  message: string
}

export function programmeStatus(input: {
  startDate: string
  today?: string
  targetDays: number
  completed: number
  total: number
}): ProgrammeStatus {
  const today = input.today ?? istToday()
  const targetDays = Math.max(1, input.targetDays)
  const dayNumber = Math.max(1, daysBetween(input.startDate, today) + 1)
  const total = Math.max(0, input.total)
  const completed = Math.min(Math.max(0, input.completed), total)
  const timeProgress = Math.min(1, dayNumber / targetDays)
  const completionProgress = total === 0 ? 0 : completed / total
  const expectedChapters = Math.min(total, Math.floor(timeProgress * total))
  const beyondTarget = dayNumber > targetDays

  let pace: ProgrammeStatus['pace']
  if (total > 0 && completed >= total) pace = 'complete'
  else if (completed === 0 && dayNumber <= 7) pace = 'not_started'
  else if (completed > expectedChapters) pace = 'ahead'
  else if (completed >= expectedChapters - 1) pace = 'on_track'
  else pace = 'behind'

  let message: string
  switch (pace) {
    case 'complete':
      message = `All chapters completed in ${dayNumber} day${dayNumber === 1 ? '' : 's'}. Wonderful!`
      break
    case 'not_started':
      message = 'Your journey begins. Read Chapter 1 from your textbook, then take its test.'
      break
    case 'ahead':
      message = 'You are ahead of the suggested pace. Keep the momentum!'
      break
    case 'on_track':
      message = 'You are on track with the suggested pace.'
      break
    default:
      message = beyondTarget
        ? `Day ${dayNumber} – beyond the ${targetDays}-day target, and that is perfectly fine. Learn at your own pace; nothing is ever locked.`
        : 'A little behind the suggested pace – a chapter this week will catch you up.'
  }

  return {
    dayNumber,
    targetDays,
    daysRemainingToTarget: Math.max(0, targetDays - dayNumber),
    beyondTarget,
    timeProgress,
    completionProgress,
    pace,
    expectedChapters,
    message,
  }
}

/** A streak is shown as broken once a full IST day passes with no activity (mirrors effective_streak in SQL). */
export function effectiveStreak(lastActive: string | null, streak: number, today: string = istToday()) {
  if (!lastActive) return 0
  return daysBetween(lastActive, today) <= 1 ? streak : 0
}

export function isChapterCompleted(bestPercentage: number, passPercentage: number) {
  return bestPercentage >= passPercentage
}
