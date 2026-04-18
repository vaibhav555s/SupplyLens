import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check } from 'lucide-react'
import { mockCompany } from '../data/mockData'
import HSNTag from '../components/UI/HSNTag'
import RiskBadge from '../components/UI/RiskBadge'
import ShimmerButton from '../components/UI/ShimmerButton'

const HSNCard = ({ hsn, selected, onToggle, delay, maxRecords }) => {
  const pct = (hsn.records / maxRecords) * 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      onClick={onToggle}
      style={{
        background: selected ? 'rgba(124,58,237,0.08)' : '#111118',
        border: `1px solid ${selected ? '#7c3aed' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '16px',
        padding: '20px',
        cursor: 'pointer',
        position: 'relative',
        transform: delay % 0.12 === 0 ? 'rotate(-0.4deg)' : 'rotate(0.4deg)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.2s ease',
        boxShadow: selected ? '0 0 24px rgba(124,58,237,0.2)' : 'none',
      }}
      whileHover={{
        y: -3,
        boxShadow: selected
          ? '0 8px 32px rgba(124,58,237,0.25)'
          : '0 4px 20px rgba(124,58,237,0.12)',
        borderColor: selected ? '#7c3aed' : 'rgba(139,92,246,0.4)',
        transition: { duration: 0.2 }
      }}
    >
      {/* Selected checkmark */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: '#7c3aed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={12} color="#fff" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '24px' }}>{hsn.icon}</span>
        {!selected && <RiskBadge type={hsn.verified ? 'VERIFIED' : 'INFERRED'} size="xs" />}
      </div>

      {/* HSN Code */}
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '28px',
        fontWeight: 500,
        color: '#a855f7',
        marginBottom: '6px',
        letterSpacing: '-0.01em',
      }}>
        {hsn.code}
      </div>

      {/* Description */}
      <div style={{
        fontSize: '14px',
        color: '#f8fafc',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        lineHeight: 1.4,
        marginBottom: '16px',
        minHeight: '40px',
      }}>
        {hsn.description}
      </div>

      {/* Volume bar */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{
          width: '100%',
          height: '4px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '2px',
          overflow: 'hidden',
          marginBottom: '6px',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: delay + 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
              borderRadius: '2px',
            }}
          />
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
          {hsn.records.toLocaleString()} records
        </div>
      </div>

      {/* Countries */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {hsn.flags?.map((flag, i) => (
          <span
            key={i}
            style={{
              fontSize: '14px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '6px',
              padding: '2px 6px',
            }}
          >
            {flag}
          </span>
        ))}
      </div>

      {/* Hover CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        style={{
          position: 'absolute',
          bottom: '14px',
          right: '14px',
          fontSize: '11px',
          color: '#a855f7',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          display: selected ? 'none' : 'block',
        }}
      >
        Select to Trace →
      </motion.div>
    </motion.div>
  )
}

const HSNSelectionPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // LIVE DATA coming from the backend entity resolver!
  const companyName = location.state?.company || 'Tesla Inc.'
  const realEntity = location.state?.entity || null

  const [selected, setSelected] = useState(new Set())
  const [hsnCards, setHsnCards] = useState(mockCompany.hsnCodes)
  const [isLoadingHsn, setIsLoadingHsn] = useState(false)

  useEffect(() => {
    if (realEntity) {
      setIsLoadingHsn(true)
      const fetchLiveHsn = async () => {
        try {
          const api = (await import('../services/api')).default;
          const data = await api.inferHSNCodes(realEntity.name);
          if (data.hsnCodes && data.hsnCodes.length > 0) {
            setHsnCards(data.hsnCodes);
          }
        } catch (err) {
          console.error("Failed to load real-time HSN codes", err);
        } finally {
          setIsLoadingHsn(false);
        }
      }
      fetchLiveHsn();
    }
  }, [realEntity]);

  const toggle = (code) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const maxRecords = hsnCards.length > 0 ? Math.max(...hsnCards.map(h => h.records)) : 1000;

  const handleBeginTraversal = () => {
    const selectedCodes = Array.from(selected)
    navigate('/graph', {
      state: {
        company: companyName,
        entity: realEntity,
        hsnCodes: selectedCodes
      }
    })
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#08080f',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '80px 40px 24px',
        borderBottom: '1px solid rgba(139,92,246,0.1)',
        background: 'rgba(8,8,15,0.9)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            marginBottom: '16px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
          onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: '38px',
            fontWeight: 700,
            color: '#f8fafc',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            marginBottom: '8px',
          }}
        >
          {companyName}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          style={{
            color: '#64748b',
            fontSize: '15px',
            fontFamily: 'Inter, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          {realEntity && (
            <>
              <span style={{
                background: 'rgba(124,58,237,0.1)',
                color: '#a855f7',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(124,58,237,0.2)'
              }}>
                {realEntity.country}
              </span>
              <RiskBadge type={realEntity.confidence || 'INFERRED'} size="sm" />
              <span>•</span>
            </>
          )}
          {isLoadingHsn ? 'AI is analyzing entity import records...' : `${hsnCards.reduce((sum, h) => sum + h.records, 0).toLocaleString()} import records pending verification in ${hsnCards.length} HSN categories`}
        </motion.p>
      </div>

      {/* Card grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px 40px 100px',
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '16px',
        }}>
          {isLoadingHsn ? (
            <div style={{ padding: '40px', color: '#a855f7', fontFamily: 'Sora, sans-serif', textAlign: 'center' }}>
              <Check className="animate-spin" style={{ margin: '0 auto 12px' }} size={32} />
              Generating Dynamic Supply Chain HSN Profile...
            </div>
          ) : (
            hsnCards.map((hsn, i) => (
              <HSNCard
                key={hsn.code}
                hsn={hsn}
                selected={selected.has(hsn.code)}
                onToggle={() => toggle(hsn.code)}
                delay={i * 0.06}
                maxRecords={maxRecords}
              />
            ))
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(8,8,15,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(139,92,246,0.15)',
        padding: '16px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 50,
      }}>
        <div>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', fontFamily: 'Sora, sans-serif' }}>
            {selected.size > 0 ? `${selected.size} code${selected.size > 1 ? 's' : ''} selected` : 'Select HSN codes to trace'}
          </span>
          {selected.size > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              {Array.from(selected).map(code => (
                <HSNTag key={code} code={code} size="sm" />
              ))}
            </div>
          )}
        </div>
        <ShimmerButton
          onClick={handleBeginTraversal}
          disabled={selected.size === 0}
          style={{ padding: '14px 32px', fontSize: '15px' }}
        >
          Begin Traversal →
        </ShimmerButton>
      </div>
    </div>
  )
}

export default HSNSelectionPage
