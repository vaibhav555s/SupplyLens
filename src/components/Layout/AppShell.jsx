import React from 'react'
import { motion } from 'framer-motion'
import AmbientBackground from './AmbientBackground'
import Navbar from './Navbar'

const AppShell = ({ children }) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#04040a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Global ambient background behind the shell */}
      <AmbientBackground />

      {/* Main app container — the floating rounded rectangle */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        style={{
          width: '100%',
          maxWidth: '1440px',
          height: 'calc(100vh - 32px)',
          background: '#08080f',
          borderRadius: '20px',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 80px rgba(124, 58, 237, 0.08), 0 32px 64px rgba(0,0,0,0.6)',
        }}
      >
        <Navbar />
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {children}
        </main>
      </motion.div>
    </div>
  )
}

export default AppShell
