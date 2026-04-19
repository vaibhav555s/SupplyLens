import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Plus, Trash2, Clock, Search, AlertTriangle, Shield } from 'lucide-react'
import api from '../services/api'
import ShimmerButton from '../components/UI/ShimmerButton'
import GlassCard from '../components/UI/GlassCard'
import HSNTag from '../components/UI/HSNTag'

/* ── Country flag lookup ────────────────────────────────── */
const FLAGS = {
  US: '🇺🇸', CN: '🇨🇳', JP: '🇯🇵', KR: '🇰🇷', DE: '🇩🇪', TW: '🇹🇼',
  IN: '🇮🇳', FR: '🇫🇷', GB: '🇬🇧', IE: '🇮🇪', NL: '🇳🇱', BE: '🇧🇪',
  AU: '🇦🇺', CL: '🇨🇱', BR: '🇧🇷', CH: '🇨🇭', SE: '🇸🇪', FI: '🇫🇮',
  DK: '🇩🇰', NO: '🇳🇴', IT: '🇮🇹', MX: '🇲🇽', LU: '🇱🇺', RU: '🇷🇺',
}
const getFlag = (code) => FLAGS[code] || '🏢'

/* ── Risk Flag Pills ────────────────────────────────────── */
const RiskFlags = ({ riskFlags, concentrationRisk }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {riskFlags.sanctions > 0 && (
        <span style={{
          fontSize: '12px', color: '#ef4444',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '999px', padding: '3px 10px', fontFamily: 'Inter, sans-serif',
        }}>
          🔴 {riskFlags.sanctions} sanctions
        </span>
      )}
      {riskFlags.highRisk > 0 && (
        <span style={{
          fontSize: '12px', color: '#f59e0b',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
          borderRadius: '999px', padding: '3px 10px', fontFamily: 'Inter, sans-serif',
        }}>
          🟡 {riskFlags.highRisk} elevated risk
        </span>
      )}
      {riskFlags.sanctions === 0 && riskFlags.highRisk === 0 && (
        <span style={{
          fontSize: '12px', color: '#22c55e',
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)',
          borderRadius: '999px', padding: '3px 10px', fontFamily: 'Inter, sans-serif',
        }}>
          🟢 All clear
        </span>
      )}
    </div>
    {concentrationRisk && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: '#f59e0b', fontFamily: 'Inter, sans-serif' }}>
          ⚠ {getFlag(concentrationRisk.country)} {concentrationRisk.country} concentration
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

/* ── Tier-1 Supplier Mini-List ──────────────────────────── */
const Tier1List = ({ suppliers }) => {
  if (!suppliers || suppliers.length === 0) return null
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', marginBottom: '8px' }}>
        Tier-1 Suppliers
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {suppliers.slice(0, 5).map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '5px 8px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ fontSize: '12px', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
              {getFlag(s.country)} {s.label}
            </span>
            <span style={{
              fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
              color: s.risk_score > 70 ? '#f59e0b' : '#475569',
            }}>
              Risk: {s.risk_score || '—'}
            </span>
          </div>
        ))}
        {suppliers.length > 5 && (
          <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'Inter, sans-serif', paddingLeft: '8px' }}>
            +{suppliers.length - 5} more...
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Time Ago Helper ────────────────────────────────────── */
const timeAgo = (ts) => {
  const time = typeof ts === 'string' ? new Date(ts).getTime() : ts
  const diff = Date.now() - time
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(time).toLocaleDateString()
}

/* ── Company Card ───────────────────────────────────────── */
const CompanyCard = ({ entry, delay, onView, onDelete }) => (
  <GlassCard delay={delay} hover style={{ padding: '24px' }}>
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '17px', fontWeight: 700, color: '#f8fafc' }}>
            {entry.companyName}
          </span>
          <span style={{ fontSize: '18px' }}>{entry.flag || getFlag(entry.country)}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#475569', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={10} /> {timeAgo(entry.createdAt || entry.timestamp)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
          T{entry.maxTier} Trace
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: '8px',
            color: '#ef4444',
            cursor: 'pointer',
            padding: '4px 6px',
            display: 'flex', alignItems: 'center',
          }}
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>

    <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '14px' }} />

    {/* Stats */}
    <div style={{ display: 'flex', gap: '24px', marginBottom: '14px' }}>
      <div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontFamily: 'Sora, sans-serif' }}>
          {entry.tier1Count}
        </div>
        <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'Inter, sans-serif' }}>Tier-1 Suppliers</div>
      </div>
      <div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontFamily: 'Sora, sans-serif' }}>
          {entry.totalNodes}
        </div>
        <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'Inter, sans-serif' }}>Total Nodes</div>
      </div>
      <div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#a855f7', fontFamily: 'JetBrains Mono, monospace' }}>
          {entry.hsnCodes?.length || 0}
        </div>
        <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'Inter, sans-serif' }}>HSN Codes</div>
      </div>
    </div>

    {/* HSN Codes */}
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
      {(entry.hsnCodes || []).slice(0, 6).map(code => (
        <HSNTag key={code} code={code} size="sm" />
      ))}
      {(entry.hsnCodes || []).length > 6 && (
        <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'Inter, sans-serif', alignSelf: 'center' }}>
          +{entry.hsnCodes.length - 6}
        </span>
      )}
    </div>

    {/* Tier-1 Suppliers */}
    <Tier1List suppliers={entry.tier1Suppliers} />

    {/* Risk flags */}
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', marginBottom: '8px' }}>
        Risk Flags
      </div>
      <RiskFlags
        riskFlags={entry.riskFlags || { sanctions: 0, highRisk: 0, clear: 0 }}
        concentrationRisk={entry.concentrationRisk}
      />
    </div>

    <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '14px' }} />

    {/* Actions */}
    <div style={{ display: 'flex', gap: '10px' }}>
      <ShimmerButton onClick={onView} style={{ flex: 2 }}>
        View Graph →
      </ShimmerButton>
    </div>
  </GlassCard>
)

