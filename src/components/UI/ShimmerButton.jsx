import React, { useState } from 'react'
import { motion } from 'framer-motion'

const ShimmerButton = ({ children, onClick, style = {}, variant = 'primary', disabled = false }) => {
  const [hovered, setHovered] = useState(false)

  if (variant === 'outline') {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        disabled={disabled}
        style={{
          background: hovered ? 'rgba(124, 58, 237, 0.12)' : 'transparent',
          border: '1px solid rgba(124, 58, 237, 0.5)',
          borderRadius: '10px',
          color: '#a855f7',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '10px 20px',
          transition: 'all 0.2s ease',
          opacity: disabled ? 0.5 : 1,
          ...style,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
      </motion.button>
    )
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
        border: '1px solid rgba(139, 92, 246, 0.4)',
        borderRadius: '10px',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '12px 24px',
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        boxShadow: hovered ? '0 0 30px rgba(124, 58, 237, 0.4)' : '0 0 0 rgba(0,0,0,0)',
        transition: 'box-shadow 0.3s ease',
        ...style,
      }}
    >
      {/* Shimmer layer */}
      {hovered && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
      )}
      {children}
    </motion.button>
  )
}

export default ShimmerButton
