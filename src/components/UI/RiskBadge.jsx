import React from 'react'

const BADGE_CONFIGS = {
  VERIFIED: {
    bg: 'rgba(34, 197, 94, 0.1)',
    color: '#22c55e',
    border: 'rgba(34, 197, 94, 0.25)',
    label: '✓ VERIFIED',
  },
  INFERRED: {
    bg: 'rgba(100, 116, 139, 0.1)',
    color: '#64748b',
    border: 'rgba(100, 116, 139, 0.25)',
    label: '~ INFERRED',
  },
  HIGH: {
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    border: 'rgba(239, 68, 68, 0.3)',
    label: '⚠ HIGH',
  },
  MEDIUM: {
    bg: 'rgba(245, 158, 11, 0.1)',
    color: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.25)',
    label: '⚠ MEDIUM',
  },
  LOW: {
    bg: 'rgba(34, 197, 94, 0.08)',
    color: '#22c55e',
    border: 'rgba(34, 197, 94, 0.2)',
    label: '✓ LOW',
  },
  CLEAR: {
    bg: 'rgba(34, 197, 94, 0.08)',
    color: '#22c55e',
    border: 'rgba(34, 197, 94, 0.2)',
    label: '✓ CLEAR',
  },
  SANCTIONS: {
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    border: 'rgba(239, 68, 68, 0.3)',
    label: '🚫 SANCTIONED',
  },
}

const RiskBadge = ({ type = 'VERIFIED', size = 'sm', style = {} }) => {
  const config = BADGE_CONFIGS[type] || BADGE_CONFIGS.INFERRED
  const fontSize = size === 'xs' ? '10px' : size === 'sm' ? '11px' : '13px'
  const padding = size === 'xs' ? '2px 6px' : size === 'sm' ? '2px 8px' : '4px 12px'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        borderRadius: '999px',
        padding,
        fontSize,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {config.label}
    </span>
  )
}

export default RiskBadge
