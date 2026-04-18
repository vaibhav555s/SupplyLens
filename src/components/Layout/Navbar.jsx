import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

const NAV_ITEMS = [
  { label: 'Search', path: '/' },
  { label: 'Graph', path: '/graph' },
  { label: 'Map', path: '/graph?view=map' },
  { label: 'Dashboard', path: '/dashboard' },
]

const Navbar = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    if (path.startsWith('/graph')) return location.pathname === '/graph'
    return location.pathname.startsWith(path)
  }

  return (
    <motion.nav
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'rgba(13, 13, 20, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(139, 92, 246, 0.18)',
        borderRadius: '999px',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {/* Logo */}
      <button
        onClick={() => navigate('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          marginRight: '8px',
        }}
      >
        <div style={{
          width: '28px',
          height: '28px',
          background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
        }}>
          ◈
        </div>
        <span style={{
          fontFamily: 'Sora, sans-serif',
          fontWeight: 700,
          fontSize: '14px',
          color: '#f8fafc',
          letterSpacing: '-0.02em',
        }}>
          X-Ray
        </span>
      </button>

      {/* Divider */}
      <div style={{
        width: '1px',
        height: '20px',
        background: 'rgba(139, 92, 246, 0.2)',
        marginRight: '8px',
      }} />

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path)
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            style={{
              position: 'relative',
              background: active ? 'rgba(124, 58, 237, 0.15)' : 'none',
              border: active ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
              borderRadius: '999px',
              cursor: 'pointer',
              padding: '6px 14px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: active ? 600 : 400,
              color: active ? '#f8fafc' : '#94a3b8',
              letterSpacing: '0.01em',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = '#f8fafc'
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = '#94a3b8'
            }}
          >
            {item.label}
            {active && (
              <motion.div
                layoutId="nav-indicator"
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: '#a855f7',
                }}
              />
            )}
          </button>
        )
      })}
    </motion.nav>
  )
}

export default Navbar
