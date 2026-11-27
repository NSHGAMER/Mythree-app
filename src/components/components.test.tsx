import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../context/AppContext'
import type { GradedResult, QuestionPayload } from '../types'

// ---- mocks -------------------------------------------------------------
const authState = { user: null as null | { id: string }, profile: null as null | { role: string }, loading: false, isAdmin: false }
vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))
const faqMock = vi.fn()
const faqListMock = vi.fn(async () => [] as { id: string; question: string; answer: string; keywords: string[]; category: string; sort_order: number }[])
vi.mock('../lib/api', () => ({ api: { faq: (q: string) => faqMock(q), publishedFaqs: () => faqListMock() } }))
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: () => ({ needRefresh: [false, () => {}], updateServiceWorker: () => {} }) }))

import { Chatbot } from './Chatbot'
import { RequireAdmin, RequireAuth } from './Guards'
import { QuizRunner, ResultView } from './Quiz'
import { ProgressBar } from './ui'
import { detectPlatform } from './Pwa'
import { NotFoundPage } from '../pages/public/StatusPages'

const wrap = (ui: React.ReactNode, path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProvider>{ui}</AppProvider>
    </MemoryRouter>,
  )

afterEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
})

// ---- role permissions (UI layer) ----------------------------------------
describe('route guards', () => {
  const routes = (
    <Routes>
      <Route path="/login" element={<p>LOGIN PAGE</p>} />
      <Route path="/app" element={<RequireAuth><p>MEMBER AREA</p></RequireAuth>} />
      <Route path="/admin" element={<RequireAdmin><p>ADMIN AREA</p></RequireAdmin>} />
    </Routes>
  )
  it('redirects anonymous visitors to login', () => {
    Object.assign(authState, { user: null, profile: null })
    wrap(routes, '/app')
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
  })
  it('lets members into the member area but shows 403 for admin', () => {
    Object.assign(authState, { user: { id: 'u' }, profile: { role: 'member' } })
    wrap(routes, '/app')
    expect(screen.getByText('MEMBER AREA')).toBeInTheDocument()
    wrap(routes, '/admin')
    expect(screen.getByText('Access restricted')).toBeInTheDocument()
    expect(screen.queryByText('ADMIN AREA')).toBeNull()
  })
  it('lets admins into the admin area', () => {
    Object.assign(authState, { user: { id: 'a' }, profile: { role: 'admin' } })
    wrap(routes, '/admin')
    expect(screen.getByText('ADMIN AREA')).toBeInTheDocument()
  })
})

// ---- quiz ---------------------------------------------------------------
const questions: QuestionPayload[] = [
  { id: 'q1', type: 'mcq', prompt: 'Which is a vowel?', options: ['क', 'इ', 'म'] },
  { id: 'q2', type: 'true_false', prompt: 'क is a consonant.', options: ['True', 'False'] },
  { id: 'q3', type: 'fill_blank', prompt: 'Sanskrit for I?', options: [] },
]
const graded: GradedResult = { score: 3, total: 3, percentage: 100, passed: true, xp_awarded: 120, review: [], new_badges: [], already_submitted: false, first_pass: true }

