import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import AmbientBackground from '../components/Layout/AmbientBackground'
import { recentSearches } from '../data/mockData'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: [0.4, 0, 0.2, 1] }
  })
}

const StatPill = ({ icon, label, delay }) => (
  <motion.div
    variants={fadeUp}
    initial="hidden"
    animate="visible"
    custom={delay}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '999px',
      padding: '8px 16px',
      fontSize: '13px',
      color: '#94a3b8',
      fontFamily: 'Inter, sans-serif',
      whiteSpace: 'nowrap',
    }}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </motion.div>
)

import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const LandingPage = () => {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [isTracing, setIsTracing] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSearch = async (q = query) => {
    const term = q.trim()
    if (!term) return

    setIsTracing(true)
    try {
      // 1. Hit the backend API to resolve the entity
      const result = await api.resolveCompany(term)

      // 2. Pass the LIVE data to the next page
      navigate('/hsn', {
        state: {
          company: result.entity?.name || term,
          entity: result.entity
        }
      })
    } catch (err) {
      console.error("API Error:", err)
      // Fallback if API fails
      navigate('/hsn', { state: { company: term } })
    } finally {
      setIsTracing(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      height: '100vh', // Force one screen
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden', // No scroll on desktop
      background: '#020617', 
    }}>
      <AmbientBackground />

      {/* Immersive 3D Background Overlap */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2.5, ease: "easeOut" }}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          opacity: 0.7,
        }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'scale(2.2)', // Huge scale for full-width impact
          filter: 'contrast(1.2) brightness(1.1)',
          maskImage: 'radial-gradient(circle, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle, black 40%, transparent 80%)',
        }}>
          <iframe 
            src="https://my.spline.design/blockchain-iGofSppMfDjRUEBbyrBEhju5/" 
            frameBorder="0" 
            width="100%" 
            height="100%"
            loading="lazy"
            title="Centered Blockchain Model"
          />
        </div>
      </motion.div>


      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px', // Tightened gap
        maxWidth: '1200px',
        width: '100%',
        padding: '40px 20px',
      }}>
        {/* Eyebrow */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(139,92,246,0.1)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: '999px',
            padding: '6px 16px',
            fontSize: '12px',
            color: '#a855f7',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.1em',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          <span style={{ fontSize: '14px' }}>◈</span>
          Supply Intelligence Platform
        </motion.div>

        {/* Hero heading */}
        <div style={{ textAlign: 'center', lineHeight: 1.0, zIndex: 11 }}>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.1}
            style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: 'clamp(42px, 5.5vw, 68px)', // Scaled down
              fontWeight: 800,
              color: '#f8fafc',
              letterSpacing: '-0.04em',
              lineHeight: 0.9,
            }}
          >
            See Beyond
          </motion.div>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.2}
            style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: 'clamp(42px, 5.5vw, 68px)', // Scaled down
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.0,
              marginTop: '4px',
            }}
          >
            <span style={{ color: '#f8fafc' }}>Your </span>
            <span style={{ color: '#f8fafc' }}>Suppliers</span>
          </motion.div>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.35}
            style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: 'clamp(32px, 4.5vw, 56px)', // Scaled down
              fontWeight: 300,
              fontStyle: 'italic',
              color: '#a855f7',
              letterSpacing: '-0.02em',
              marginTop: '2px',
              textShadow: '0 0 40px rgba(168,85,247,0.3)',
            }}
          >
            Intelligence
          </motion.div>
        </div>

        {/* Subheading */}
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.4}
          style={{
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            lineHeight: 1.6,
            maxWidth: '480px',
            margin: '0 auto',
            opacity: 0.9,
          }}
        >
          Trace N-tier supply chains from open trade data.
          Identify risks. Simulate disruptions. Act before they escalate.
        </motion.p>

        {/* Search bar */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.5}
          style={{ width: '100%', maxWidth: '580px' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '60px',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${focused ? 'rgba(139,92,246,0.6)' : 'rgba(139,92,246,0.25)'}`,
              borderRadius: '999px',
              padding: '6px 6px 6px 20px',
              gap: '12px',
              boxShadow: focused ? '0 0 30px rgba(124,58,237,0.18)' : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            <Search size={18} color={focused ? '#a855f7' : '#64748b'} style={{ flexShrink: 0, transition: 'color 0.2s' }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
              onClick={() => { if (!user) navigate('/auth') }}
              readOnly={!user}
              placeholder={user ? "Enter company name — e.g. Tesla, Apple, Samsung..." : "Sign in to trace supply chains"}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: '15px',
                fontFamily: 'Inter, sans-serif',
                cursor: !user ? 'pointer' : 'text',
                '::placeholder': { color: '#475569' },
              }}
            />
            <button
              onClick={() => { if (!user) navigate('/auth'); else handleSearch(); }}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                border: 'none',
                borderRadius: '999px',
                color: '#fff',
                cursor: 'pointer',
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {!user ? 'Sign In to Search' : isTracing ? 'Resolving Entity...' : 'Trace Supply Chain →'}
            </button>
          </div>
        </motion.div>

        {/* Stat pills */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.6}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
          }}
        >
          <StatPill icon="🌐" label="500K+ Trade Records" delay={0.62} />
          <StatPill icon="🏭" label="6-Tier Deep Traversal" delay={0.68} />
          <StatPill icon="⚡" label="Live Risk Intelligence" delay={0.74} />
        </motion.div>

        {/* Recent searches */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.8}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '12px', color: '#475569', fontFamily: 'Inter, sans-serif' }}>Recent:</span>
          {recentSearches.map(name => (
            <button
              key={name}
              onClick={() => { if (!user) navigate('/auth'); else handleSearch(name); }}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '999px',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px 14px',
                fontSize: '12px',
                fontFamily: 'Inter, sans-serif',
                transition: 'color 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#a855f7'
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#64748b'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
              }}
            >
              {name}
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

export default LandingPage
