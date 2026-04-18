import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HSNTag from '../UI/HSNTag'
import RiskBadge from '../UI/RiskBadge'
import ShimmerButton from '../UI/ShimmerButton'

const RiskRow = ({ label, status, detail }) => {
  const configs = {
    clear: { icon: '✓', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)' },
    moderate: { icon: '⚠', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
    high: { icon: '⚡', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
    elevated: { icon: '⚠', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  }
  const cfg = configs[status?.toLowerCase()] || configs.clear

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>{label}</span>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: '999px',
        padding: '2px 8px',
      }}>
        {cfg.icon} {detail || status}
      </span>
    </div>
  )
}

const NodeDetailPanel = ({ node, onSimulate, onViewMap }) => {
  if (!node) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        gap: '16px',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(139,92,246,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          opacity: 0.5,
        }}>
          ◈
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#475569', marginBottom: '8px', fontFamily: 'Sora, sans-serif' }}>
            Select a node to inspect
          </div>
          <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}>
            Click any supplier node to view<br />trade details and risk assessment
          </div>
        </div>
      </div>
    )
  }

  const countryRisk = node.country_risk_score ?? node.countryRisk ?? 0
  const riskLevel = countryRisk >= 80 ? 'clear' : countryRisk >= 60 ? 'moderate' : 'high'
  const gprLevel = node.gpr_score ? (node.gpr_score > 100 ? 'high' : node.gpr_score > 80 ? 'elevated' : 'clear') : (node.country === 'TW' || node.country === 'CN' ? 'elevated' : 'clear')
  
  const sanctions = node.sanctions_flag ?? node.sanctions ?? false
  const dataSource = node.data_source || (node.confidence === 'VERIFIED' ? 'ImportYeti (Bill of Lading)' : 'LLM-inferred (GPT-4o)')
  const dataSourceDetail = node.data_source_detail || (node.confidence === 'VERIFIED' ? 'US Customs Import Records' : 'Not confirmed via trade records')

  return (
    <motion.div
      key={node.id}
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '24px' }}>{node.flag || '🌐'}</span>
          <RiskBadge type={node.confidence} />
        </div>
        <div style={{
          fontFamily: 'Sora, sans-serif',
          fontSize: '20px',
          fontWeight: 700,
          color: '#f8fafc',
          lineHeight: 1.2,
          marginBottom: '4px',
        }}>
          {node.label}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
          {node.fullName}
        </div>
        {node.productName && (
          <div style={{ fontSize: '12px', color: '#38bdf8', fontFamily: 'Inter, sans-serif', marginTop: '4px', fontWeight: 500 }}>
            {node.productName}
          </div>
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '8px',
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#7c3aed',
            background: 'rgba(124,58,237,0.12)',
            borderRadius: '4px',
            padding: '2px 8px',
          }}>TIER {node.tier}</span>
          {node.sector && (
            <span style={{ fontSize: '11px', color: '#64748b' }}>· {node.sector}</span>
          )}
        </div>
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

      {/* HSN Codes */}
      {node.hsn && node.hsn.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            HSN Codes
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {node.hsn.map(code => <HSNTag key={code} code={code} size="sm" />)}
          </div>
        </div>
      )}

      {/* Trade Volume */}
      {(node.shipments > 0 || node.value) && (
        <div
          style={{
            background: 'rgba(124,58,237,0.06)',
            border: '1px solid rgba(139,92,246,0.12)',
            borderRadius: '12px',
            padding: '14px',
          }}
        >
          <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            Trade Volume
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#f8fafc', fontFamily: 'Sora, sans-serif', lineHeight: 1 }}>
            {node.shipments > 0 ? node.shipments.toLocaleString() : '—'}
            <span style={{ fontSize: '13px', fontWeight: 400, color: '#94a3b8', marginLeft: '6px' }}>shipments</span>
          </div>
          {node.value && (
            <div style={{ fontSize: '16px', color: '#a855f7', fontFamily: 'JetBrains Mono, monospace', marginTop: '4px' }}>
              ${node.value}
            </div>
          )}
          {node.firstSeen && (
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '8px' }}>
              {node.firstSeen} → {node.lastSeen}
            </div>
          )}
        </div>
      )}

      {/* Risk Assessment */}
      <div>
        <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
          Risk Assessment
        </div>
        <RiskRow
          label="Sanctions"
          status={sanctions ? 'high' : 'clear'}
          detail={sanctions ? 'MATCH FOUND' : 'Clear'}
        />
        <RiskRow
          label="Country Risk"
          status={riskLevel}
          detail={`${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} (${countryRisk})`}
        />
        <RiskRow
          label="GPR Index"
          status={gprLevel}
          detail={gprLevel === 'high' ? 'High' : gprLevel === 'elevated' ? 'Elevated' : 'Normal'}
        />
        {node.concentrationRisk && (
          <RiskRow
            label="Concentration"
            status="high"
            detail={`HIGH (${node.concentrationRisk}%)`}
          />
        )}
      </div>

      {/* Data Source */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '10px',
        padding: '12px',
      }}>
        <div style={{ fontSize: '11px', color: '#475569', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
          Data Source
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          {dataSource}
        </div>
        <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
          {dataSourceDetail}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
        <ShimmerButton
          onClick={onSimulate}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          ⚡ Simulate Disruption
        </ShimmerButton>
        <ShimmerButton
          onClick={onViewMap}
          variant="outline"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          ↗ View on Map
        </ShimmerButton>
      </div>
    </motion.div>
  )
}

export default NodeDetailPanel
