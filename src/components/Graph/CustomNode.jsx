import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { motion } from 'framer-motion'

const TIER_COLORS = {
  0: { border: '#8b5cf6', bg: 'rgba(124, 58, 237, 0.18)', labelSize: '17px', width: 240, shadow: '0 0 24px rgba(124,58,237,0.35)' },
  1: { border: 'rgba(167, 139, 250, 0.65)', bg: 'rgba(139, 92, 246, 0.1)', labelSize: '15px', width: 200, shadow: '0 4px 20px rgba(0,0,0,0.5)' },
  2: { border: 'rgba(139, 92, 246, 0.45)', bg: 'rgba(30, 27, 50, 0.95)', labelSize: '14px', width: 188, shadow: '0 4px 16px rgba(0,0,0,0.4)' },
  3: { border: 'rgba(100, 116, 139, 0.55)', bg: 'rgba(20, 20, 35, 0.95)', labelSize: '13px', width: 178, shadow: '0 4px 12px rgba(0,0,0,0.3)' },
  4: { border: 'rgba(100, 116, 139, 0.45)', bg: 'rgba(18, 18, 30, 0.95)', labelSize: '12px', width: 170, shadow: '0 4px 10px rgba(0,0,0,0.3)' },
  5: { border: 'rgba(71, 85, 105, 0.45)', bg: 'rgba(15, 15, 25, 0.95)', labelSize: '12px', width: 162, shadow: '0 2px 8px rgba(0,0,0,0.3)' },
  6: { border: 'rgba(71, 85, 105, 0.4)', bg: 'rgba(12, 12, 22, 0.95)', labelSize: '11px', width: 155, shadow: '0 2px 8px rgba(0,0,0,0.25)' },
}

const getRiskStyle = (node) => {
  if (node.disrupted) {
    return {
      border: 'rgba(239, 68, 68, 0.95)',
      bg: 'rgba(239, 68, 68, 0.18)',
      pulse: 'node-pulse-danger',
      glowColor: 'rgba(239,68,68,0.4)',
    }
  }
  if (node.atRisk) {
    return {
      border: 'rgba(245, 158, 11, 0.8)',
      bg: 'rgba(245, 158, 11, 0.1)',
      pulse: 'node-pulse-warning',
      glowColor: 'rgba(245,158,11,0.3)',
    }
  }
  if (node.sanctions) {
    return {
      border: 'rgba(239, 68, 68, 0.7)',
      bg: 'rgba(239, 68, 68, 0.08)',
      pulse: 'node-pulse-danger',
      glowColor: 'rgba(239,68,68,0.25)',
    }
  }
  if (node.countryRisk && node.countryRisk < 60) {
    return {
      border: 'rgba(245, 158, 11, 0.6)',
      bg: 'rgba(245, 158, 11, 0.06)',
      pulse: '',
      glowColor: null,
    }
  }
  return null
}

