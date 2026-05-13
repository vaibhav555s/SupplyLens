import React from 'react'
import { motion } from 'framer-motion'

const GlassCard = ({
  children,
  className = '',
  style = {},
  onClick,
  hover = true,
  selected = false,
  delay = 0
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : {}}
      onClick={onClick}
      style={{
        background: selected ? 'rgba(124, 58, 237, 0.08)' : '#111118',
        border: selected
          ? '1px solid #7c3aed'
          : '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
        ...style,
      }}
      className={className}
      onMouseEnter={(e) => {
        if (hover && !selected) {
          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)'
          e.currentTarget.style.boxShadow = '0 0 20px rgba(124, 58, 237, 0.12)'
        }
      }}
      onMouseLeave={(e) => {
        if (hover && !selected) {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      {children}
    </motion.div>
  )
}

export default GlassCard
