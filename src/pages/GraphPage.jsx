import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, FileDown } from 'lucide-react'
import SupplyGraph from '../components/Graph/SupplyGraph'
import GeoMap from '../components/Map/GeoMap'
import NodeDetailPanel from '../components/Graph/NodeDetailPanel'
import ShimmerButton from '../components/UI/ShimmerButton'
import TerminalLoader from '../components/Graph/TerminalLoader'
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

const DisruptionToast = ({ onReset, onReroute, isResolving, result }) => (
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
      {result ? `${result.bom_impact_pct}% of BOM at risk · Action required (Est recovery: ${result.recovery_est} days)` : '78% of BOM at risk · Action required'}
    </div>
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        onClick={onReroute}
        disabled={isResolving}
        style={{
          flex: 1,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          border: '1px solid rgba(16,185,129,0.5)',
          borderRadius: '8px',
          color: '#ffffff',
          cursor: isResolving ? 'wait' : 'pointer',
          padding: '6px 14px',
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          opacity: isResolving ? 0.7 : 1,
        }}
      >
        {isResolving ? 'Pivoting...' : '⚡ AI Re-Route'}
      </button>
      <button
        onClick={onReset}
        disabled={isResolving}
        style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px',
          color: '#ef4444',
          cursor: isResolving ? 'not-allowed' : 'pointer',
          padding: '6px 10px',
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          opacity: isResolving ? 0.5 : 1,
        }}
      >
        Reset
      </button>
    </div>
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
  const [scanResults, setScanResults] = useState(null)

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

        const startTime = Date.now();
        const generatedGraph = await api.buildGraph(rootCompany, country, codes);

        // Enforce a minimum 6.5 second delay so the TerminalLoader aesthetic animation plays out
        const elapsed = Date.now() - startTime;
        if (elapsed < 6500) {
          await new Promise(resolve => setTimeout(resolve, 6500 - elapsed));
        }

        if (mounted) {
          // If nodes came back empty (fallback), ensure it has at least the root node
          if (!generatedGraph.nodes || generatedGraph.nodes.length === 0) {
            generatedGraph.nodes = [{ id: 'root', label: rootCompany, type: 'root', country, tier: 0, risk_score: 10 }]
            generatedGraph.edges = []
          }
          setGraphData(generatedGraph)

          try {
            const scan = await api.vulnerabilityScan(generatedGraph);
            if (mounted) setScanResults(scan);
          } catch (e) { console.warn('Scan failed', e); }

          setIsBuildingGraph(false)

          // Auto-save to dashboard via MongoDB API
          try {
            await api.saveDashboardEntry({
              companyName: rootCompany,
              country,
              flag: realEntity?.flag || '🏢',
              hsnCodes: codes,
              graphData: generatedGraph,
            })
          } catch (e) {
            console.warn('[Dashboard] Failed to save search:', e)
          }
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

  const [view, setView] = useState(location.state?.view || 'graph')
  const [visibleTiers, setVisibleTiers] = useState([0])
  const [selectedNode, setSelectedNode] = useState(null)

  // Sync view when navbar changes location.state (e.g. clicking "Map" nav item)
  // without triggering a full page re-mount (same /graph pathname key)
  useEffect(() => {
    if (location.state?.view && !isBuildingGraph) {
      setView(location.state.view)
    }
  }, [location.state?.view])
  const [disruptions, setDisruptions] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [activeDisruptionResult, setActiveDisruptionResult] = useState(null)
  const [prunedOpen, setPrunedOpen] = useState(false)
  const [isResolvingReroute, setIsResolvingReroute] = useState(false)
  const [resolvedDisruptions, setResolvedDisruptions] = useState([])

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

  const handleSimulate = async (node, type) => {
    setShowModal(false)
    if (!node) return;

    try {
      const api = (await import('../services/api')).default;
      const res = await api.simulateDisruption(node.id, type, graphData);

      // Use the nodes from the cascade
      const disruptedIds = res.cascade.map(c => c.id);
      setDisruptions(disruptedIds);
      setActiveDisruptionResult(res);
      setShowToast(true);
    } catch (err) {
      console.error(err);
      // Fallback
      setDisruptions([node.id]);
      setShowToast(true);
    }
  }

  const handleReset = () => {
    setDisruptions([])
    setActiveDisruptionResult(null)
    setShowToast(false)
  }

  const handleReroute = async () => {
    if (disruptions.length === 0) return;
    const nodeId = disruptions[0];
    const disruptedNode = graphData.nodes.find(n => n.id === nodeId);
    if (!disruptedNode) return;

    // Find the edge where this node is the source to get its parent and HSN
    const parentEdge = graphData.edges.find(e => e.source === nodeId);
    const parentId = parentEdge ? parentEdge.target : 'root';
    const hsn = parentEdge ? parentEdge.hsn : disruptedNode.hsn;

    setIsResolvingReroute(true);
    try {
      const api = (await import('../services/api')).default;
      const newData = await api.resourceSupplier(nodeId, hsn, disruptedNode.tier, parentId);

      if (newData && Array.isArray(newData.nodes) && Array.isArray(newData.edges)) {
        const newNode = newData.nodes[0];
        const newEdges = [...newData.edges];
        if (newNode) {
          // Find downstream children suppliers that currently point to the disrupted node
          const childrenEdges = graphData.edges.filter(e => e.target === nodeId);
          childrenEdges.forEach(e => {
            newEdges.push({
              ...e,
              id: `e_reroute_${e.source}_${newNode.id}_${Date.now()}`,
              target: newNode.id,
              confidence: 'VERIFIED',
              _isNewPivot: true // Marker for neon green styling
            });
          });
        }

        const taggedNodes = newData.nodes.map(n => ({ ...n, _isNewPivot: true }));

        setGraphData(prev => ({
          nodes: [...prev.nodes, ...taggedNodes],
          edges: [...prev.edges, ...newEdges]
        }));

        // Mark the disrupted node as permanently bypassed/cancelled
        setResolvedDisruptions(prev => [...prev, nodeId]);
        setDisruptions([]);
        setShowToast(false);
      }
    } catch (err) {
      console.error("AI Reroute failed", err);
    } finally {
      setIsResolvingReroute(false);
    }
  }

  const riskCounts = {
    sanctions: graphData.nodes.filter(n => n.sanctions_flag).length,
    high: graphData.nodes.filter(n => !n.sanctions_flag && (n.country_risk_score ?? n.countryRisk) < 60).length,
    clear: graphData.nodes.filter(n => !n.sanctions_flag && (n.country_risk_score ?? n.countryRisk) >= 60).length,
  }

  const concentrationRiskData = useMemo(() => {
    if (!graphData.nodes || graphData.nodes.length === 0) return []
    const rootCountry = realEntity?.country || tier0?.country || 'US' // Assume home base exclusion

    // 1. Group by country
    const countryCounts = {}
    let totalAssigned = 0

    graphData.nodes.forEach(n => {
      // Exclude root country from concentration risk focus
      if (n.country && n.country !== rootCountry) {
        countryCounts[n.country] = (countryCounts[n.country] || 0) + 1
        totalAssigned++
      }
    })

    if (totalAssigned === 0) return []

    // 2. Sort & map to percentages
    const nameMap = {
      TW: 'Taiwan', CN: 'China', KR: 'South Korea', JP: 'Japan',
      VN: 'Vietnam', MY: 'Malaysia', IN: 'India', US: 'United States',
      DE: 'Germany', MX: 'Mexico', BR: 'Brazil', 'CH': 'Switzerland',
    }

    const sorted = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => {
        const pct = Math.round((count / totalAssigned) * 100)
        let color = '#4ade80'
        if (pct >= 50) color = '#f87171' // Red for > 50%
        else if (pct >= 25) color = '#fbbf24' // Yellow for > 25%

        return {
          country: nameMap[code] || code,
          pct,
          color,
          count
        }
      })

    // Return top 2 risks
    return sorted.slice(0, 2)
  }, [graphData.nodes, realEntity, tier0])

  return (
    <div style={{ display: 'flex', height: '100%', background: '#08080f' }}>
      {/* LEFT PANEL */}
      <div style={{
        width: '272px',
        flexShrink: 0,
        background: 'linear-gradient(180deg, #0c0c16 0%, #0a0a14 100%)',
        borderRight: '1px solid rgba(139,92,246,0.12)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        paddingTop: '90px',
      }}>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Back button */}
          <button
            onClick={() => navigate('/hsn', { state: { company: companyName } })}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
              fontSize: '12px', fontFamily: 'Inter, sans-serif',
              transition: 'color 0.2s',
              width: 'fit-content',
            }}
            onMouseOver={e => e.currentTarget.style.color = '#94a3b8'}
            onMouseOut={e => e.currentTarget.style.color = '#475569'}
          >
            <ArrowLeft size={13} />
            <span>Back to HSN</span>
          </button>

          {/* Company card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(139,92,246,0.06))',
            border: '1px solid rgba(139,92,246,0.22)',
            borderRadius: '16px',
            padding: '16px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Corner glow */}
            <div style={{
              position: 'absolute', top: -30, right: -30,
              width: 100, height: 100, borderRadius: '50%',
              background: 'rgba(124,58,237,0.15)', filter: 'blur(30px)',
              pointerEvents: 'none',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(168,85,247,0.3))',
                border: '1.5px solid rgba(168,85,247,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', flexShrink: 0,
              }}>
                {tier0?.flag || '🏢'}
              </div>
              <div>
                <div style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2 }}>
                  {companyName}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Inter, sans-serif', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {tier0?.country && <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', padding: '1px 5px', fontSize: '10px' }}>{tier0.country}</span>}
                  {tier0?.sector && <span style={{ color: '#64748b' }}>{tier0.sector}</span>}
                </div>
              </div>
            </div>
            <div style={{
              fontSize: '10px', color: '#64748b',
              fontFamily: 'Inter, sans-serif', lineHeight: 1.5,
              padding: '8px 10px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              📦 Tracing: {hsnCodes?.length > 0 ? hsnCodes.join(' · ') : 'Electronic integrated circuits (8542)'}
            </div>
          </div>

          {/* Download PDF Report — only visible after graph loads */}
          {!isBuildingGraph && (
            <button
              onClick={async () => {
                const { generateSupplyChainPDF } = await import('../utils/pdfExport')
                generateSupplyChainPDF(companyName, graphData, hsnCodes)
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '12px',
                color: '#4ade80',
                cursor: 'pointer',
                padding: '10px 16px',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.15))'}
              onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))'}
            >
              <FileDown size={14} />
              Download Report
            </button>
          )}

          {/* ─── TIER CONTROLS ─── */}
          <div>
            <div style={{
              fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#475569',
              marginBottom: '12px', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              Supply Chain Depth
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* 2-column grid of tier cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { t: 0, label: 'Root', desc: 'Subject company', icon: '🏢' },
                { t: 1, label: 'Tier 1', desc: 'Direct suppliers', icon: '🔗' },
                { t: 2, label: 'Tier 2', desc: 'Sub-suppliers', icon: '🏭' },
                { t: 3, label: 'Tier 3', desc: 'Raw materials', icon: '⛏' },
                { t: 4, label: 'Tier 4', desc: 'Mining & extract', icon: '🌏' },
                { t: 5, label: 'Tier 5+', desc: 'Deep supply', icon: '🔬' },
              ].map(({ t, label, desc, icon }) => {
                const isActive = visibleTiers.includes(t)
                const nodeCount = graphData.nodes.filter(n => n.tier === t).length
                return (
                  <motion.button
                    key={t}
                    onClick={() => toggleTier(t)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.12))'
                        : 'rgba(255,255,255,0.025)',
                      border: `1.5px solid ${isActive ? 'rgba(168,85,247,0.55)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: '12px',
                      padding: '12px 10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? '0 0 16px rgba(124,58,237,0.2)' : 'none',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Top glow when active */}
                    {isActive && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0,
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.6), transparent)',
                      }} />
                    )}

                    {/* Tier number + node count */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{
                        fontFamily: 'Sora, sans-serif',
                        fontSize: '16px',
                        fontWeight: 800,
                        color: isActive ? '#c084fc' : '#475569',
                        lineHeight: 1,
                      }}>
                        T{t}
                      </span>
                      {nodeCount > 0 && (
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          color: isActive ? '#a855f7' : '#374151',
                          background: isActive ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)',
                          borderRadius: '4px',
                          padding: '1px 5px',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>
                          {nodeCount}
                        </span>
                      )}
                    </div>

                    {/* Icon + label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11px' }}>{icon}</span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isActive ? '#f1f5f9' : '#64748b',
                        fontFamily: 'Inter, sans-serif',
                      }}>
                        {label}
                      </span>
                    </div>

                    {/* Description */}
                    <div style={{
                      fontSize: '9px',
                      color: isActive ? '#94a3b8' : '#334155',
                      fontFamily: 'Inter, sans-serif',
                      lineHeight: 1.4,
                    }}>
                      {desc}
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {/* Tier 6 full-width toggle */}
            <motion.button
              onClick={() => toggleTier(6)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              style={{
                width: '100%',
                marginTop: '8px',
                background: visibleTiers.includes(6)
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.08))'
                  : 'rgba(255,255,255,0.02)',
                border: `1.5px solid ${visibleTiers.includes(6) ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '10px',
                padding: '10px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: visibleTiers.includes(6) ? '#c084fc' : '#475569', fontFamily: 'Sora, sans-serif' }}>T6</span>
                <span style={{ fontSize: '11px' }}>🌐</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: visibleTiers.includes(6) ? '#f1f5f9' : '#64748b', fontFamily: 'Inter, sans-serif' }}>
                    Tier 6 · Extended Network
                  </div>
                  <div style={{ fontSize: '9px', color: visibleTiers.includes(6) ? '#94a3b8' : '#334155', fontFamily: 'Inter, sans-serif' }}>
                    Commodities &amp; global trade routes
                  </div>
                </div>
              </div>
              {graphData.nodes.filter(n => n.tier === 6).length > 0 && (
                <span style={{
                  fontSize: '9px', fontWeight: 700,
                  color: visibleTiers.includes(6) ? '#a855f7' : '#374151',
                  background: visibleTiers.includes(6) ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)',
                  borderRadius: '4px', padding: '2px 6px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {graphData.nodes.filter(n => n.tier === 6).length}
                </span>
              )}
            </motion.button>
          </div>

          {/* Risk Summary */}
          <div style={{
            background: 'rgba(239,68,68,0.04)',
            border: '1px solid rgba(239,68,68,0.14)',
            borderRadius: '14px',
            padding: '14px',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '8px',
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={13} color="#f59e0b" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', fontFamily: 'Sora, sans-serif' }}>
                Risk Summary
              </span>
              <span style={{
                marginLeft: 'auto', fontSize: '10px', fontWeight: 700,
                color: riskCounts.sanctions > 0 ? '#f87171' : '#4ade80',
                background: riskCounts.sanctions > 0 ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)',
                border: `1px solid ${riskCounts.sanctions > 0 ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.3)'}`,
                borderRadius: '5px', padding: '2px 8px', letterSpacing: '0.06em',
              }}>
                {graphData.nodes.length} nodes
              </span>
            </div>

            {[
              { dot: '#f87171', label: 'Sanctions', count: riskCounts.sanctions, color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' },
              { dot: '#fbbf24', label: 'High Risk', count: riskCounts.high, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
              { dot: '#4ade80', label: 'Clear', count: riskCounts.clear, color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.2)' },
            ].map(row => (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 10px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.025)',
                marginBottom: '6px',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.dot, boxShadow: `0 0 6px ${row.dot}80` }} />
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>{row.label}</span>
                </div>
                <span style={{
                  fontSize: '13px', fontWeight: 800, color: row.color,
                  background: row.bg, border: `1px solid ${row.border}`,
                  borderRadius: '6px', padding: '1px 10px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {row.count}
                </span>
              </div>
            ))}

            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '10px', color: '#475569', marginBottom: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Concentration Risk
              </div>
              {concentrationRiskData.map(row => (
                <div key={row.country} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>{row.country}</span>
                    <span style={{ fontSize: '11px', color: row.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{row.pct}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${row.pct}%` }}
                      transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                      style={{ height: '100%', background: `linear-gradient(90deg, ${row.color}, ${row.color}99)`, borderRadius: '3px', boxShadow: `0 0 6px ${row.color}60` }}
                    />
                  </div>
                </div>
              ))}
              {concentrationRiskData.length === 0 && (
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', fontFamily: 'Inter, sans-serif' }}>
                  Diverse network (no significant concentration outside headquarters)
                </div>
              )}
            </div>
          </div>

          {/* Pruned nodes */}
          <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
            <button
              onClick={() => setPrunedOpen(o => !o)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.02)',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                transition: 'background 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🗂</span>
                <span style={{ color: '#94a3b8' }}>Pruned Nodes</span>
                <span style={{
                  fontSize: '10px', fontWeight: 700,
                  background: 'rgba(255,255,255,0.08)', borderRadius: '4px',
                  padding: '1px 6px', color: '#64748b',
                }}>{graphData.pruned?.length || 0}</span>
              </div>
              <motion.div animate={{ rotate: prunedOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronRight size={14} />
              </motion.div>
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
                  <div style={{ padding: '8px 14px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {graphData.pruned && graphData.pruned.length > 0 ? (
                      <>
                        <div style={{ fontSize: '11px', color: '#475569', marginBottom: '10px', fontStyle: 'italic', fontFamily: 'Inter, sans-serif' }}>
                          Excluded: office supplies, logistics, MRO
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {graphData.pruned.slice(0, 8).map(item => (
                            <span key={item.hsn} style={{
                              fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
                              color: '#64748b', background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '5px', padding: '2px 7px',
                            }}>
                              {item.hsn}
                            </span>
                          ))}
                          {graphData.pruned.length > 8 && (
                            <span style={{ fontSize: '10px', color: '#334155', fontFamily: 'Inter, sans-serif' }}>+{graphData.pruned.length - 8} more</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', py: '10px' }}>
                        No nodes were pruned from this graph.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Vulnerability Scan Results */}
          {scanResults && scanResults.scenarios?.length > 0 && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '10px', color: '#475569', marginBottom: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Top Vulnerabilities
              </div>
              {scanResults.scenarios.slice(0, 3).map(vuln => (
                <div key={vuln.node_id} style={{ marginBottom: '10px', padding: '8px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600, fontFamily: 'Sora, sans-serif' }}>{vuln.label}</span>
                    <span style={{ fontSize: '10px', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>T{vuln.tier}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Inter, sans-serif', marginBottom: '6px' }}>
                    Nodes Affected: {vuln.affected_count}
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, vuln.supply_chain_coverage || 0)}%` }}
                      transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                      style={{ height: '100%', background: 'linear-gradient(90deg, #fbbf24, #ef4444)', borderRadius: '2px' }}
                    />
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', textAlign: 'right', marginTop: '4px' }}>
                    {vuln.supply_chain_coverage}% Impact Potential
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Disruption button */}
          <ShimmerButton
            onClick={() => setShowModal(true)}
            style={{ width: '100%', justifyContent: 'center', textAlign: 'center' }}
          >
            ⚡ Simulate Disruption
          </ShimmerButton>
        </div>
      </div>

      {/* CENTER PANEL */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        position: 'relative', 
        overflow: 'hidden',
        paddingTop: '90px', // Ensure content starts below the floating navbar
      }}>
        {/* View toggle — Moved to bottom to avoid overlapping with navbar */}
        {!isBuildingGraph && (
          <div style={{
            position: 'absolute',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(13,13,20,0.9)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: '999px',
              padding: '5px',
              display: 'flex',
              gap: '4px',
              pointerEvents: 'all',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(139,92,246,0.1)',
            }}>
              {[
                { id: 'graph', label: '◈ Graph View' },
                { id: 'map', label: '🌍 Map View' },
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  style={{
                    background: view === v.id ? 'rgba(124,58,237,0.3)' : 'transparent',
                    border: view === v.id ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
                    borderRadius: '999px',
                    color: view === v.id ? '#f8fafc' : '#94a3b8',
                    cursor: 'pointer',
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: view === v.id ? 600 : 400,
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Graph/Map area */}
        <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
          <AnimatePresence mode="wait">
            {isBuildingGraph ? (
              <motion.div
                key="terminal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                style={{ width: '100%', height: '100%' }}
              >
                <TerminalLoader companyName={realEntity?.name || companyName} />
              </motion.div>
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
                  resolvedDisruptions={resolvedDisruptions}
                />
              </motion.div>
            ) : (
              <motion.div
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ width: '100%', height: '100%', position: 'relative' }}
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
        paddingTop: '90px',
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
            rootCompany={companyName}
            hsnCodes={hsnCodes}
            prunedNodes={graphData.pruned}
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
          <DisruptionToast onReset={handleReset} onReroute={handleReroute} isResolving={isResolvingReroute} result={activeDisruptionResult} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default GraphPage
