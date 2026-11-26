import { describe, expect, it } from 'vitest'
import { LEVELS, levelForXp, previewDailyXp, previewWeeklyXp, XP_RULES } from './gamification'

describe('levelForXp', () => {
  it('starts at level 1 with 0 XP', () => {
    const l = levelForXp(0)
    expect(l.level).toBe(1)
    expect(l.next?.level).toBe(2)
    expect(l.progress).toBe(0)
  })

  it('reaches a level exactly at its threshold', () => {
    expect(levelForXp(200).level).toBe(2)
    expect(levelForXp(199).level).toBe(1)
    expect(levelForXp(9000).level).toBe(9)
  })

  it('computes progress and XP remaining', () => {
    const l = levelForXp(350) // between 200 and 500
    expect(l.level).toBe(2)
    expect(l.xpForNext).toBe(150)
    expect(l.progress).toBeCloseTo(0.5)
  })

  it('caps at the highest level', () => {
    const l = levelForXp(1_000_000)
    expect(l.level).toBe(LEVELS.length)
    expect(l.next).toBeNull()
    expect(l.progress).toBe(1)
  })

  it('treats invalid input as zero', () => {
    expect(levelForXp(-50).level).toBe(1)
    expect(levelForXp(Number.NaN).xp).toBe(0)
  })

  it('has strictly increasing thresholds', () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].minXp).toBeGreaterThan(LEVELS[i - 1].minXp)
  })
})

describe('XP previews mirror the server rules', () => {
  it('daily: 10 base + 4 per correct answer', () => {
    expect(previewDailyXp(0)).toBe(10)
    expect(previewDailyXp(5)).toBe(30)
  })
  it('weekly: pass bonus vs participation', () => {
    expect(previewWeeklyXp(8, true)).toBe(XP_RULES.weeklyPassBase + 8 * XP_RULES.weeklyPerCorrect)
    expect(previewWeeklyXp(3, false)).toBe(XP_RULES.weeklyParticipation)
  })
})
