import { CalendarClock, CheckCircle2, Infinity as InfinityIcon, ScrollText, Target, Timer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonClass, Card } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useDocumentTitle } from '../../hooks/useAsync'
import { PageHero } from './About'

export default function ProgrammePage() {
  useDocumentTitle('Learning programme')
  const { settings } = useApp()
  const days = settings?.programme_days ?? 180
  const pass = settings?.default_pass_percentage ?? 70
  return (
    <>
      <PageHero eyebrow="Learning programme" title={`The ${days}-day Sanskrit journey`} sanskrit="शनैः शनैः – step by step">
        A structured programme built around your printed textbook, with the app as your practice partner.
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="grid gap-5 md:grid-cols-3">
          <Card className="p-6">
            <Target className="size-8 text-maroon" />
            <h3 className="mt-3 text-xl text-ink">Recommended: {days} days</h3>
            <p className="mt-2 text-sm text-ink-3">The pace we suggest for steady, joyful learning – about one chapter every two weeks.</p>
          </Card>
          <Card className="p-6">
            <Timer className="size-8 text-saffron" />
            <h3 className="mt-3 text-xl text-ink">Finish sooner</h3>
            <p className="mt-2 text-sm text-ink-3">Learning faster? Complete chapters as quickly as you master them.</p>
          </Card>
          <Card className="p-6">
            <InfinityIcon className="size-8 text-gold" />
            <h3 className="mt-3 text-xl text-ink">Or take longer</h3>
            <p className="mt-2 text-sm text-ink-3">There is no expiry. After day {days} everything stays open and your progress is kept.</p>
          </Card>
        </div>

        <h2 className="mt-16 text-3xl text-ink">How each chapter works</h2>
        <ol className="mt-6 space-y-4">
          {[
            ['Read the chapter in your textbook', 'Take your time with the printed book. Practise the examples aloud.'],
            ['Open the chapter in Mythree', 'See the learning objectives and the textbook reference for the chapter.'],
            ['Take the chapter test', `Questions are graded instantly with explanations. Score ${pass}% or more (or the chapter’s pass mark) to complete it.`],
            ['Unlock the next chapter', 'Completed chapters stay complete. Retake any test for practice – your best score counts.'],
          ].map(([t, d], i) => (
            <li key={t} className="card flex gap-4 p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-maroon text-lg font-bold text-on-primary">{i + 1}</span>
              <div>
                <p className="font-semibold text-ink">{t}</p>
                <p className="mt-1 text-sm text-ink-3">{d}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-16 grid gap-5 md:grid-cols-2">
          <Card className="p-6">
            <CalendarClock className="size-8 text-maroon" />
            <h3 className="mt-3 text-xl text-ink">Daily & weekly challenges</h3>
            <p className="mt-2 text-sm text-ink-3">
              Every day a {settings?.daily_question_count ?? 5}-question challenge draws from the chapters you have reached. Every week a{' '}
              {settings?.weekly_question_count ?? 10}-question challenge tests your retention. Both build your streak and XP.
            </p>
          </Card>
          <Card className="p-6">
            <ScrollText className="size-8 text-gold" />
            <h3 className="mt-3 text-xl text-ink">The final examination</h3>
            <p className="mt-2 text-sm text-ink-3">
              When every chapter is complete, your dashboard shows “Yes, I am ready to take the Final Exam”. Confirm it and the organisation
              posts a printed question paper to your registered address. There is no online final exam.
            </p>
          </Card>
        </div>

        <Card className="mt-16 p-8 text-center">
          <h3 className="text-2xl text-ink">What you will need</h3>
          <ul className="mx-auto mt-5 grid max-w-2xl gap-3 text-left text-sm text-ink-2 sm:grid-cols-2">
            {['A valid email address', 'A mobile number', 'Your full postal address (for the textbook and exam paper)', 'A phone, tablet or computer'].map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="size-5 shrink-0 text-success" /> {t}
              </li>
            ))}
          </ul>
          <Link to="/register" className={buttonClass('primary', 'lg', 'mt-8')}>
            Register free
          </Link>
        </Card>
      </div>
    </>
  )
}