describe('QuizRunner', () => {
  beforeEach(() => Object.defineProperty(navigator, 'onLine', { value: true, configurable: true }))

  it('collects answers in the server format and submits once', async () => {
    const onSubmit = vi.fn().mockResolvedValue(graded)
    const onDone = vi.fn()
    const user = userEvent.setup()
    wrap(<QuizRunner sessionId="s1" title="Chapter 1" questions={questions} onSubmit={onSubmit} onDone={onDone} onExit={() => {}} />)
    await user.click(screen.getByRole('button', { name: /इ/ }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(await screen.findByRole('button', { name: /True/ }, { timeout: 3000 }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(await screen.findByLabelText('Your answer', {}, { timeout: 3000 }), 'अहम्')
    await user.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(graded))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ q1: '1', q2: 'true', q3: 'अहम्' })
  })

  it('does not submit while offline and keeps answers', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const onSubmit = vi.fn()
    wrap(<QuizRunner sessionId="s2" title="T" questions={[questions[1]]} onSubmit={onSubmit} onDone={() => {}} onExit={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /True/ }))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText(/Nothing has been submitted yet/)).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('mythree-answers-s2')!)).toEqual({ q2: 'true' })
  })

  it('asks for confirmation when questions are unanswered', async () => {
    const onSubmit = vi.fn().mockResolvedValue(graded)
    wrap(<QuizRunner sessionId="s3" title="T" questions={[questions[1]]} onSubmit={onSubmit} onDone={() => {}} onExit={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(await screen.findByText(/Submit with unanswered questions/)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('ResultView', () => {
  it('shows score, XP and completion', () => {
    wrap(<ResultView result={graded} title="Chapter 1" actions={null} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('+120 XP')).toBeInTheDocument()
    expect(screen.getByText('Chapter completed')).toBeInTheDocument()
  })
})

// ---- chatbot -------------------------------------------------------------
describe('Chatbot', () => {
  it('answers from the FAQ when confident', async () => {
    faqMock.mockResolvedValue({ matches: [{ id: '1', question: 'Is it compulsory?', answer: 'Guru Dakshina is completely voluntary.', category: 'x', score: 0.9 }] })
    const user = userEvent.setup()
    wrap(<Chatbot />)
    await user.click(screen.getByRole('button', { name: /open help chat/i }))
    await user.type(screen.getByLabelText('Your question'), 'do I have to pay')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Guru Dakshina is completely voluntary.')).toBeInTheDocument()
  })

  it('does not invent answers – hands over to contact guidance', async () => {
    faqMock.mockResolvedValue({ matches: [{ id: '2', question: 'x', answer: 'WRONG ANSWER', category: 'x', score: 0.33 }] })
    const user = userEvent.setup()
    wrap(<Chatbot />)
    await user.click(screen.getByRole('button', { name: /open help chat/i }))
    await user.type(screen.getByLabelText('Your question'), 'what is the weather')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(/don't want to guess/)).toBeInTheDocument()
    expect(screen.queryByText('WRONG ANSWER')).toBeNull()
    expect(screen.getByText(/Open the contact page/)).toBeInTheDocument()
  })
})

describe('Chatbot suggested questions', () => {
  const list = [
    { id: 'a', question: 'How do I complete a chapter?', answer: 'Score the pass mark in its test.', keywords: ['chapter', 'complete'], category: 'Learning', sort_order: 1 },
    { id: 'b', question: 'What are weekly tests?', answer: 'A longer weekly challenge.', keywords: ['weekly'], category: 'Challenges', sort_order: 2 },
  ]
  it('shows only published FAQ questions and fills the input without sending', async () => {
    faqListMock.mockResolvedValue(list)
    const user = userEvent.setup()
    wrap(<Chatbot />)
    await user.click(screen.getByRole('button', { name: /open help chat/i }))
    await user.click(screen.getByRole('button', { name: /show suggested questions/i }))
    const options = await screen.findAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(list.map((l) => l.question))
    await user.click(within(screen.getByRole('listbox')).getByRole('button', { name: 'What are weekly tests?' }))
    expect(screen.getByLabelText('Your question')).toHaveValue('What are weekly tests?')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(faqMock).not.toHaveBeenCalled()
  })
  it('supports keyboard selection and Escape', async () => {
    faqListMock.mockResolvedValue(list)
    const user = userEvent.setup()
    wrap(<Chatbot />)
    await user.click(screen.getByRole('button', { name: /open help chat/i }))
    await user.click(screen.getByRole('button', { name: /show suggested questions/i }))
    await screen.findAllByRole('option')
    const input = screen.getByLabelText('Your question')
    input.focus()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(input).toHaveValue('What are weekly tests?')
    await user.click(screen.getByRole('button', { name: /show suggested questions/i }))
    await screen.findAllByRole('option')
    input.focus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  })
  it('answers instantly from cached FAQs when confident (no server call)', async () => {
    faqListMock.mockResolvedValue(list)
    const user = userEvent.setup()
    wrap(<Chatbot />)
    await user.click(screen.getByRole('button', { name: /open help chat/i }))
    await waitFor(() => expect(faqListMock).toHaveBeenCalled())
    await user.type(screen.getByLabelText('Your question'), 'how to complete chapter')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Score the pass mark in its test.')).toBeInTheDocument()
    expect(faqMock).not.toHaveBeenCalled()
  })
})

// ---- misc UI ---------------------------------------------------------------
describe('UI primitives & pages', () => {
  it('ProgressBar exposes accessible, clamped values', () => {
    render(<ProgressBar value={140} label="Done" />)
    expect(screen.getByRole('progressbar', { name: 'Done' })).toHaveAttribute('aria-valuenow', '100')
  })
  it('404 page renders', () => {
    wrap(<NotFoundPage />)
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })
})

describe('PWA platform detection', () => {
  const setUA = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  it('detects iPhone Safari (needs Add to Home Screen instructions)', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
    const p = detectPlatform()
    expect(p.isIOS).toBe(true)
    expect(p.isIOSSafari).toBe(true)
    expect(p.isAndroid).toBe(false)
  })
  it('detects Chrome on iOS as not Safari', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1')
    expect(detectPlatform().isIOSSafari).toBe(false)
  })
  it('detects Android', () => {
    setUA('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36')
    act(() => {})
    expect(detectPlatform().isAndroid).toBe(true)
  })
})
