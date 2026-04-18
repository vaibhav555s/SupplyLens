import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STAGES = [
  { id: 0, text: 'Authenticating data connectors...', delay: 0 },
  { id: 1, text: 'Resolving root entity from Wikidata...', delay: 600 },
  { id: 2, text: 'Geocoding headquarters coordinates...', delay: 1200 },
  { id: 3, text: 'Querying UN Comtrade trade flows...', delay: 1900 },
  { id: 4, text: 'Inferring Tier 1 direct suppliers via LLM...', delay: 2700 },
  { id: 5, text: 'Mapping Tier 2–4 sub-suppliers globally...', delay: 3600 },
  { id: 6, text: 'Running risk enrichment (OFAC · UFLPA)...', delay: 4600 },
  { id: 7, text: 'Calculating concentration risk scores...', delay: 5400 },
  { id: 8, text: 'Assembling supply chain graph...', delay: 6000 },
]

const TerminalLoader = ({ companyName }) => {
  const [visibleStages, setVisibleStages] = useState([])
  const [cursorVisible, setCursorVisible] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const timers = STAGES.map(stage =>
      setTimeout(() => {
        setVisibleStages(prev => [...prev, stage.id])
        setProgress(Math.round(((stage.id + 1) / STAGES.length) * 100))
      }, stage.delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => setCursorVisible(v => !v), 530)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#08080f',
      fontFamily: 'JetBrains Mono, monospace',
      padding: '40px',
    }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: '48px' }}
      >
        <div style={{
          fontSize: '12px',
          color: '#a855f7',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: '12px',
          fontWeight: 700,
        }}>
          Supply Chain X-Ray · Intelligence Engine
        </div>

        {/* Scanning orb */}
        <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 16px' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
            style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: '#7c3aed',
              borderRightColor: '#a855f7',
            }}
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 3.5, ease: 'linear' }}
            style={{
              position: 'absolute', inset: '10px',
              borderRadius: '50%',
              border: '1px solid transparent',
              borderBottomColor: 'rgba(168,85,247,0.5)',
              borderLeftColor: 'rgba(124,58,237,0.4)',
            }}
          />
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            style={{
              position: 'absolute', inset: '22px',
              borderRadius: '50%',
              background: 'rgba(124,58,237,0.3)',
            }}
          />
        </div>

        <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', fontFamily: 'Sora, sans-serif' }}>
          Mapping <span style={{ color: '#a855f7' }}>{companyName}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
          Building real-time N-tier supply chain graph
        </div>
      </motion.div>

      {/* Terminal window */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'rgba(10,10,18,0.9)',
          border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(124,58,237,0.12)',
        }}
      >
        {/* Window chrome */}
        <div style={{
          background: 'rgba(139,92,246,0.08)',
          borderBottom: '1px solid rgba(139,92,246,0.15)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {['#ef4444', '#f59e0b', '#22c55e'].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
          ))}
          <span style={{ fontSize: '11px', color: '#475569', marginLeft: '8px', letterSpacing: '0.05em' }}>
            xray-engine — bash
          </span>
        </div>

        {/* Terminal lines */}
        <div style={{ padding: '16px 20px', minHeight: '220px', maxHeight: '280px', overflowY: 'auto' }}>
          {STAGES.map(stage => (
            <AnimatePresence key={stage.id}>
              {visibleStages.includes(stage.id) && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ color: '#22c55e', fontSize: '11px', flexShrink: 0 }}>$</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>{stage.text}</span>
                  {visibleStages[visibleStages.length - 1] === stage.id && (
                    <motion.span
                      animate={{ opacity: cursorVisible ? 1 : 0 }}
                      style={{ color: '#a855f7', fontSize: '11px', flexShrink: 0 }}
                    >
                      ▋
                    </motion.span>
                  )}
                  {visibleStages[visibleStages.length - 1] !== stage.id && (
                    <span style={{ color: '#22c55e', fontSize: '10px', flexShrink: 0 }}>✓</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(139,92,246,0.1)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', color: '#475569' }}>Graph construction progress</span>
            <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: 700 }}>{progress}%</span>
          </div>
          <div style={{
            height: '4px',
            background: 'rgba(139,92,246,0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                borderRadius: '2px',
                boxShadow: '0 0 8px rgba(168,85,247,0.5)',
              }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default TerminalLoader
