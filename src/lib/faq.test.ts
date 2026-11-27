import { describe, expect, it } from 'vitest'
import { CONFIDENCE, matchFaqs, similarity, tokens, type FaqItem } from './faq'

const faqs: FaqItem[] = [
  { id: '1', question: 'What is Guru Dakshina? Is it compulsory?', answer: 'Voluntary.', keywords: ['guru', 'dakshina', 'payment', 'fee', 'pay', 'compulsory', 'free'], category: 'GD' },
  { id: '2', question: 'What is XP and how do I earn it?', answer: 'XP…', keywords: ['xp', 'points', 'score', 'earn', 'level'], category: 'Rewards' },
  { id: '3', question: 'How do I install the Mythree app on my phone?', answer: 'Install…', keywords: ['install', 'app', 'phone', 'android', 'iphone'], category: 'App' },
  { id: '4', question: 'What is a streak?', answer: 'Streak…', keywords: ['streak', 'days', 'row'], category: 'Rewards' },
]

describe('client FAQ matching (mirrors faq_answer)', () => {
  it('drops stop words', () => {
    expect(tokens('What is the streak?')).toEqual(['streak'])
  })
  it('answers confident questions', () => {
    expect(matchFaqs('is guru dakshina compulsory', faqs)[0].id).toBe('1')
    expect(matchFaqs('do i have to pay', faqs)[0].id).toBe('1')
    expect(matchFaqs('how to install app on iphone', faqs)[0].id).toBe('3')
    expect(matchFaqs('what is a streak', faqs)[0].score).toBeGreaterThanOrEqual(CONFIDENCE)
  })
  it('does not answer unrelated questions confidently (no invented answers)', () => {
    const m = matchFaqs('cricket score today', faqs)
    expect(m.length === 0 || m[0].score < CONFIDENCE).toBe(true)
    expect(matchFaqs('tell me a joke', faqs)).toEqual([])
  })
  it('similarity behaves like pg_trgm', () => {
    expect(similarity('streak', 'streak')).toBe(1)
    expect(similarity('streak', 'xyz')).toBe(0)
  })
})
