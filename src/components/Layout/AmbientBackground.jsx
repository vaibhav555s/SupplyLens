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
      {/* Top-right orb */}
      <div
        style={{
          position: 'absolute',
          top: '-200px',
          right: '-200px',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0.05) 50%, transparent 70%)',
          animation: 'orb-breathe 4s ease-in-out infinite alternate',
        }}
      />
      {/* Bottom-left orb */}
      <div
        style={{
          position: 'absolute',
          bottom: '-200px',
          left: '-200px',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.04) 50%, transparent 70%)',
          animation: 'orb-breathe 5s ease-in-out infinite alternate',
          animationDelay: '1.5s',
        }}
      />
      {/* Center subtle glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '800px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(124,58,237,0.04) 0%, transparent 70%)',
        }}
      />
    </div>
  )
}

export default AmbientBackground
