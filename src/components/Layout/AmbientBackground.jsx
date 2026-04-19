import React from 'react'

const AmbientBackground = () => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {/* Orb 1: top-right */}
      <div
        style={{
          position: 'absolute',
          top: '-100px',
          right: '-100px',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
          animation: 'orb-breathe 8s ease-in-out infinite alternate',
        }}
      />
      {/* Orb 2: bottom-left */}
      <div
        style={{
          position: 'absolute',
          bottom: '-100px',
          left: '-100px',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)',
          animation: 'orb-breathe 10s ease-in-out infinite alternate',
          animationDelay: '2s',
        }}
      />
    </div>
  )
}

export default AmbientBackground
