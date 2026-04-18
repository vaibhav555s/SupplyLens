import React from 'react'

const HSNTag = ({ code, size = 'md', style = {} }) => {
  const fontSize = size === 'sm' ? '11px' : size === 'md' ? '13px' : size === 'lg' ? '18px' : '28px'
  const padding = size === 'sm' ? '2px 8px' : size === 'md' ? '4px 10px' : '6px 14px'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize,
        fontWeight: 500,
        color: '#a855f7',
        background: 'rgba(168, 85, 247, 0.08)',
        border: '1px solid rgba(168, 85, 247, 0.2)',
        borderRadius: '6px',
        padding,
        letterSpacing: '0.02em',
        ...style,
      }}
    >
      {code}
    </span>
  )
}

export default HSNTag
