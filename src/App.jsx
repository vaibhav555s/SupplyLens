import React from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AppShell from './components/Layout/AppShell'
import LandingPage from './pages/LandingPage'
import HSNSelectionPage from './pages/HSNSelectionPage'
import GraphPage from './pages/GraphPage'
import DashboardPage from './pages/DashboardPage'

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

const AppRoutes = () => {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<AnimatedPage><LandingPage /></AnimatedPage>} />
        <Route path="/hsn" element={<AnimatedPage><HSNSelectionPage /></AnimatedPage>} />
        <Route path="/graph" element={<AnimatedPage><GraphPage /></AnimatedPage>} />
        <Route path="/dashboard" element={<AnimatedPage><DashboardPage /></AnimatedPage>} />
      </Routes>
    </AnimatePresence>
  )
}

const App = () => {
  return (
    <BrowserRouter>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </BrowserRouter>
  )
}

export default App
