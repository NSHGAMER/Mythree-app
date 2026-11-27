import { AnimatePresence } from 'motion/react'
import { lazy, useCallback, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { GuestOnly, RequireAdmin, RequireAuth } from './components/Guards'
import { AdminLayout, CenteredShell, MemberLayout, PublicLayout } from './components/Layouts'
import { PwaUpdater } from './components/Pwa'
import { SplashScreen } from './components/SplashScreen'
import { useApp } from './context/AppContext'
import { useAuth } from './context/AuthContext'
import { isSupabaseConfigured } from './lib/supabase'
import HomePage from './pages/public/Home'
import { ForbiddenPage, MaintenancePage, NotFoundPage, ServerErrorPage, SetupRequiredPage } from './pages/public/StatusPages'

// Public
const AboutPage = lazy(() => import('./pages/public/About'))
const ProgrammePage = lazy(() => import('./pages/public/Programme'))
const ContactPage = lazy(() => import('./pages/public/Contact'))
const GuruDakshinaPublic = lazy(() => import('./pages/public/GuruDakshinaInfo'))
const PrivacyPage = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.TermsPage })))
const CookiesPage = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.CookiesPage })))
const InstallPage = lazy(() => import('./pages/public/Install'))

// Auth
const LoginPage = lazy(() => import('./pages/auth/Login'))
const RegisterPage = lazy(() => import('./pages/auth/Register'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPassword'))
const AuthCallbackPage = lazy(() => import('./pages/auth/AuthCallback'))
const VerifyPhonePage = lazy(() => import('./pages/auth/VerifyPhone'))

// Member
const DashboardPage = lazy(() => import('./pages/member/Dashboard'))
const LearnPage = lazy(() => import('./pages/member/Learn'))
const ChapterPage = lazy(() => import('./pages/member/Chapter'))
const TestPage = lazy(() => import('./pages/member/Test'))
const ChallengesPage = lazy(() => import('./pages/member/Challenges'))
const ChallengePlayPage = lazy(() => import('./pages/member/ChallengePlay'))
const LeaderboardPage = lazy(() => import('./pages/member/Leaderboard'))
const AchievementsPage = lazy(() => import('./pages/member/Achievements'))
const HistoryPage = lazy(() => import('./pages/member/History'))
const ProfilePage = lazy(() => import('./pages/member/Profile'))
const SettingsPage = lazy(() => import('./pages/member/AccountSettings'))
const GuruDakshinaPage = lazy(() => import('./pages/member/GuruDakshina'))
const ReceiptPage = lazy(() => import('./pages/member/Receipt'))
const FinalExamPage = lazy(() => import('./pages/member/FinalExam'))
const RegistrationPage = lazy(() => import('./pages/member/Registration'))
const VideosPage = lazy(() => import('./pages/member/Videos'))
const VideoLessonPage = lazy(() => import('./pages/member/VideoLesson'))
const AdminVideos = lazy(() => import('./pages/admin/Videos'))
const AdminChallengeSets = lazy(() => import('./pages/admin/ChallengeSets'))
const AdminRegistrations = lazy(() => import('./pages/admin/Registrations'))

// Admin
const AdminOverview = lazy(() => import('./pages/admin/Overview'))
const AdminMembers = lazy(() => import('./pages/admin/Members'))
const AdminMemberDetail = lazy(() => import('./pages/admin/MemberDetail'))
const AdminExams = lazy(() => import('./pages/admin/Exams'))
const AdminChapters = lazy(() => import('./pages/admin/Chapters'))
const AdminChapterEditor = lazy(() => import('./pages/admin/ChapterEditor'))
const AdminContributions = lazy(() => import('./pages/admin/Contributions'))
const AdminFaqs = lazy(() => import('./pages/admin/Faqs'))
const AdminMessages = lazy(() => import('./pages/admin/Messages'))
const AdminNotifications = lazy(() => import('./pages/admin/Notifications'))
const AdminSettings = lazy(() => import('./pages/admin/Settings'))

function shouldShowSplash() {
  try {
    if (sessionStorage.getItem('mythree-splash')) return false
    sessionStorage.setItem('mythree-splash', '1')
  } catch {
    /* ignore */
  }
  return !/^\/(admin|auth\/callback)/.test(window.location.pathname)
}

export default function App() {
  const [splash, setSplash] = useState(shouldShowSplash)
  const done = useCallback(() => setSplash(false), [])
  const { settings } = useApp()
  const { isAdmin } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) return <SetupRequiredPage />

  const maintenance = settings?.maintenance_mode && !isAdmin && !/^\/(login|auth)/.test(location.pathname)

  return (
    <>
      <AnimatePresence>{splash && <SplashScreen onDone={done} />}</AnimatePresence>
      <PwaUpdater />
      {maintenance ? (
        <MaintenancePage message={settings?.maintenance_message ?? undefined} />
      ) : (
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="programme" element={<ProgrammePage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="guru-dakshina" element={<GuruDakshinaPublic />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="cookies" element={<CookiesPage />} />
            <Route path="install" element={<InstallPage />} />
            <Route path="error" element={<ServerErrorPage />} />
            <Route path="forbidden" element={<ForbiddenPage />} />
          </Route>

          <Route path="login" element={<GuestOnly><CenteredShell><LoginPage /></CenteredShell></GuestOnly>} />
          <Route path="register" element={<GuestOnly><CenteredShell><RegisterPage /></CenteredShell></GuestOnly>} />
          <Route path="forgot-password" element={<CenteredShell><ForgotPasswordPage /></CenteredShell>} />
          <Route path="reset-password" element={<CenteredShell><ResetPasswordPage /></CenteredShell>} />
          <Route path="auth/callback" element={<CenteredShell><AuthCallbackPage /></CenteredShell>} />
          <Route path="verify-phone" element={<RequireAuth><CenteredShell><VerifyPhonePage /></CenteredShell></RequireAuth>} />

          <Route path="app" element={<RequireAuth><MemberLayout /></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="learn" element={<LearnPage />} />
            <Route path="learn/:chapterId" element={<ChapterPage />} />
            <Route path="learn/:chapterId/test" element={<TestPage />} />
            <Route path="challenges" element={<ChallengesPage />} />
            <Route path="challenges/:kind" element={<ChallengePlayPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="achievements" element={<AchievementsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="guru-dakshina" element={<GuruDakshinaPage />} />
            <Route path="guru-dakshina/receipt/:id" element={<ReceiptPage />} />
            <Route path="final-exam" element={<FinalExamPage />} />
            <Route path="registration" element={<RegistrationPage />} />
            <Route path="videos" element={<VideosPage />} />
            <Route path="videos/:id" element={<VideoLessonPage />} />
          </Route>

          <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminOverview />} />
            <Route path="members" element={<AdminMembers />} />
            <Route path="registrations" element={<AdminRegistrations />} />
            <Route path="videos" element={<AdminVideos />} />
            <Route path="challenges" element={<AdminChallengeSets />} />
            <Route path="members/:id" element={<AdminMemberDetail />} />
            <Route path="exams" element={<AdminExams />} />
            <Route path="chapters" element={<AdminChapters />} />
            <Route path="chapters/:id" element={<AdminChapterEditor />} />
            <Route path="contributions" element={<AdminContributions />} />
            <Route path="faqs" element={<AdminFaqs />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      )}
    </>
  )
}
