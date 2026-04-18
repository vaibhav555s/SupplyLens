import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, Plus } from 'lucide-react'
import { savedCompanies } from '../data/mockData'
import ShimmerButton from '../components/UI/ShimmerButton'
import GlassCard from '../components/UI/GlassCard'
import HSNTag from '../components/UI/HSNTag'

const RiskFlags = ({ sanctions, highRisk, concentrationRisk }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {sanctions > 0 && (
        <span style={{
          fontSize: '12px', color: '#ef4444',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '999px', padding: '3px 10px', fontFamily: 'Inter, sans-serif',
        }}>
          🔴 {sanctions} sanctions
        </span>
      )}
      {highRisk > 0 && (
        <span style={{
          fontSize: '12px', color: '#f59e0b',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
          borderRadius: '999px', padding: '3px 10px', fontFamily: 'Inter, sans-serif',
        }}>
          🟡 {highRisk} high risk
        </span>
      )}
    </div>
    {concentrationRisk && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: '#f59e0b', fontFamily: 'Inter, sans-serif' }}>
          ⚠ {concentrationRisk.country} concentration
        </span>
        <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            width: `${concentrationRisk.percentage}%`,
            height: '100%',
            background: concentrationRisk.percentage > 70 ? '#ef4444' : '#f59e0b',
            borderRadius: '2px',
          }} />
        </div>
        <span style={{
          fontSize: '11px', fontFamily: 'JetBrains Mono, monospace',
          color: concentrationRisk.percentage > 70 ? '#ef4444' : '#f59e0b',
        }}>
          {concentrationRisk.percentage}%
        </span>
      </div>
    )}
  </div>
)

const CompanyCard = ({ company, delay, onView }) => (
  <GlassCard delay={delay} hover style={{ padding: '24px' }}>
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '17px', fontWeight: 700, color: '#f8fafc' }}>
            {company.name}
          </span>
          <span style={{ fontSize: '18px' }}>{company.flag}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#475569', fontFamily: 'Inter, sans-serif' }}>
          Last traced: {company.lastTraced}
        </div>
      </div>
      <div style={{
        background: 'rgba(124,58,237,0.12)',
        border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: '8px',
        padding: '4px 10px',
        fontSize: '12px',
        fontWeight: 700,
        color: '#a855f7',
        fontFamily: 'Inter, sans-serif',
        whiteSpace: 'nowrap',
      }}>
        T{company.maxTier} Trace
      </div>
    </div>

    <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '14px' }} />

    {/* Stats */}
    <div style={{ display: 'flex', gap: '24px', marginBottom: '14px' }}>
      <div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontFamily: 'Sora, sans-serif' }}>
          {company.tier1Count}
        </div>
        <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'Inter, sans-serif' }}>Tier-1 Suppliers</div>
      </div>
      <div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontFamily: 'Sora, sans-serif' }}>
          {company.totalShipments?.toLocaleString() || '—'}
        </div>
        <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'Inter, sans-serif' }}>Shipments</div>
      </div>
      <div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#a855f7', fontFamily: 'JetBrains Mono, monospace' }}>
          ${company.totalValue}
        </div>
        <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'Inter, sans-serif' }}>Trade Value</div>
      </div>
    </div>

    {/* HSN Codes */}
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
      {company.hsnCodes.map(code => (
        <HSNTag key={code} code={code} size="sm" />
      ))}
    </div>

    {/* Risk flags */}
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', marginBottom: '8px' }}>
        Risk Flags
      </div>
      <RiskFlags
        sanctions={company.sanctionsCount}
        highRisk={company.highRiskCount}
        concentrationRisk={company.concentrationRisk}
      />
    </div>

    <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '14px' }} />

    {/* Actions */}
    <div style={{ display: 'flex', gap: '10px' }}>
      <ShimmerButton onClick={onView} style={{ flex: 2 }}>
        View Graph →
      </ShimmerButton>
      <ShimmerButton variant="outline" style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Download size={14} /> CSV
      </ShimmerButton>
    </div>
  </GlassCard>
)

const DashboardPage = () => {
  const navigate = useNavigate()

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      background: '#08080f',
      paddingTop: '80px',
    }}>
      <div style={{ padding: '24px 40px 60px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                fontFamily: 'Sora, sans-serif',
                fontSize: '34px',
                fontWeight: 700,
                color: '#f8fafc',
                letterSpacing: '-0.02em',
                marginBottom: '6px',
              }}
            >
              Supply Chain Dashboard
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ color: '#64748b', fontSize: '15px', fontFamily: 'Inter, sans-serif' }}
            >
              Your traced companies and intelligence history
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ display: 'flex', gap: '12px', flexShrink: 0 }}
          >
            <ShimmerButton variant="outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} /> Export All CSV
            </ShimmerButton>
            <ShimmerButton onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={14} /> New Search
            </ShimmerButton>
          </motion.div>
        </div>

        {/* Summary stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          {[
            { label: 'Companies Traced', value: savedCompanies.length, unit: 'total', color: '#a855f7' },
            { label: 'Total Shipments', value: '12.7K', unit: 'records', color: '#22c55e' },
            { label: 'Risk Flags', value: savedCompanies.reduce((s,c) => s + c.sanctionsCount + c.highRiskCount, 0), unit: 'active', color: '#f59e0b' },
            { label: 'Trade Value', value: '$47.6B', unit: 'tracked', color: '#a855f7' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              style={{
                background: '#111118',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '28px', fontWeight: 700, color: stat.color, fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>
                {stat.unit}
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'Inter, sans-serif', marginTop: '6px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Company cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
        }}>
          {savedCompanies.map((company, i) => (
            <CompanyCard
              key={company.id}
              company={company}
              delay={i * 0.08}
              onView={() => navigate('/graph', { state: { company: company.name } })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
