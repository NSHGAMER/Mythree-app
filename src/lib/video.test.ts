import { describe, expect, it } from 'vitest'
import { fmtDuration, isVideoComplete, youtubeId } from './video'

describe('youtubeId', () => {
  it.each([
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('%s', (input, id) => expect(youtubeId(input)).toBe(id))
  it('rejects other links', () => {
    expect(youtubeId('https://example.com/video.mp4')).toBeNull()
    expect(youtubeId('hello')).toBeNull()
  })
})

describe('video completion rule (mirrors the server)', () => {
  it('requires the configured share of the duration to be watched', () => {
    expect(isVideoComplete(539, 600, 90)).toBe(false)
    expect(isVideoComplete(540, 600, 90)).toBe(true)
    expect(isVideoComplete(0, 0, 90)).toBe(false)
  })
  it('formats durations', () => {
    expect(fmtDuration(75)).toBe('1:15')
    expect(fmtDuration(3725)).toBe('1:02:05')
  })
})
