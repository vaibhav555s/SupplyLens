import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'

const TIER_COLORS = {
  0: { border: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)', labelSize: '16px', width: 220 },
  1: { border: 'rgba(139, 92, 246, 0.5)', bg: '#111118', labelSize: '14px', width: 180 },
  2: { border: 'rgba(139, 92, 246, 0.3)', bg: '#111118', labelSize: '13px', width: 170 },
  3: { border: 'rgba(100, 116, 139, 0.4)', bg: 'rgba(100, 116, 139, 0.05)', labelSize: '12px', width: 160 },
}

const getRiskStyle = (node) => {
  if (node.disrupted) {
    return {
      border: 'rgba(239, 68, 68, 0.9)',
      bg: 'rgba(239, 68, 68, 0.15)',
      pulse: 'node-pulse-danger',
    }
  }
  if (node.atRisk) {
    return {
      border: 'rgba(245, 158, 11, 0.7)',
      bg: 'rgba(245, 158, 11, 0.08)',
      pulse: 'node-pulse-warning',
    }
  }
  if (node.sanctions) {
    return {
      border: 'rgba(239, 68, 68, 0.6)',
      bg: 'rgba(239, 68, 68, 0.06)',
      pulse: 'node-pulse-danger',
    }
  }
  if (node.countryRisk && node.countryRisk < 60) {
    return {
      border: 'rgba(245, 158, 11, 0.5)',
      bg: 'rgba(245, 158, 11, 0.04)',
      pulse: '',
    }
  }
  return null
}

const CustomNode = memo(({ data, selected }) => {
  const tier = data.tier ?? 1
  const tierConfig = TIER_COLORS[tier] || TIER_COLORS[1]
  const riskStyle = getRiskStyle(data)

  const borderColor = selected 
    ? '#a855f7' 
    : riskStyle?.border || tierConfig.border
  const bgColor = riskStyle?.bg || tierConfig.bg
  const pulseClass = riskStyle?.pulse || ''
  const nodeWidth = tierConfig.width

  return (
    <div
      className={pulseClass}
      style={{
        width: `${nodeWidth}px`,
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '12px 14px',
        fontFamily: 'Inter, sans-serif',
        cursor: 'pointer',
        boxShadow: selected 
          ? '0 0 20px rgba(168, 85, 247, 0.4)' 
          : riskStyle 
            ? `0 0 12px ${riskStyle.border}30` 
            : '0 4px 16px rgba(0,0,0,0.4)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#7c3aed', border: '2px solid #a855f7', width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#7c3aed', border: '2px solid #a855f7', width: 8, height: 8 }}
      />

      {/* Top row: flag + confidence badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
      }}>
        <span style={{ fontSize: '16px' }}>{data.flag || '🌐'}</span>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: data.confidence === 'VERIFIED' ? '#22c55e' : '#64748b',
            background: data.confidence === 'VERIFIED' ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
            border: `1px solid ${data.confidence === 'VERIFIED' ? 'rgba(34,197,94,0.25)' : 'rgba(100,116,139,0.2)'}`,
            borderRadius: '999px',
            padding: '2px 6px',
          }}
        >
          {data.confidence === 'VERIFIED' ? '✓ VER' : '~ INF'}
        </span>
      </div>

      {/* Company name */}
      <div style={{
        fontSize: tierConfig.labelSize,
        fontWeight: 700,
        color: '#f8fafc',
        lineHeight: 1.2,
        marginBottom: '2px',
        fontFamily: 'Sora, sans-serif',
      }}>
        {data.label}
      </div>

      {/* Full name */}
      {data.fullName && data.fullName !== data.label && (
        <div style={{
          fontSize: '10px',
          color: '#475569',
          marginBottom: '8px',
          lineHeight: 1.3,
        }}>
          {data.fullName}
        </div>
      )}

      {/* Product Name */}
      {data.productName && (
        <div style={{
          fontSize: '11px',
          color: '#38bdf8',
          marginBottom: '8px',
          fontWeight: 500,
        }}>
          {data.productName}
        </div>
      )}

      {/* Sector */}
      {data.sector && (
        <div style={{
          fontSize: '10px',
          color: '#64748b',
          marginBottom: '8px',
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
            gap: '4px',
            marginBottom: '8px',
          }}>
            {hsnArray.slice(0, 3).map(code => (
            <span
              key={code}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                color: '#a855f7',
                background: 'rgba(168,85,247,0.08)',
                border: '1px solid rgba(168,85,247,0.2)',
                borderRadius: '4px',
                padding: '1px 5px',
              }}
            >
              {code}
            </span>
            ))}
          </div>
        ) : null;
      })()}

      {/* Bottom row: tier + shipment count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: '8px',
      }}>
        <span style={{
          fontSize: '10px',
          fontWeight: 600,
          color: '#7c3aed',
          background: 'rgba(124,58,237,0.12)',
          borderRadius: '4px',
          padding: '2px 6px',
        }}>
          T{tier}
        </span>
        {data.shipments > 0 && (
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
            ◈ {data.shipments.toLocaleString()}
          </span>
        )}
        {data.disrupted && (
          <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>
            ⚡ DISRUPTED
          </span>
        )}
        {data.atRisk && !data.disrupted && (
          <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 600 }}>
            ⚠ AT RISK
          </span>
        )}
      </div>
    </div>
  )
})

CustomNode.displayName = 'CustomNode'

export default CustomNode