const CustomNode = memo(({ data, selected }) => {
  const tier = data.tier ?? 1
  const tierConfig = TIER_COLORS[tier] || TIER_COLORS[3]
  const riskStyle = getRiskStyle(data)

  const borderColor = selected
    ? '#c084fc'
    : riskStyle?.border || tierConfig.border
  const bgColor = riskStyle?.bg || tierConfig.bg
  const pulseClass = riskStyle?.pulse || ''
  const nodeWidth = tierConfig.width
  const glowColor = selected ? 'rgba(192,132,252,0.45)' : riskStyle?.glowColor

  const isNew = data._isNew !== false // default to true for backward compat

  return (
    <motion.div
      initial={isNew ? { opacity: 0, scale: 0.65, y: -14 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={isNew ? {
        type: 'spring',
        stiffness: 260,
        damping: 20,
        mass: 0.9,
      } : { duration: 0.1 }}
      style={{ position: 'relative' }}
    >
      {/* Pulsing glow ring for risky/selected nodes */}
      {glowColor && (
        <motion.div
          animate={{ opacity: [0.35, 0.8, 0.35], scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '18px',
            background: glowColor,
            filter: 'blur(12px)',
            zIndex: -1,
          }}
        />
      )}

      <div
        className={pulseClass}
        style={{
          width: `${nodeWidth}px`,
          background: bgColor,
          border: `2px solid ${borderColor}`,
          borderRadius: '14px',
          padding: '14px 16px',
          fontFamily: 'Inter, sans-serif',
          cursor: 'pointer',
          boxShadow: selected
            ? `0 0 0 3px rgba(192,132,252,0.25), ${tierConfig.shadow}`
            : riskStyle
              ? `0 0 16px ${riskStyle.border}40, ${tierConfig.shadow}`
              : tierConfig.shadow,
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
        }}
      >
        {/* Handles */}
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: '#8b5cf6', border: '2px solid #c084fc', width: 10, height: 10, top: -6 }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: '#8b5cf6', border: '2px solid #c084fc', width: 10, height: 10, bottom: -6 }}
        />

        {/* Top row: flag + confidence badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{data.flag || '🌐'}</span>
            {data.country && (
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#94a3b8',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: '4px',
                padding: '1px 5px',
                letterSpacing: '0.04em',
              }}>
                {data.country}
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: data.confidence === 'VERIFIED' ? '#4ade80' : '#94a3b8',
              background: data.confidence === 'VERIFIED' ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.1)',
              border: `1px solid ${data.confidence === 'VERIFIED' ? 'rgba(74,222,128,0.35)' : 'rgba(148,163,184,0.25)'}`,
              borderRadius: '999px',
              padding: '2px 8px',
            }}
          >
            {data.confidence === 'VERIFIED' ? '✓ VERIFIED' : '~ INFERRED'}
          </span>
        </div>

        {/* Product Name */}
        {data.productName && (
          <div style={{
            fontSize: '11px',
            color: '#38bdf8',
            marginBottom: '4px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            {data.productName}
          </div>
        )}

        {/* Company name */}
        <div style={{
          fontSize: tierConfig.labelSize,
          fontWeight: 700,
          color: '#f1f5f9',
          lineHeight: 1.3,
          marginBottom: '4px',
          fontFamily: 'Sora, sans-serif',
          letterSpacing: '-0.01em',
        }}>
          {data.label}
        </div>

        {/* Full name */}
        {data.fullName && data.fullName !== data.label && (
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            marginBottom: '8px',
            lineHeight: 1.4,
          }}>
            {data.fullName}
          </div>
        )}

        {/* Sector */}
        {data.sector && (
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            marginBottom: '8px',
            fontStyle: 'italic',
          }}>
            {data.sector}
          </div>
        )}

        {/* HSN codes — normalize to array (API sends string, LLM sends array) */}
        {data.hsn && data.hsn.length > 0 && (() => {
          const hsnArray = Array.isArray(data.hsn)
            ? data.hsn
            : String(data.hsn).split(',').map(s => s.trim()).filter(Boolean);
          return hsnArray.length > 0 ? (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '5px',
              marginBottom: '10px',
            }}>
              {hsnArray.slice(0, 3).map(code => (
                <span
                  key={code}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#c084fc',
                    background: 'rgba(168,85,247,0.12)',
                    border: '1px solid rgba(168,85,247,0.3)',
                    borderRadius: '5px',
                    padding: '2px 7px',
                    letterSpacing: '0.04em',
                  }}
                >
                  {code}
                </span>
              ))}
            </div>
          ) : null;
        })()}

        {/* Risk score bar (if available) */}
        {data.risk_score !== undefined && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'Inter, sans-serif' }}>Risk</span>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
                color: data.risk_score >= 70 ? '#ef4444' : data.risk_score >= 40 ? '#f59e0b' : '#4ade80',
              }}>
                {data.risk_score}
              </span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${data.risk_score}%`,
                background: data.risk_score >= 70 ? '#ef4444' : data.risk_score >= 40 ? '#f59e0b' : '#4ade80',
                borderRadius: '2px',
              }} />
            </div>
          </div>
        )}

        {/* Bottom row: tier + shipment count or status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingTop: '10px',
          gap: '6px',
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#a855f7',
            background: 'rgba(168,85,247,0.15)',
            borderRadius: '5px',
            padding: '2px 8px',
            letterSpacing: '0.04em',
          }}>
            TIER {tier}
          </span>
          {data.shipments > 0 && (
            <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
              ◈ {data.shipments.toLocaleString()}
            </span>
          )}
          {data.disrupted && (
            <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700, letterSpacing: '0.03em' }}>
              ⚡ DISRUPTED
            </span>
          )}
          {data.atRisk && !data.disrupted && (
            <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700, letterSpacing: '0.03em' }}>
              ⚠ AT RISK
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
})

CustomNode.displayName = 'CustomNode'

export default CustomNode

