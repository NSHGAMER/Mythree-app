import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ForbiddenPage } from '../pages/public/StatusPages'
import { PageFallback } from './Layouts'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageFallback />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

/** UI-level guard. Real enforcement is in the database (RLS + assert_admin()). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  if (loading || (user && !profile)) return <PageFallback />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (profile?.role !== 'admin') return <ForbiddenPage />
  return <>{children}</>
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <PageFallback />
  if (user) return <Navigate to={isAdmin ? '/admin' : '/app'} replace />
  return <>{children}</>
}
