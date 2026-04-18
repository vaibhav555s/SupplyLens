import React from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AppShell from './components/Layout/AppShell'
import LandingPage from './pages/LandingPage'
import HSNSelectionPage from './pages/HSNSelectionPage'
import GraphPage from './pages/GraphPage'
import DashboardPage from './pages/DashboardPage'
import AuthPage from './pages/AuthPage'
import { AuthProvider, useAuth } from './context/AuthContext'

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
}

const AnimatedPage = ({ children }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    style={{ height: '100%', width: '100%' }}
  >
    {children}
  </motion.div>
)

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/auth" replace />
  return children
}

const AppRoutes = () => {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<AnimatedPage><LandingPage /></AnimatedPage>} />
        <Route path="/hsn" element={<AnimatedPage><HSNSelectionPage /></AnimatedPage>} />
        <Route path="/graph" element={<AnimatedPage><GraphPage /></AnimatedPage>} />
        <Route path="/auth" element={<AnimatedPage><AuthPage /></AnimatedPage>} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <AnimatedPage><DashboardPage /></AnimatedPage>
          </ProtectedRoute>
        } />
      </Routes>
    </AnimatePresence>
  )
}

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
