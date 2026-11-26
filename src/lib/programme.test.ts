import { describe, expect, it } from 'vitest'
import { daysBetween, effectiveStreak, isChapterCompleted, istToday, programmeStatus } from './programme'

describe('programmeStatus', () => {
  const base = { startDate: '2026-01-01', targetDays: 180, total: 12 }

  it('counts day 1 on the start date', () => {
    expect(programmeStatus({ ...base, today: '2026-01-01', completed: 0 }).dayNumber).toBe(1)
  })

  it('never treats passing 180 days as a lock – shows encouragement instead', () => {
    const s = programmeStatus({ ...base, today: '2026-09-01', completed: 5 })
    expect(s.beyondTarget).toBe(true)
    expect(s.daysRemainingToTarget).toBe(0)
    expect(s.message).toMatch(/nothing is ever locked/i)
    expect(s.timeProgress).toBe(1)
  })

  it('reports completion when all chapters are done', () => {
    const s = programmeStatus({ ...base, today: '2026-03-01', completed: 12 })
    expect(s.pace).toBe('complete')
    expect(s.completionProgress).toBe(1)
    expect(s.message).toMatch(/60 days/)
  })

  it('detects ahead / behind pace', () => {
    expect(programmeStatus({ ...base, today: '2026-02-01', completed: 6 }).pace).toBe('ahead')
    expect(programmeStatus({ ...base, today: '2026-05-01', completed: 1 }).pace).toBe('behind')
  })

  it('clamps nonsense input', () => {
    const s = programmeStatus({ startDate: '2026-01-10', today: '2026-01-01', targetDays: 0, completed: 99, total: 4 })
    expect(s.dayNumber).toBe(1)
    expect(s.completionProgress).toBe(1)
  })
})

describe('date helpers', () => {
  it('daysBetween handles month and leap boundaries', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
  })
  it('istToday uses India time', () => {
    // 20:00 UTC on 1 Jan is 01:30 on 2 Jan in India
    expect(istToday(new Date('2026-01-01T20:00:00Z'))).toBe('2026-01-02')
  })
})

describe('effectiveStreak', () => {
  it('keeps the streak if active today or yesterday', () => {
    expect(effectiveStreak('2026-05-10', 7, '2026-05-10')).toBe(7)
    expect(effectiveStreak('2026-05-09', 7, '2026-05-10')).toBe(7)
  })
  it('breaks the streak after a missed day', () => {
    expect(effectiveStreak('2026-05-08', 7, '2026-05-10')).toBe(0)
    expect(effectiveStreak(null, 3, '2026-05-10')).toBe(0)
  })
})

describe('chapter completion criteria', () => {
  it('is complete at or above the pass mark', () => {
    expect(isChapterCompleted(70, 70)).toBe(true)
    expect(isChapterCompleted(69.99, 70)).toBe(false)
  })
})
