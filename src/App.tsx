import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'

// Auth pages – načteny hned (malé, nutné pro cold start)
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'

// User pages – lazy loading
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const CellarPage = lazy(() => import('@/pages/CellarPage'))
const AddWinePage = lazy(() => import('@/pages/AddWinePage'))
const WineDetailPage = lazy(() => import('@/pages/WineDetailPage'))
const StatisticsPage = lazy(() => import('@/pages/StatisticsPage'))
const HistoryPage = lazy(() => import('@/pages/HistoryPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const MessagesPage = lazy(() => import('@/pages/MessagesPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

// Admin pages – lazy loading
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminUserCellarPage = lazy(() => import('@/pages/admin/AdminUserCellarPage'))
const AdminCatalogPage = lazy(() => import('@/pages/admin/AdminCatalogPage'))
const AdminReviewsPage = lazy(() => import('@/pages/admin/AdminReviewsPage'))
const AdminMessagesPage = lazy(() => import('@/pages/admin/AdminMessagesPage'))

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Veřejné stránky */}
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Chráněné stránky */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="cellar" element={<CellarPage />} />
              <Route path="cellar/add" element={<AddWinePage />} />
              <Route path="cellar/:id" element={<WineDetailPage />} />
              <Route path="statistics" element={<StatisticsPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="settings" element={<SettingsPage />} />

              {/* Admin stránky */}
              <Route path="admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
              <Route path="admin/users/:userId/cellar" element={<AdminRoute><AdminUserCellarPage /></AdminRoute>} />
              <Route path="admin/catalog" element={<AdminRoute><AdminCatalogPage /></AdminRoute>} />
              <Route path="admin/reviews" element={<AdminRoute><AdminReviewsPage /></AdminRoute>} />
              <Route path="admin/messages" element={<AdminRoute><AdminMessagesPage /></AdminRoute>} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  )
}
