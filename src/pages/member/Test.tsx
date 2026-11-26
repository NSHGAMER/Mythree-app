import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QuizRunner, ResultView } from '../../components/Quiz'
import { Button, buttonClass, EmptyState, SkeletonCards } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks/useAsync'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import type { GradedResult } from '../../types'

export default function TestPage() {
  const { chapterId } = useParams()
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [attemptKey, setAttemptKey] = useState(0)
  const { data: session, error, loading } = useAsync(() => api.startTest(chapterId!), [chapterId, attemptKey])
  const [result, setResult] = useState<GradedResult | null>(null)
  useDocumentTitle(session ? `Test – ${session.chapter.title}` : 'Chapter test')

  if (loading) return <SkeletonCards count={1} className="mx-auto max-w-2xl" />
  if (error || !session)
    return (
      <EmptyState title="Can't start this test" action={<Link to={`/app/learn/${chapterId}`} className={buttonClass('primary')}>Back to chapter</Link>}>
        {friendlyError(error)}
      </EmptyState>
    )

  if (result) {
    return (
      <ResultView
        result={result}
        title={`Chapter ${session.chapter.position} · ${session.chapter.title}`}
        passLabel={result.first_pass ? 'Chapter completed!' : 'Passed!'}
        actions={
          <>
            <Button
              variant="outline"
              icon={<RotateCcw className="size-4" />}
              onClick={() => {
                setResult(null)
                setAttemptKey((k) => k + 1)
              }}
            >
              Try again
            </Button>
            <Link to="/app/learn" className={buttonClass('primary')}>
              Continue learning
            </Link>
          </>
        }
      />
    )
  }

  return (
    <QuizRunner
      key={session.attempt_id}
      sessionId={session.attempt_id}
      title={`Chapter ${session.chapter.position}: ${session.chapter.title}`}
      subtitle={`Pass mark ${session.chapter.pass_percentage}%`}
      questions={session.questions}
      startedAt={session.started_at}
      timeLimitMinutes={session.chapter.time_limit_minutes}
      onSubmit={(answers) => api.submitTest(session.attempt_id, answers)}
      onDone={(r) => {
        setResult(r)
        refreshProfile()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
      onExit={() => navigate(`/app/learn/${chapterId}`)}
    />
  )
}
