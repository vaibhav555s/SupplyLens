import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'
import SupplyGraph from '../components/Graph/SupplyGraph'
import GeoMap from '../components/Map/GeoMap'
import NodeDetailPanel from '../components/Graph/NodeDetailPanel'
import ShimmerButton from '../components/UI/ShimmerButton'
import { mockGraphData, riskAlerts, mockCompany } from '../data/mockData'

const TIERS = [0, 1, 2, 3, 4, 5, 6]

const DisruptionModal = ({ node, onClose, onApply }) => {
  const [type, setType] = useState(null)
  const types = ['Sanctions Ban', 'Natural Disaster', 'Port Closure', 'Trade Embargo']

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 20px 20px',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 280, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(13,13,20,0.98)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(139,92,246,0.2)',
          borderTop: '1px solid rgba(139,92,246,0.3)',
          borderRadius: '20px 20px 16px 16px',
          padding: '32px',
          width: '100%',
          maxWidth: '520px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
              Disruption Simulator
            </div>
            {node && (
              <div style={{ fontSize: '13px', color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                Disrupting: {node.label} ({node.country})
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            Select disruption type
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {types.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  background: type === t ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${type === t ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '999px',
                  color: type === t ? '#ef4444' : '#94a3b8',
                  cursor: 'pointer',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Impact preview */}
        <div style={{
          background: 'rgba(239,68,68,0.05)',
          border: '1px solid rgba(239,68,68,0.12)',
          borderRadius: '14px',
          padding: '16px',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '12px', color: '#475569', marginBottom: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            Impact Preview
          </div>
          {[
            { label: 'BOM at Risk', value: '78%', pct: 78, color: '#ef4444' },
            { label: 'Alternative Suppliers', value: '3 found', pct: null },
            { label: 'Countries Affected', value: '5', pct: null },
          ].map(row => (
            <div key={row.label} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>{row.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: row.pct ? row.color : '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}>{row.value}</span>
              </div>
              {row.pct !== null && (
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${row.pct}%`, height: '100%', background: row.color, borderRadius: '2px' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '12px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <ShimmerButton
            onClick={() => onApply(node, type || 'Sanctions Ban')}
            style={{ flex: 2, justifyContent: 'center', background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
          >
            ⚡ Apply Disruption
          </ShimmerButton>
        </div>
      </motion.div>
    </motion.div>
  )
}

const DisruptionToast = ({ onReset }) => (
  <motion.div
    initial={{ x: 100, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: 100, opacity: 0 }}
    style={{
      position: 'fixed',
      top: '80px',
      right: '24px',
      background: 'rgba(13,13,20,0.95)',
      border: '1px solid rgba(239,68,68,0.4)',
      borderRadius: '14px',
      padding: '16px 20px',
      zIndex: 998,
      backdropFilter: 'blur(20px)',
      minWidth: '260px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <Zap size={16} color="#ef4444" />
      <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
        Disruption Active
      </span>
    </div>
    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
      78% of BOM at risk · 3 alternatives found
    </div>
    <button
      onClick={onReset}
      style={{
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '8px',
        color: '#ef4444',
        cursor: 'pointer',
        padding: '6px 14px',
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        width: '100%',
      }}
    >
      Reset Disruption
    </button>
  </motion.div>
)

const GraphPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const companyName = location.state?.company || 'Tesla Inc.'
  const realEntity = location.state?.entity || null // LIVE data from API
  const hsnCodes = location.state?.hsnCodes || []

  // 1. Graph State
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] })
  const [isBuildingGraph, setIsBuildingGraph] = useState(true)

  // 2. Fetch/Construct Graph Mapping
  useEffect(() => {
    let mounted = true
    const constructGraph = async () => {
      try {
        const rootCompany = realEntity?.name || companyName || 'Tesla'
        const country = realEntity?.country || 'US'
        const codes = hsnCodes?.length > 0 ? hsnCodes : ['8501.53']

        setIsBuildingGraph(true)
        const api = (await import('../services/api')).default;
        const generatedGraph = await api.buildGraph(rootCompany, country, codes)

        if (mounted) {
          // If nodes came back empty (fallback), ensure it has at least the root node
          if (!generatedGraph.nodes || generatedGraph.nodes.length === 0) {
            generatedGraph.nodes = [{ id: 'root', label: rootCompany, type: 'root', country, tier: 0, risk_score: 10 }]
            generatedGraph.edges = []
          }
          setGraphData(generatedGraph)
          setIsBuildingGraph(false)
        }
      } catch (err) {
        console.error("Failed to build dynamic graph:", err)
        if (mounted) {
          setGraphData(mockGraphData) // Fallback to mock for UI demo
          setIsBuildingGraph(false)
        }
      }
    }
    constructGraph()
    return () => { mounted = false }
  }, [realEntity, companyName, hsnCodes])

  const [view, setView] = useState('graph')
  const [visibleTiers, setVisibleTiers] = useState([0, 1, 2, 3, 4, 5, 6])
  const [selectedNode, setSelectedNode] = useState(null)
  const [disruptions, setDisruptions] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [prunedOpen, setPrunedOpen] = useState(false)

  const tier0 = graphData.nodes.find(n => n.tier === 0)
  const tier1Count = graphData.nodes.filter(n => n.tier === 1).length
  const tier2Count = graphData.nodes.filter(n => n.tier === 2).length

  const toggleTier = (t) => {
    setVisibleTiers(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node)
  }, [])

  const handleSimulate = (node, type) => {
    setShowModal(false)
    if (node) {
      setDisruptions([node.id])
    }
    setShowToast(true)
  }

  const handleReset = () => {
    setDisruptions([])
    setShowToast(false)
  }

  const riskCounts = {
    sanctions: graphData.nodes.filter(n => n.sanctions).length,
    high: graphData.nodes.filter(n => !n.sanctions && n.countryRisk < 60).length,
    clear: graphData.nodes.filter(n => !n.sanctions && n.countryRisk >= 60).length,
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: '#08080f' }}>
      {/* LEFT PANEL */}
      <div style={{
        width: '260px',
        flexShrink: 0,
        background: '#0d0d14',
        borderRight: '1px solid rgba(139,92,246,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        paddingTop: '72px',
      }}>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Back */}
          <button
            onClick={() => navigate('/hsn', { state: { company: companyName } })}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
              fontSize: '12px', fontFamily: 'Inter, sans-serif',
            }}
          >
            <ArrowLeft size={12} /> Back
          </button>

          {/* Company info */}
          <div>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', marginBottom: '10px',
            }}>
              {tier0?.flag || '🏢'}
            </div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
              {companyName}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>
              {tier0?.country} · {tier0?.sector}
            </div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              Tracing: Electronic integrated circuits (8542)
            </div>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

          {/* Tier controls */}
          <div>
            <div style={{ fontSize: '11px', color: '#475569', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'Inter, sans-serif' }}>
              Visible Tiers
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {TIERS.map(t => (
                <button
                  key={t}
                  onClick={() => toggleTier(t)}
                  style={{
                    flex: 1,
                    background: visibleTiers.includes(t) ? '#7c3aed' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${visibleTiers.includes(t) ? '#7c3aed' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '8px',
                    color: visibleTiers.includes(t) ? '#fff' : '#64748b',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: 'Inter, sans-serif',
                    padding: '6px 2px',
                    transition: 'all 0.2s',
                  }}
                >
                  T{t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

          {/* Risk summary */}
          <div style={{
            background: 'rgba(239,68,68,0.04)',
            border: '1px solid rgba(239,68,68,0.12)',
            borderRadius: '12px',
            padding: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <AlertTriangle size={14} color="#f59e0b" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', fontFamily: 'Sora, sans-serif' }}>
                Risk Summary
              </span>
            </div>
            {[
              { icon: '🔴', label: 'Sanctions', count: riskCounts.sanctions, color: '#ef4444' },
              { icon: '🟡', label: 'High Risk', count: riskCounts.high, color: '#f59e0b' },
              { icon: '🟢', label: 'Clear', count: riskCounts.clear, color: '#22c55e' },
            ].map(row => (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'Inter, sans-serif', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span>{row.icon}</span>{row.label}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: row.color, fontFamily: 'JetBrains Mono, monospace' }}>
                  {row.count}
                </span>
              </div>
            ))}

            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>
                Concentration Risk
              </div>
              {[
                { country: 'Taiwan', pct: 71, color: '#ef4444' },
                { country: 'Korea', pct: 34, color: '#f59e0b' },
              ].map(row => (
                <div key={row.country} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>{row.country}</span>
                    <span style={{ fontSize: '11px', color: row.color, fontFamily: 'JetBrains Mono, monospace' }}>{row.pct}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${row.pct}%`, height: '100%', background: row.color, borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pruned nodes */}
          <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden' }}>
            <button
              onClick={() => setPrunedOpen(o => !o)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
              }}
            >
              <span>Pruned Nodes (39)</span>
              {prunedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <AnimatePresence>
              {prunedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '8px 14px 12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px', fontStyle: 'italic', fontFamily: 'Inter, sans-serif' }}>
                      Removed: office supplies, logistics, MRO
                    </div>
                    {['4901.99', '8473.30', '3926.90', '8516.40', '9403.20'].map(code => (
                      <div key={code} style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        color: '#374151',
                        padding: '2px 0',
                      }}>
                        {code}
                      </div>
                    ))}
                    <div style={{ fontSize: '11px', color: '#374151', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>
                      +34 more...
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Disruption button */}
          <ShimmerButton
            variant="outline"
            onClick={() => setShowModal(true)}
            style={{ width: '100%', justifyContent: 'center', textAlign: 'center' }}
          >
            ⚡ Simulate Disruption
          </ShimmerButton>
        </div>
      </div>

      {/* CENTER PANEL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {/* View toggle */}
        <div style={{
          position: 'absolute',
          top: '76px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(13,13,20,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(139,92,246,0.15)',
          borderRadius: '999px',
          padding: '4px',
          display: 'flex',
          gap: '4px',
        }}>
          {[
            { id: 'graph', label: '◈ Graph View' },
            { id: 'map', label: '🌍 Map View' },
          ].map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              style={{
                background: view === v.id ? 'rgba(124,58,237,0.25)' : 'transparent',
                border: view === v.id ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
                borderRadius: '999px',
                color: view === v.id ? '#f8fafc' : '#64748b',
                cursor: 'pointer',
                padding: '7px 18px',
                fontSize: '13px',
                fontWeight: view === v.id ? 600 : 400,
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Graph/Map area */}
        <div style={{ flex: 1, width: '100%', height: '100%' }}>
          <AnimatePresence mode="wait">
            {isBuildingGraph ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a855f7', fontFamily: 'Sora, sans-serif' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                  <Zap size={48} />
                </motion.div>
                <h3 style={{ marginTop: '24px', letterSpacing: '0.05em' }}>Plotting Real-Time Global Network...</h3>
              </div>
            ) : view === 'graph' ? (
              <motion.div
                key="graph"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ width: '100%', height: '100%' }}
              >
                <SupplyGraph
                  graphData={graphData}
                  visibleTiers={visibleTiers}
                  selectedNode={selectedNode}
                  onNodeClick={handleNodeClick}
                  disruptions={disruptions}
                />
              </motion.div>
            ) : (
              <motion.div
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ width: '100%', height: '100%' }}
              >
                <GeoMap
                  graphData={graphData}
                  visibleTiers={visibleTiers}
                  selectedNode={selectedNode}
                  onNodeClick={handleNodeClick}
                  disruptions={disruptions}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{
        width: '300px',
        flexShrink: 0,
        background: '#0d0d14',
        borderLeft: '1px solid rgba(139,92,246,0.1)',
        paddingTop: '64px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <AnimatePresence mode="wait">
          <NodeDetailPanel
            node={selectedNode}
            key={selectedNode?.id || 'empty'}
            onSimulate={() => selectedNode && setShowModal(true)}
            onViewMap={() => setView('map')}
          />
        </AnimatePresence>
      </div>

      {/* Disruption Modal */}
      <AnimatePresence>
        {showModal && (
          <DisruptionModal
            node={selectedNode}
            onClose={() => setShowModal(false)}
            onApply={handleSimulate}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <DisruptionToast onReset={handleReset} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default GraphPage