/* ── Empty State ────────────────────────────────────────── */
const EmptyState = ({ onSearch }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 40px',
      textAlign: 'center',
    }}
  >
    <div style={{
      width: '80px', height: '80px', borderRadius: '20px',
      background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(168,85,247,0.08))',
      border: '1px solid rgba(139,92,246,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: '24px',
    }}>
      <Search size={32} color="#a855f7" />
    </div>
    <h2 style={{
      fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: 700,
      color: '#f8fafc', marginBottom: '8px',
    }}>
      No searches yet
    </h2>
    <p style={{
      fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#64748b',
      maxWidth: '400px', marginBottom: '28px', lineHeight: 1.6,
    }}>
      Search for a company to trace its supply chain. Results will automatically appear here with Tier-1 suppliers, risk flags, and trade insights.
    </p>
    <ShimmerButton onClick={onSearch} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Search size={14} /> Start First Search
    </ShimmerButton>
  </motion.div>
)

/* ── Dashboard Page ─────────────────────────────────────── */
const DashboardPage = () => {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const data = await api.getDashboardHistory()
      setHistory(data)
    } catch (err) {
      console.error('[Dashboard] Failed to fetch history:', err)
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const handleDelete = async (id) => {
    try {
      await api.deleteDashboardEntry(id)
      setHistory(prev => prev.filter(h => h._id !== id))
    } catch (err) {
      console.error('[Dashboard] Delete failed:', err)
    }
  }

  const handleClearAll = async () => {
    if (window.confirm('Clear all search history?')) {
      try {
        await api.clearDashboard()
        setHistory([])
      } catch (err) {
        console.error('[Dashboard] Clear failed:', err)
      }
    }
  }

  // Compute summary stats from live history
  const totalCompanies = history.length
  const totalNodes = history.reduce((s, h) => s + (h.totalNodes || 0), 0)
  const totalRiskFlags = history.reduce((s, h) => s + (h.riskFlags?.sanctions || 0) + (h.riskFlags?.highRisk || 0), 0)
  const totalTier1 = history.reduce((s, h) => s + (h.tier1Count || 0), 0)

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08080f' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}>
          <Search size={32} color="#a855f7" />
        </motion.div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div style={{ height: '100%', overflowY: 'auto', background: '#08080f', paddingTop: '80px' }}>
        <div style={{ padding: '24px 40px 60px', maxWidth: '1200px', margin: '0 auto' }}>
          <EmptyState onSearch={() => navigate('/')} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#08080f', paddingTop: '90px' }}>
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
              Supplier Dashboard
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
            <ShimmerButton variant="outline" onClick={handleClearAll} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trash2 size={14} /> Clear All
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
            { label: 'Companies Traced', value: totalCompanies, unit: 'total', color: '#a855f7', icon: <Shield size={16} /> },
            { label: 'Tier-1 Suppliers', value: totalTier1, unit: 'resolved', color: '#22c55e', icon: null },
            { label: 'Risk Flags', value: totalRiskFlags, unit: 'active', color: totalRiskFlags > 0 ? '#f59e0b' : '#22c55e', icon: <AlertTriangle size={16} /> },
            { label: 'Total Nodes', value: totalNodes, unit: 'mapped', color: '#a855f7', icon: null },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: '#111118',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: stat.color, fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}>
                  {stat.value}
                </div>
                {stat.icon && <span style={{ color: stat.color, opacity: 0.6 }}>{stat.icon}</span>}
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
          <AnimatePresence>
            {history.map((entry, i) => (
              <motion.div
                key={entry._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.06 }}
              >
                <CompanyCard
                  entry={entry}
                  delay={i * 0.06}
                  onView={() => navigate('/graph', {
                    state: {
                      company: entry.companyName,
                      hsnCodes: entry.hsnCodes,
                      entity: { name: entry.companyName, country: entry.country, flag: entry.flag },
                    }
                  })}
                  onDelete={() => handleDelete(entry._id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
