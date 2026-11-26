import { useState, type ReactNode } from 'react'
import { Button, Card, Toggle } from '../../components/ui'
import { readCookiePrefs, saveCookiePrefs } from '../../components/CookieBanner'
import { useApp } from '../../context/AppContext'
import { useDocumentTitle } from '../../hooks/useAsync'
import { PageHero } from './About'

const UPDATED = '26 November 2026'

function LegalBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="mb-8 text-sm text-ink-3">Last updated: {UPDATED}</p>
      <div className="space-y-6 leading-relaxed text-ink-2 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
    </div>
  )
}

export function PrivacyPage() {
  useDocumentTitle('Privacy Policy')
  const { settings } = useApp()
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy" />
      <LegalBody>
        <p>
          This policy explains how Mythree – संस्कृतगृहम्, operated by Maitrī Samskṛta-Samskṛti Pratiṣṭhāna (R), Bengaluru (“we”), collects and
          uses your personal data. We follow the Digital Personal Data Protection Act, 2023 (India).
        </p>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: full name, email address, mobile number, age and password (stored only as a secure hash by our authentication provider).</li>
          <li>Postal address: used to post your textbook and final examination paper.</li>
          <li>Learning data: chapter progress, test answers and scores, challenges, XP, streaks and badges.</li>
          <li>Guru Dakshina: amount, status and payment reference. Card, UPI and bank details are handled by Razorpay and never reach our servers.</li>
          <li>Support: messages you send us and questions you ask the help assistant.</li>
        </ul>
        <h2>How we use it</h2>
        <ul>
          <li>To provide the learning programme, track your progress and award rewards.</li>
          <li>To post textbooks and examination papers to your address.</li>
          <li>To verify your email and mobile number and keep your account secure.</li>
          <li>To issue receipts for voluntary contributions.</li>
          <li>To improve the programme using aggregated, non-identifying statistics.</li>
        </ul>
        <h2>Who can see it</h2>
        <p>
          Only you and authorised administrators of the organisation can see your personal details. On leaderboards only your first name and
          initial are shown, and you can hide yourself in Account Settings. We never sell your data or use it for advertising.
        </p>
        <h2>Service providers</h2>
        <p>
          We use Supabase (database and authentication, hosted in India – Mumbai region), Vercel (website hosting), Razorpay (payments) and an
          SMS provider for one-time passwords. They process data only on our instructions.
        </p>
        <h2>Security & retention</h2>
        <p>
          Data is encrypted in transit, protected by row-level access rules, and access is logged. We keep your data while your account is
          active. You may delete your account at any time from Account Settings; learning records are then removed, except payment records we
          must keep by law.
        </p>
        <h2>Your rights</h2>
        <p>
          You can access, correct or erase your data and withdraw consent. Contact us{settings?.contact_email ? ` at ${settings.contact_email}` : ''} for any
          privacy request or grievance.
        </p>
      </LegalBody>
    </>
  )
}

export function TermsPage() {
  useDocumentTitle('Terms of Service')
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of Service" />
      <LegalBody>
        <p>By registering for Mythree you agree to these terms.</p>
        <h2>The programme</h2>
        <ul>
          <li>Mythree is a free learning companion to the printed textbook provided by the organisation.</li>
          <li>The {`180-day`} duration is a recommendation only. Your access is not withdrawn when it passes.</li>
          <li>The final examination is conducted on paper and posted to your registered address. Results and certificates are issued by the organisation.</li>
        </ul>
        <h2>Your account</h2>
        <ul>
          <li>Provide accurate information, including a correct postal address.</li>
          <li>Keep your password secret. One account per person.</li>
          <li>Do not attempt to manipulate scores, XP or leaderboards, or to access other members’ data. We may suspend accounts that do.</li>
        </ul>
        <h2>Guru Dakshina</h2>
        <ul>
          <li>Contributions are entirely voluntary and do not purchase any service or advantage.</li>
          <li>A contribution is treated as received only after the payment gateway confirms it.</li>
          <li>If you were charged in error, contact us with the receipt or payment reference and we will investigate.</li>
        </ul>
        <h2>Content</h2>
        <p>Course material, questions and design belong to the organisation and may not be copied for commercial use.</p>
        <h2>Availability</h2>
        <p>We aim for high availability but may pause the service briefly for maintenance. Your progress is preserved.</p>
        <h2>Changes</h2>
        <p>We may update these terms and will show the date of the latest version on this page.</p>
      </LegalBody>
    </>
  )
}

export function CookiesPage() {
  useDocumentTitle('Cookie Preferences')
  const { toast } = useApp()
  const current = readCookiePrefs()
  const [preferences, setPreferences] = useState(current?.preferences ?? true)
  return (
    <>
      <PageHero eyebrow="Legal" title="Cookie Preferences" />
      <div className="mx-auto max-w-3xl px-4 py-14">
        <p className="text-ink-2">
          Mythree does not use advertising or third-party tracking cookies. We use your browser’s storage only for the purposes below.
        </p>
        <Card className="mt-8 divide-y divide-line">
          <div className="p-5">
            <Toggle checked onChange={() => {}} disabled label="Strictly necessary" description="Keeps you signed in securely and remembers this consent choice. Always on." />
          </div>
          <div className="p-5">
            <Toggle checked={preferences} onChange={setPreferences} label="Preferences" description="Remembers your light/dark theme and dismissed tips." />
          </div>
          <div className="p-5">
            <Toggle checked={false} onChange={() => {}} disabled label="Analytics" description="Not used. We do not run analytics trackers." />
          </div>
        </Card>
        <Button
          className="mt-6"
          onClick={() => {
            saveCookiePrefs({ preferences, analytics: false })
            toast('Cookie preferences saved')
          }}
        >
          Save preferences
        </Button>
      </div>
    </>
  )
}
