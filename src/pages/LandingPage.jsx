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

const FloatingTag = ({ children, top, left, bottom, right, delay }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 1, delay: 0.5 }}
    style={{
      position: 'absolute',
      top, left, bottom, right,
      zIndex: 5,
      background: 'rgba(8,8,20,0.75)',
      border: '1px solid rgba(124,58,237,0.25)',
      borderRadius: '10px',
      padding: '10px 14px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '11px',
      color: 'rgba(255,255,255,0.65)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      animation: 'float 6s ease-in-out infinite alternate',
      animationDelay: delay,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}
  >
    {children}
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
      const result = await api.resolveCompany(term)
      navigate('/hsn', {
        state: {
          company: result.entity?.name || term,
          entity: result.entity
        }
      })
    } catch (err) {
      console.error("API Error:", err)
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
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'auto',
      background: '#020617', 
      paddingBottom: '80px',
    }}>
      <AmbientBackground />

      {/* 1. THE GHOST TEXT (z-index 1) */}
      <div style={{
        position: 'absolute',
        top: '35%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '30vw',
        fontWeight: 900,
        color: 'rgba(255,255,255,0.055)',
        letterSpacing: '-0.05em',
        fontFamily: "'Sora', sans-serif",
        zIndex: 1,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        textAlign: 'center',
      }}>
        X·RAY
      </div>

      {/* 2. HEADLINE TEXT BLOCK (z-index 2) - Centered with chain */}
      <div style={{
        position: 'absolute',
        top: '35%', /* Adjusted to match ghost text/chain center */
        left: '50%',
        transform: 'translate(-50%, -65%)',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '1200px',
        padding: '0 20px',
        pointerEvents: 'none',
      }}>
        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.1}
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 'clamp(72px, 9vw, 110px)',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.025em',
            textAlign: 'center',
            margin: '0',
            lineHeight: 1.1,
          }}
        >
          See beyond your suppliers
        </motion.h1>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.2}
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 'clamp(66px, 8vw, 100px)',
            fontWeight: 700,
            fontStyle: 'italic',
            textAlign: 'center',
            marginTop: '4px',
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Intelligence
        </motion.div>
      </div>

      {/* 3. THE CHAIN (z-index 3) */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        style={{
          position: 'relative',
          top: '80px',
          width: '100%',
          height: '60vh', 
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'scale(2.34)', 
          maskImage: 'radial-gradient(circle, black 65%, transparent 95%)',
          WebkitMaskImage: 'radial-gradient(circle, black 65%, transparent 95%)',
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

      {/* 5. THE FLOATING TAGS (z-index 5) */}
      <FloatingTag top="100px" left="32px" delay="0s">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#22c55e' }}>●</span>
          <span style={{ fontWeight: 700, color: '#fff' }}>TSMC · T1 · VERIFIED</span>
        </div>
        <div style={{ opacity: 0.8, fontSize: '10px', marginTop: '4px' }}>8542 · Integrated Circuits</div>
      </FloatingTag>

      <FloatingTag top="100px" right="32px" delay="1s">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ 
            color: '#ef4444', 
            animation: 'pulse-dot 1.5s infinite' 
          }}>●</span>
          <span style={{ fontWeight: 700, color: '#fff' }}>Ganfeng · SANCTIONED</span>
        </div>
        <div style={{ opacity: 0.8, fontSize: '10px', marginTop: '4px' }}>OFAC SDN · March 2023</div>
      </FloatingTag>

      <FloatingTag bottom="280px" left="32px" delay="2s">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#f59e0b' }}>●</span>
          <span style={{ fontWeight: 700, color: '#fff' }}>Taiwan · 71% CONCENTRATION</span>
        </div>
        <div style={{ opacity: 0.8, fontSize: '10px', marginTop: '4px' }}>HS 8507 · Risk: HIGH</div>
      </FloatingTag>

      <FloatingTag bottom="280px" right="32px" delay="1.5s">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#22c55e' }}>●</span>
          <span style={{ fontWeight: 700, color: '#fff' }}>6 Tiers · 23 Nodes resolved</span>
        </div>
        <div style={{ opacity: 0.8, fontSize: '10px', marginTop: '4px' }}>Tesla Inc · traced 2m ago</div>
      </FloatingTag>

      {/* 4. THE BOTTOM CONTENT (z-index 4) */}
      <div style={{
        marginTop: '24px',
        zIndex: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '1200px',
        padding: '0 20px',
      }}>
        
        {/* Badge */}
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
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.1em',
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: '14px' }}>✦</span>
          Supply Intelligence Platform
        </motion.div>

        {/* Subtext */}
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.3}
          style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.38)',
            fontSize: '14px',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 400,
            lineHeight: 1.7,
            maxWidth: '400px',
            margin: '0 0 24px 0',
          }}
        >
          Trace N-tier supply chains from open trade data. 
          Identify risks. Simulate disruptions.
        </motion.p>

        {/* Search bar */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.4}
          style={{ width: '100%', maxWidth: '540px' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '58px',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${focused ? '#7c3aed' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '50px',
              padding: '6px 6px 6px 20px',
              gap: '12px',
              boxShadow: focused ? '0 0 0 3px rgba(124,58,237,0.2)' : 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <Search size={18} color={focused ? '#a855f7' : '#64748b'} style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
              onClick={() => { if (!user) navigate('/auth') }}
              readOnly={!user}
              placeholder="Enter company name — e.g. Tesla, Apple, Samsung"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '15px',
                fontFamily: "'Inter', sans-serif",
                cursor: !user ? 'pointer' : 'text',
              }}
            />
            <button
              onClick={() => { if (!user) navigate('/auth'); else handleSearch(); }}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                border: 'none',
                borderRadius: '50px',
                color: '#fff',
                cursor: 'pointer',
                padding: '0 24px',
                height: '100%',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                whiteSpace: 'nowrap',
                transition: 'opacity 0.2s',
              }}
            >
              {!user ? 'Sign In' : isTracing ? 'Tracing...' : 'Trace Supply Chain →'}
            </button>
          </div>
        </motion.div>

        {/* Chips */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.5}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: '16px',
          }}
        >
          <span style={{ fontSize: '12px', color: '#475569', fontFamily: "'Inter', sans-serif" }}>Recent:</span>
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
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
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
            marginTop: '40px',
          }}
        >
          <StatPill icon="🌐" label="500K+ Trade Records" delay={0.62} />
          <StatPill icon="🏭" label="6-Tier Deep Traversal" delay={0.68} />
          <StatPill icon="⚡" label="Live Risk Intelligence" delay={0.74} />
        </motion.div>
      </div>
    </div>
  )
}

export default LandingPage
