import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HSNTag from '../UI/HSNTag'
import ShimmerButton from '../UI/ShimmerButton'
import api from '../../services/api'

// Section header helper
const SectionLabel = ({ children }) => (
  <div style={{
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#475569',
    marginBottom: '10px',
    fontFamily: 'Inter, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }}>
    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
    {children}
    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
  </div>
)

const RiskRow = ({ label, status, detail }) => {
  const configs = {
    clear: { icon: '✓', color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)', textColor: '#4ade80' },
    moderate: { icon: '◈', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', textColor: '#fbbf24' },
    high: { icon: '⚡', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', textColor: '#f87171' },
    elevated: { icon: '▲', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', textColor: '#fbbf24' },
  }
  const cfg = configs[status?.toLowerCase()] || configs.clear

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '9px 12px',
      borderRadius: '8px',
      background: 'rgba(255,255,255,0.025)',
      marginBottom: '6px',
      border: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>{label}</span>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '11px',
        fontWeight: 700,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: '6px',
        padding: '3px 10px',
        letterSpacing: '0.04em',
      }}>
        <span style={{ fontSize: '10px' }}>{cfg.icon}</span>
        {detail || status}
      </span>
    </div>
  )
}

const NodeDetailPanel = ({ node, onSimulate, onViewMap, rootCompany, hsnCodes, prunedNodes }) => {
  const [summary, setSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  useEffect(() => {
    if (node && node.label) {
      setLoadingSummary(true)
      setSummary(null)
      api.getCompanySummary(node.label, node.country, {
        rootCompany: rootCompany || '',
        tier: node.tier,
        hsnCodes: hsnCodes || [],
        sector: node.sector || '',
        confidence: node.confidence || '',
      })
        .then(res => { setSummary(res.summary) })
        .catch(() => { setSummary("AI insights currently unavailable.") })
        .finally(() => { setLoadingSummary(false) })
    }
  }, [node])

  if (!node) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        gap: '20px',
      }}>
        {/* Animated idle state */}
        <div style={{ position: 'relative' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: '1px solid rgba(139,92,246,0.2)',
              position: 'absolute',
              inset: -8,
            }}
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '1px dashed rgba(139,92,246,0.15)',
              position: 'absolute',
              inset: 0,
            }}
          />
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(124,58,237,0.08)',
            border: '1px solid rgba(139,92,246,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
          }}>
            ◈
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '15px', color: '#64748b', marginBottom: '8px', fontFamily: 'Sora, sans-serif', fontWeight: 600 }}>
            No node selected
          </div>
          <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
            Click any supplier node<br />to inspect its intelligence profile
          </div>
        </div>
        {/* Decorative grid lines */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', opacity: 0.3 }}>
          {[90, 70, 85, 55, 75].map((w, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ repeat: Infinity, duration: 2.5, delay: i * 0.3 }}
              style={{ height: '4px', width: `${w}%`, background: 'rgba(139,92,246,0.3)', borderRadius: '2px', margin: '0 auto' }}
            />
          ))}
        </div>
      </div>
    )
  }

  const countryRisk = node.country_risk_score ?? node.countryRisk ?? 0
  const riskLevel = countryRisk >= 80 ? 'clear' : countryRisk >= 60 ? 'moderate' : 'high'
  const gprLevel = node.country === 'TW' || node.country === 'CN' ? 'elevated' : 'clear'
  const isSanctioned = node.sanctions_flag || node.sanctions || false
  const overallRisk = isSanctioned ? 'CRITICAL' : riskLevel === 'high' ? 'HIGH' : riskLevel === 'moderate' ? 'MEDIUM' : 'LOW'
  const overallRiskColor = overallRisk === 'CRITICAL' || overallRisk === 'HIGH' ? '#f87171' : overallRisk === 'MEDIUM' ? '#fbbf24' : '#4ade80'

  return (
    <motion.div
      key={node.id}
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 50, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '24px 18px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(139,92,246,0.3) transparent',
      }}
    >
      {/* ─── HEADER CARD ─── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(139,92,246,0.05))',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: '16px',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Decorative top-right glow */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 80, height: 80, borderRadius: '50%',
          background: `rgba(${overallRisk === 'CRITICAL' || overallRisk === 'HIGH' ? '239,68,68' : '124,58,237'},0.15)`,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 42, height: 42, borderRadius: '12px',
              background: 'rgba(124,58,237,0.2)',
              border: '1.5px solid rgba(139,92,246,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px',
            }}>
              {node.flag || '🌐'}
            </div>
            <div>
              <div style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#f1f5f9',
                fontFamily: 'Sora, sans-serif',
                lineHeight: 1.2,
                wordBreak: 'break-word',
                maxWidth: '220px'
              }}>
                {node.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                {node.country && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
                    {node.country}{node.sector ? ` · ${node.sector}` : ''}
                  </div>
                )}
                {node.productName && (
                  <div style={{
                    fontSize: '12px',
                    color: '#38bdf8',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>
                    {node.productName}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Overall risk badge */}
          <div style={{
            fontSize: '10px', fontWeight: 800,
            color: overallRiskColor,
            background: `rgba(${overallRisk === 'CRITICAL' || overallRisk === 'HIGH' ? '248,113,113' : overallRisk === 'MEDIUM' ? '251,191,36' : '74,222,128'},0.1)`,
            border: `1px solid ${overallRiskColor}50`,
            borderRadius: '6px',
            padding: '3px 8px',
            letterSpacing: '0.1em',
            flexShrink: 0,
          }}>
            {overallRisk}
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '8px',
        }}>
          <span style={{
            fontSize: '11px', fontWeight: 700,
            color: '#a855f7',
            background: 'rgba(168,85,247,0.15)',
            border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: '6px',
            padding: '3px 10px',
            letterSpacing: '0.04em',
          }}>
            TIER {node.tier}
          </span>
          <span style={{
            fontSize: '11px', fontWeight: 700,
            color: node.confidence === 'VERIFIED' ? '#4ade80' : '#94a3b8',
            background: node.confidence === 'VERIFIED' ? 'rgba(74,222,128,0.1)' : 'rgba(148,163,184,0.08)',
            border: `1px solid ${node.confidence === 'VERIFIED' ? 'rgba(74,222,128,0.3)' : 'rgba(148,163,184,0.2)'}`,
            borderRadius: '6px',
            padding: '3px 10px',
          }}>
            {node.confidence === 'VERIFIED' ? '✓ VERIFIED' : '~ INFERRED'}
          </span>
        </div>
      </div>

      {/* ─── HSN CODES ─── */}
      {((node.hsn && node.hsn.length > 0) || (node.tier === 0 && hsnCodes && hsnCodes.length > 0)) && (() => {
        const hsnSource = (node.hsn && node.hsn.length > 0) ? node.hsn : hsnCodes;
        const hsnArray = Array.isArray(hsnSource)
          ? hsnSource
          : String(hsnSource).split(',').map(s => s.trim()).filter(Boolean);
        return hsnArray.length > 0 ? (
          <div style={{ flexShrink: 0 }}>
            <SectionLabel>Trade Codes</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {hsnArray.map(code => <HSNTag key={code} code={code} size="sm" />)}
            </div>
          </div>
        ) : null;
      })()}

      {/* ─── TRADE VOLUME ─── */}
      {(node.shipments > 0 || node.value) && (
        <div style={{
          background: 'rgba(124,58,237,0.06)',
          border: '1px solid rgba(139,92,246,0.15)',
          borderRadius: '12px',
          padding: '14px 16px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#f1f5f9', fontFamily: 'Sora, sans-serif', lineHeight: 1 }}>
              {node.shipments > 0 ? node.shipments.toLocaleString() : '—'}
            </span>
            <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'Inter, sans-serif' }}>shipments</span>
          </div>
          {node.value && (
            <div style={{ fontSize: '15px', color: '#a855f7', fontFamily: 'JetBrains Mono, monospace', marginTop: '4px', fontWeight: 700 }}>
              ${node.value}
            </div>
          )}
          {node.firstSeen && (
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '8px', fontFamily: 'Inter, sans-serif' }}>
              {node.firstSeen} → {node.lastSeen}
            </div>
          )}
        </div>
      )}

      {/* ─── RISK ASSESSMENT ─── */}
      <div style={{ flexShrink: 0 }}>
        <SectionLabel>Risk Assessment</SectionLabel>
        <RiskRow
          label="Sanctions (OFAC)"
          status={node.sanctions ? 'high' : 'clear'}
          detail={node.sanctions ? 'MATCH FOUND' : 'Clear'}
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

      {/* ─── BOM CLEANSE (NEW) ─── */}
      {node.tier === 0 && prunedNodes && (() => {
        // --- Enhanced Helpers for Demo Intelligence ---
        const deriveNameFromHS = (hs) => {
          if (!hs) return 'Industrial Component';
          const prefix = String(hs).substring(0, 4);
          const map = {
            '8542': 'Semiconductor Devices',
            '8541': 'Discrete Semiconductors',
            '8534': 'Printed Circuit Boards',
            '8517': 'Telecommunication Equipment',
            '8471': 'Computer Processing Units',
            '8504': 'Power Transmission/Converters',
            '8473': 'Computing Machine Parts',
            '3818': 'Electronic Chemical Materials',
            '2804': 'Industrial Silicon/Gases',
            '8708': 'Motor Vehicle Components',
            '8703': 'Automotive Vehicles',
            '4011': 'Industrial Rubber Tires',
            '3923': 'Plastic Packing Materials',
            '4819': 'Paperboard Packaging',
            '7318': 'Industrial Fasteners',
            '8414': 'Air/Vacuum Pumps',
            '8536': 'Electrical Connectors',
            '8507': 'Electric Batteries',
            '8544': 'Insulated Wires/Cables',
            '8419': 'Temperature Change Machinery',
            '3004': 'Pharmaceutical Medicaments',
          };
          return map[prefix] || 'Industrial Component';
        };

        const getSmartReason = (item, parentHS) => {
          const reason = item.reason || '';
          const candidateHS = item.hsn;

          const getIndustry = (hs) => {
            if (!hs) return null;
            const p = String(hs).substring(0, 4);
            if (['8542', '8541', '3818', '2804'].includes(p)) return 'semiconductors';
            if (['8708', '8703', '4011'].includes(p)) return 'automotive';
            if (['3004'].includes(p)) return 'pharmaceuticals';
            if (['8517', '8471', '8534'].includes(p)) return 'electronics';
            return null;
          };

          const pInd = getIndustry(parentHS);
          const cInd = getIndustry(candidateHS);

          // Priority 1: Cross-industry mismatch
          if (pInd && cInd && pInd !== cInd) {
            return `Used in ${cInd}, not ${pInd} manufacturing`;
          }

          // Priority 2: Extract from LLM reasoning specifically
          const segment = reason.toLowerCase();
          if (segment.includes('logistics') || segment.includes('shipping')) return 'General logistics/shipping equipment';
          if (segment.includes('office') || segment.includes('stationery')) return 'Office supplies (non-production)';
          if (segment.includes('packaging') && !segment.includes('specialized')) return 'Standard non-specialized packaging';
          if (segment.includes('safety') || segment.includes('protective')) return 'Safety gear (not a material input)';

          // Priority 3: Shortest punchy summary from text
          let summary = reason.replace(/^YES\/NO\s*[|:-]\s*/i, '');
          const periodIdx = summary.indexOf('.');
          if (periodIdx > 10) summary = summary.substring(periodIdx + 1).trim();

          if (summary.length > 55) summary = summary.substring(0, 52) + '...';
          return summary || 'Not a direct production input';
        };

        const getPrunedStats = (items) => {
          const stats = { logistics: 0, packaging: 0, office: 0, structural: 0 };
          items.forEach(item => {
            const r = (item.reason || '').toLowerCase();
            if (r.includes('logistics') || r.includes('shipping')) stats.logistics++;
            else if (r.includes('packaging')) stats.packaging++;
            else if (r.includes('office')) stats.office++;
            else stats.structural++;
          });
          return stats;
        };

        const stats = getPrunedStats(prunedNodes);
        const parentHSN = Array.isArray(node.hsn) ? node.hsn[0] : String(node.hsn || '').split(',')[0].trim();
        const hasPruned = prunedNodes.length > 0;

        return (
          <div style={{
            background: hasPruned ? 'rgba(74,222,128,0.04)' : 'rgba(139,92,246,0.04)',
            border: `1px solid ${hasPruned ? 'rgba(74,222,128,0.15)' : 'rgba(139,92,246,0.15)'}`,
            borderRadius: '12px',
            padding: '14px 16px',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px' }}>🛡️</span>
              <span style={{ 
                fontSize: '11px', 
                color: hasPruned ? '#4ade80' : '#a78bfa', 
                fontWeight: 800, 
                letterSpacing: '0.1em', 
                textTransform: 'uppercase', 
                fontFamily: 'Inter, sans-serif' 
              }}>
                {hasPruned ? 'BOM Cleanser Active' : 'Supply Intelligence Verified'}
              </span>
            </div>

            {/* BOM Description Box */}
            <div style={{
              background: hasPruned ? 'rgba(74,222,128,0.06)' : 'rgba(139,92,246,0.06)',
              border: `1px solid ${hasPruned ? 'rgba(74,222,128,0.1)' : 'rgba(139,92,246,0.1)'}`,
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: hasPruned ? '16px' : '0',
            }}>
              <div style={{
                fontSize: '11px',
                color: hasPruned ? '#86efac' : '#c4b5fd',
                fontWeight: 700,
                marginBottom: '6px',
                fontFamily: 'Outfit, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>💡</span> Analyst Insight: {hasPruned ? 'Cleaned BOM' : 'High Fidelity Supply Chain'}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#94a3b8',
                lineHeight: '1.4',
                fontFamily: 'Inter, sans-serif'
              }}>
                {hasPruned ? (
                  <>
                    To ensure structural fidelity, we excluded <span style={{ color: '#f8fafc', fontWeight: 600 }}>{prunedNodes.length}</span> indirect trade flows. 
                    These typically represent non-production inputs like administrative overhead or general logistics.
                  </>
                ) : (
                  <>
                    No irrelevant trade flows detected. Source records show <span style={{ color: '#f8fafc', fontWeight: 600 }}>100% structural alignment</span> with this product's industrial profile. 
                    All detected vendors are direct manufacturing material inputs.
                  </>
                )}
              </div>
              
              {/* Category Breakdown Chips */}
              {hasPruned && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                  {stats.logistics > 0 && (
                    <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      📦 {stats.logistics} Logistics
                    </span>
                  )}
                  {stats.packaging > 0 && (
                    <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      🎁 {stats.packaging} Packaging
                    </span>
                  )}
                  {stats.office > 0 && (
                    <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      🖇️ {stats.office} Office
                    </span>
                  )}
                  {stats.structural > 0 && (
                    <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      🛠️ {stats.structural} Mismatch
                    </span>
                  )}
                </div>
              )}
            </div>

            {hasPruned && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {prunedNodes.slice(0, 5).map((item, idx) => {
                  const productName = item.name && item.name !== 'Unknown' ? item.name : deriveNameFromHS(item.hsn);
                  const reasonText = getSmartReason(item, parentHSN);

                  return (
                    <div
                      key={`${item.hsn}-${idx}`}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.borderColor = 'rgba(74,222,128,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '9px',
                          color: '#4ade80',
                          fontWeight: 900,
                          letterSpacing: '0.05em',
                        }}>
                          HS {item.hsn}
                        </span>
                        <div style={{
                          fontSize: '8px',
                          padding: '2px 5px',
                          borderRadius: '4px',
                          background: 'rgba(248,113,113,0.1)',
                          color: '#f87171',
                          fontWeight: 800,
                          textTransform: 'uppercase'
                        }}>Pruned</div>
                      </div>

                      <div style={{
                        fontSize: '13px',
                        color: '#f8fafc',
                        fontWeight: 600,
                        fontFamily: 'Outfit, sans-serif',
                      }}>
                        {productName}
                      </div>

                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        fontFamily: 'Inter, sans-serif',
                        lineHeight: 1.4,
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px'
                      }}>
                        <span style={{ color: '#ef4444', fontSize: '10px', marginTop: '1px' }}>✕</span>
                        <span>{reasonText}</span>
                      </div>
                    </div>
                  );
                })}

                {prunedNodes.length > 5 && (
                  <div style={{
                    fontSize: '11px',
                    color: '#475569',
                    textAlign: 'center',
                    padding: '8px 0',
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    + {prunedNodes.length - 5} additional non-material flows cleansed
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── AI INTELLIGENCE ─── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(168,85,247,0.04))',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: '14px',
        padding: '14px 16px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Shimmer line at top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.5), transparent)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{
            width: 26, height: 26, borderRadius: '8px',
            background: 'rgba(168,85,247,0.15)',
            border: '1px solid rgba(168,85,247,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px',
          }}>✨</div>
          <span style={{ fontSize: '11px', color: '#a855f7', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            AI Intelligence
          </span>
          {loadingSummary && (
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', marginLeft: 'auto' }}
            />
          )}
        </div>

        {loadingSummary ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[100, 85, 70].map((w, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 0.55, 0.2] }}
                transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.15 }}
                style={{ height: '9px', background: 'rgba(168,85,247,0.2)', borderRadius: '4px', width: `${w}%` }}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}
          >
            {summary}
          </motion.div>
        )}
      </div>

      {/* ─── DATA SOURCE ─── */}
      <div style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '10px',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '8px',
          background: node.confidence === 'VERIFIED' ? 'rgba(74,222,128,0.1)' : 'rgba(148,163,184,0.08)',
          border: `1px solid ${node.confidence === 'VERIFIED' ? 'rgba(74,222,128,0.25)' : 'rgba(148,163,184,0.15)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', flexShrink: 0,
        }}>
          {node.confidence === 'VERIFIED' ? '🛃' : '🤖'}
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
            {node.data_source || (node.confidence === 'VERIFIED' ? 'ImportYeti · US Customs' : 'LLM-Inferred (Llama 3)')}
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', fontFamily: 'Inter, sans-serif' }}>
            {node.data_source_detail || (node.confidence === 'VERIFIED' ? 'Bill of Lading records' : 'Not confirmed via trade data')}
          </div>
        </div>
      </div>

      {/* ─── ACTIONS ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '4px', flexShrink: 0 }}>
        <ShimmerButton onClick={onSimulate} style={{ width: '100%', justifyContent: 'center' }}>
          ⚡ Simulate Disruption
        </ShimmerButton>
        <ShimmerButton onClick={onViewMap} variant="outline" style={{ width: '100%', justifyContent: 'center' }}>
          ↗ View on Map
        </ShimmerButton>
      </div>
    </motion.div>
  )
}

export default NodeDetailPanel
