import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { QuizRunner, ResultView } from '../../components/Quiz'
import { buttonClass, EmptyState, SkeletonCards } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import type { GradedResult } from '../../types'

export default function ChallengePlayPage() {
  const { kind } = useParams()
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const valid = kind === 'daily' || kind === 'weekly'
  const { data: session, error, loading } = useAsync(() => (valid ? api.challenge(kind) : Promise.reject(new Error('Not found'))), [kind])
  const [result, setResult] = useState<GradedResult | null>(null)
  useDocumentTitle(kind === 'weekly' ? 'Weekly challenge' : 'Daily challenge')

  if (!valid) return <Navigate to="/app/challenges" replace />
  if (loading) return <SkeletonCards count={1} className="mx-auto max-w-2xl" />
  if (error || !session)
    return (
      <EmptyState title="Challenge unavailable" action={<Link to="/app/challenges" className={buttonClass('primary')}>Back</Link>}>
        {friendlyError(error)}
      </EmptyState>
    )

  const title = kind === 'daily' ? `Daily challenge · ${session.period_key}` : `Weekly challenge · ${session.period_key}`
  const shown: GradedResult | null = result ?? (session.submitted && session.result ? { ...session.result, new_badges: [], already_submitted: true } : null)

  if (shown) {
    return (
      <ResultView
        result={shown}
        title={title}
        passLabel={kind === 'daily' ? 'Daily practice done!' : 'Weekly challenge passed!'}
        actions={
          <>
            <Link to="/app/challenges" className={buttonClass('outline')}>All challenges</Link>
            <Link to="/app/learn" className={buttonClass('primary')}>Continue learning</Link>
          </>
        }
      />
    )
  }

  return (
    <QuizRunner
      sessionId={session.instance_id}
      title={title}
      subtitle={kind === 'weekly' ? `Pass mark ${session.weekly_pass_percentage}%` : 'Every correct answer earns XP'}
      questions={session.questions}
      onSubmit={(answers) => api.submitChallenge(session.instance_id, answers)}
      onDone={(r) => {
        setResult(r)
        refreshProfile()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
      onExit={() => navigate('/app/challenges')}
    />
  )
}
