import { BookHeart, HeartHandshake, Home, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { OrnamentDivider } from '../../components/Brand'
import { buttonClass, Card } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useAsync'

export function PageHero({ eyebrow, title, sanskrit, children }: { eyebrow: string; title: string; sanskrit?: string; children?: React.ReactNode }) {
  return (
    <section className="paisley-bg border-b border-line">
      <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-ink">{eyebrow}</p>
        <h1 className="mt-3 text-4xl text-ink sm:text-5xl">{title}</h1>
        {sanskrit && <p lang="sa" className="sanskrit mt-3 text-xl text-maroon-ink">{sanskrit}</p>}
        <OrnamentDivider className="mt-6" />
        {children && <div className="mx-auto mt-6 max-w-2xl text-lg text-ink-2">{children}</div>}
      </div>
    </section>
  )
}

export default function AboutPage() {
  useDocumentTitle('About us')
  return (
    <>
      <PageHero eyebrow="About us" title="A home for Sanskrit" sanskrit="स्वाध्यायप्रवचनाभ्यां न प्रमदितव्यम्">
        Mythree – <span lang="sa" className="sanskrit">संस्कृतगृहम्</span> is the learning programme of Maitrī Samskṛta-Samskṛti Pratiṣṭhāna, Bengaluru.
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5 text-[1.05rem] leading-relaxed text-ink-2">
            <p>
              Sanskrit is not only the language of our scriptures and sciences – it is a living thread that connects families across
              generations. The idea behind <strong>Namma Mane – Samskṛtagṛham</strong> (“our home, a home of Sanskrit”) is simple: when a family
              learns together, the language comes alive at home.
            </p>
            <p>
              The Pratiṣṭhāna prepares a structured printed textbook and posts it to every registered member. Mythree is the companion app:
              it helps you check your understanding after each chapter, practise a little every day, and see how far you have come.
            </p>
            <p>
              Our emblem shows the sacred lamp of knowledge over an open book, encircled by the sun’s rays and the words of the Taittirīya
              Upaniṣad – <span lang="sa" className="sanskrit text-maroon-ink">स्वाध्यायप्रवचनाभ्यां न प्रमदितव्यम्</span> – a reminder never to neglect
              learning and sharing what we learn.
            </p>
          </div>
          <Card className="h-fit overflow-hidden">
            <img src="/images/promo-480.webp" alt="Namma Mane Samskritagriham artwork" width={480} height={508} className="h-auto w-full" loading="lazy" />
            <p className="p-4 text-center text-sm text-ink-2" lang="kn" style={{ fontFamily: 'var(--font-kannada)' }}>
              ಮೈತ್ರೀ ಸಂಸ್ಕೃತ-ಸಂಸ್ಕೃತಿ ಪ್ರತಿಷ್ಠಾನ(ರಿ), ಬೆಂಗಳೂರು
            </p>
          </Card>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Home, t: 'Learning at home', d: 'Textbooks delivered to your doorstep.' },
            { icon: Users, t: 'For every age', d: 'Children, parents and grandparents together.' },
            { icon: BookHeart, t: 'Structured path', d: 'Chapter by chapter, with clear goals.' },
            { icon: HeartHandshake, t: 'Free to learn', d: 'Guru Dakshina is always voluntary.' },
          ].map(({ icon: Icon, t, d }) => (
            <Card key={t} className="p-5">
              <Icon className="size-7 text-maroon" />
              <p className="mt-3 font-display text-lg text-ink">{t}</p>
              <p className="mt-1 text-sm text-ink-3">{d}</p>
            </Card>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Link to="/register" className={buttonClass('primary', 'lg')}>
            Join the programme
          </Link>
        </div>
      </div>
    </>
  )
}
