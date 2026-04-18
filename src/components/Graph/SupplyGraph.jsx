import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from '@dagrejs/dagre'
import { motion, AnimatePresence } from 'framer-motion'
import CustomNode from './CustomNode'

const nodeTypes = { custom: CustomNode }

const getLayoutedElements = (nodes, edges) => {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 160, marginx: 60, marginy: 60 })

  const nodesMap = new Map(nodes.map(n => [n.id, n]));
  
  // 1. Normalize edge direction (Higher Tier -> Lower Tier)
  let normalizedEdges = edges.map(edge => {
    const s = nodesMap.get(edge.source);
    const t = nodesMap.get(edge.target);
    if (!s || !t) return edge;
    // Materials flow from Higher Tier to Lower Tier (e.g. 1 -> 0)
    if (s.data.tier < t.data.tier) {
      return { ...edge, source: edge.target, target: edge.source };
    }
    return edge;
  });

  // 2. Prevent floating components: Ensure all Tier>0 nodes have at least one downward link
  const connectedEdges = [...normalizedEdges];
  nodes.forEach(node => {
     if (node.data && node.data.tier > 0) {
        const hasOutgoing = connectedEdges.some(e => e.source === node.id && nodesMap.get(e.target)?.data?.tier < node.data.tier);
        if (!hasOutgoing) {
           // Find the closest valid lower tier node to maintain tiered structure
           let targetNode = null;
           for (let i = node.data.tier - 1; i >= 0; i--) {
               targetNode = nodes.find(n => n.data && n.data.tier === i);
               if (targetNode) break;
           }
           if (targetNode) {
              connectedEdges.push({
                  id: `auto-edge-${node.id}-${targetNode.id}`,
                  source: node.id,
                  target: targetNode.id,
                  type: 'smoothstep',
                  animated: true,
                  data: { confidence: 'INFERRED' }
              });
           }
        }
     }
  });

  nodes.forEach((node) => {
    const width = node.data.tier === 0 ? 240 : node.data.tier === 1 ? 200 : node.data.tier === 2 ? 188 : 178
    g.setNode(node.id, { width, height: 160 })
  })

  connectedEdges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  return {
    nodes: nodes.map((node) => {
      const nodeWithPosition = g.node(node.id)
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - (node.data.tier === 0 ? 120 : node.data.tier === 1 ? 100 : node.data.tier === 2 ? 94 : 89),
          y: nodeWithPosition.y - 80,
        },
      }
    }),
    edges: connectedEdges,
  }
}

const getEdgeStyle = (confidence, isDisrupted, isBypassed, isNewPivot) => {
  if (isNewPivot) {
    return {
      style: { stroke: '#10b981', strokeWidth: 3, filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.6))' },
      animated: true,
      type: 'smoothstep',
    }
  }
  if (isBypassed) {
    return {
      style: { stroke: 'rgba(239,68,68,0.3)', strokeWidth: 1.5, strokeDasharray: '4,4' },
      animated: false,
      type: 'smoothstep',
    }
  }
  if (isDisrupted) {
    return {
      style: { stroke: 'rgba(239,68,68,0.85)', strokeWidth: 2.5 },
      animated: true,
      type: 'smoothstep',
    }
  }
  switch (confidence) {
    case 'VERIFIED':
      return {
        style: { stroke: 'rgba(139, 92, 246, 0.8)', strokeWidth: 2.5 },
        animated: true,
        type: 'smoothstep',
      }
    case 'INFERRED':
      return {
        style: { stroke: 'rgba(148, 163, 184, 0.55)', strokeWidth: 1.8, strokeDasharray: '6,5' },
        animated: false,
        type: 'smoothstep',
      }
    default:
      return {
        style: { stroke: 'rgba(100, 116, 139, 0.45)', strokeWidth: 1.5, strokeDasharray: '3,5' },
        animated: false,
        type: 'smoothstep',
      }
  }
}

// Ripple effect on node click
const RippleEffect = ({ position }) => {
  if (!position) return null
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0.8 }}
      animate={{ scale: 3.5, opacity: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        left: position.x - 30,
        top: position.y - 30,
        width: 60,
        height: 60,
        borderRadius: '50%',
        border: '2px solid rgba(168,85,247,0.6)',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  )
}

// Inner flow component that has access to ReactFlow instance
const FlowInner = ({ layoutedNodes, layoutedEdges, onNodeClick, graphNodeCount }) => {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)
  const [ripple, setRipple] = useState(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const hasRevealedRef = useRef(false) // tracks if initial reveal has completed
  const seenNodeIdsRef = useRef(new Set()) // tracks which nodes have been animated in
  const revealTimerRef = useRef(null) // cleanup for staged reveal timers

  // Staged tier-by-tier reveal on INITIAL LOAD only
  // On subsequent tier toggles, just update instantly
  useEffect(() => {
    const totalNodes = layoutedNodes.length
    if (totalNodes === 0) {
      setNodes([])
      setEdges([])
      return
    }

    if (!hasRevealedRef.current) {
      // ─── INITIAL LOAD: staged one-by-one reveal ───
      setRevealedCount(0)
      setEdges([]) // hide edges initially
      setNodes([])

      const sorted = [...layoutedNodes].sort((a, b) => (a.data.tier || 0) - (b.data.tier || 0))
      // Mark all nodes as "new" so CustomNode plays entrance animation
      const nodesWithNewFlag = sorted.map(n => ({
        ...n,
        data: { ...n.data, _isNew: true },
      }))

      let idx = 0
      const timeouts = []

      const addNext = () => {
        if (idx >= nodesWithNewFlag.length) {
          // All nodes shown — now reveal edges with a fade
          const t1 = setTimeout(() => setEdges(layoutedEdges), 300)
          // Then fit the view
          const t2 = setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 600)
          timeouts.push(t1, t2)
          hasRevealedRef.current = true
          // Record all revealed node IDs
          sorted.forEach(n => seenNodeIdsRef.current.add(n.id))
          return
        }
        setNodes(prev => [...prev, nodesWithNewFlag[idx]])
        setRevealedCount(idx + 1)
        idx++

        // Slightly longer delay at tier boundaries to create a "wave" effect
        const currentTier = nodesWithNewFlag[idx - 1]?.data?.tier || 0
        const nextTier = nodesWithNewFlag[idx]?.data?.tier
        const delay = nextTier !== undefined && nextTier !== currentTier ? 400 : 120
        const t = setTimeout(addNext, delay)
        timeouts.push(t)
      }

      const startTimer = setTimeout(addNext, 200)
      timeouts.push(startTimer)
      revealTimerRef.current = timeouts

      return () => {
        timeouts.forEach(clearTimeout)
        // If unmounted during reveal, just show everything
        setNodes(sorted)
        setEdges(layoutedEdges)
        hasRevealedRef.current = true
        sorted.forEach(n => seenNodeIdsRef.current.add(n.id))
      }
    } else {
      // ─── TIER TOGGLE: smooth reposition via CSS transition ───
      const currentSeenIds = seenNodeIdsRef.current
      const newLayoutMap = new Map(layoutedNodes.map(n => [n.id, n]))
      const newIds = new Set(layoutedNodes.map(n => n.id))

      // Record newly seen IDs
      layoutedNodes.forEach(n => seenNodeIdsRef.current.add(n.id))

      // Use functional update to preserve React node identity
      // This is critical — if we replace the array, React unmounts/remounts
      // and the CSS transition on .react-flow__node won't fire
      setNodes(currentNodes => {
        // 1. Keep existing nodes, update their positions + data
        const updated = currentNodes
          .filter(n => newIds.has(n.id)) // remove nodes no longer visible
          .map(n => {
            const newLayout = newLayoutMap.get(n.id)
            if (!newLayout) return n
            return {
              ...n,
              position: newLayout.position, // CSS transition animates this
              data: { ...newLayout.data, _isNew: false },
            }
          })

        // 2. Find genuinely new nodes (not in current set)
        const currentIds = new Set(currentNodes.map(n => n.id))
        const brandNew = layoutedNodes
          .filter(n => !currentIds.has(n.id))
          .map(n => ({
            ...n,
            data: { ...n.data, _isNew: true },
          }))

        return [...updated, ...brandNew]
      })

      setEdges(layoutedEdges)
      setRevealedCount(layoutedNodes.length)

      // Smooth re-fit after CSS transition settles
      setTimeout(() => fitView({ padding: 0.2, duration: 600 }), 550)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutedNodes.map(n => `${n.id}:${Math.round(n.position.x)},${Math.round(n.position.y)}`).join('|')])

  const handleNodeClick = useCallback((event, node) => {
    // Ripple effect at click position
    setRipple({ x: event.clientX, y: event.clientY, key: Date.now() })
    setTimeout(() => setRipple(null), 800)
    onNodeClick?.(event, node)
  }, [onNodeClick])

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(139,92,246,0.15)"
          size={1}
          gap={20}
        />
        <Controls style={{ bottom: '20px', left: '20px' }} />
      </ReactFlow>

      {/* Ripple overlay */}
      <AnimatePresence>
        {ripple && <RippleEffect key={ripple.key} position={ripple} />}
      </AnimatePresence>

      {/* Staged reveal progress badge */}
      <AnimatePresence>
        {revealedCount < graphNodeCount && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              background: 'rgba(13,13,20,0.9)',
              border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: '10px',
              padding: '8px 16px',
              fontSize: '12px',
              color: '#a855f7',
              fontFamily: 'JetBrains Mono, monospace',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7' }}
            />
            Scanning node {revealedCount}/{graphNodeCount}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const SupplyGraph = ({ graphData, visibleTiers, selectedNode, onNodeClick, disruptions = [], resolvedDisruptions = [] }) => {
  const rawNodes = useMemo(() => {
    if (!graphData) return []
    return graphData.nodes
      .filter(n => visibleTiers.includes(n.tier))
      .map(n => ({
        id: n.id,
        type: 'custom',
        data: {
          ...n,
          disrupted: disruptions.includes(n.id),
          bypassed: resolvedDisruptions.includes(n.id),
          isNewPivot: !!n._isNewPivot,
          atRisk: !disruptions.includes(n.id) && !resolvedDisruptions.includes(n.id) &&
            graphData.edges.some(e => disruptions.includes(e.source) && e.target === n.id),
        },
        position: { x: 0, y: 0 },
      }))
  }, [graphData, visibleTiers, disruptions, resolvedDisruptions])

  const rawEdges = useMemo(() => {
    if (!graphData) return []
    return graphData.edges
      .filter(e => {
        const src = graphData.nodes.find(n => n.id === e.source)
        const tgt = graphData.nodes.find(n => n.id === e.target)
        return src && tgt && visibleTiers.includes(src.tier) && visibleTiers.includes(tgt.tier)
      })
      .map(e => {
        const isDisrupted = disruptions.includes(e.source) || disruptions.includes(e.target)
        const isBypassed = resolvedDisruptions.includes(e.source) || resolvedDisruptions.includes(e.target)
        const isNewPivot = !!e._isNewPivot
        const edgeStyle = getEdgeStyle(e.confidence, isDisrupted, isBypassed, isNewPivot)
        return {
          id: e.id || `${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          label: e.hsn || '',
          labelStyle: {
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            fontWeight: 700,
            fill: isNewPivot ? '#10b981' : isDisrupted ? '#ef4444' : isBypassed ? '#7f1d1d' : e.confidence === 'VERIFIED' ? '#c084fc' : '#94a3b8',
            letterSpacing: '0.04em',
          },
          labelBgStyle: {
            fill: 'rgba(8,8,20,0.92)',
            stroke: isNewPivot ? 'rgba(16,185,129,0.4)' : isDisrupted ? 'rgba(239,68,68,0.4)' : isBypassed ? 'rgba(239,68,68,0.1)' : e.confidence === 'VERIFIED' ? 'rgba(139,92,246,0.35)' : 'rgba(100,116,139,0.2)',
            strokeWidth: 1,
          },
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 5,
          ...edgeStyle,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: isNewPivot ? '#10b981' : isBypassed ? 'rgba(239,68,68,0.2)' : e.confidence === 'VERIFIED' ? 'rgba(168,85,247,0.8)' : isDisrupted ? 'rgba(239,68,68,0.8)' : 'rgba(148,163,184,0.5)',
          },
        }
      })
  }, [graphData, visibleTiers, disruptions, resolvedDisruptions])

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => (rawNodes.length > 0 ? getLayoutedElements(rawNodes, rawEdges) : { nodes: [], edges: [] }),
    [rawNodes, rawEdges]
  )

  const handleNodeClickWrapper = useCallback((event, node) => {
    const fullNode = graphData?.nodes.find(n => n.id === node.id)
    onNodeClick?.(fullNode || node.data)
  }, [graphData, onNodeClick])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* ─── TACTICAL OVERLAY ─── */}
      <div style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
        border: '1px solid rgba(139,92,246,0.1)',
        boxShadow: 'inset 0 0 100px rgba(0,0,0,0.5)',
      }}>
        {/* Animated Scanning Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }} />
        
        {/* Scanning Laser Line */}
        <motion.div
          animate={{ top: ['-10%', '110%'] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', left: 0, right: 0, height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.2), transparent)',
            boxShadow: '0 0 15px rgba(168,85,247,0.3)',
          }}
        />

        {/* Corner Brackets */}
        {[
          { top: 20, left: 20, borderLeft: '2px solid rgba(168,85,247,0.4)', borderTop: '2px solid rgba(168,85,247,0.4)' },
          { top: 20, right: 20, borderRight: '2px solid rgba(168,85,247,0.4)', borderTop: '2px solid rgba(168,85,247,0.4)' },
          { bottom: 20, left: 20, borderLeft: '2px solid rgba(168,85,247,0.4)', borderBottom: '2px solid rgba(168,85,247,0.4)' },
          { bottom: 20, right: 20, borderRight: '2px solid rgba(168,85,247,0.4)', borderBottom: '2px solid rgba(168,85,247,0.4)' },
        ].map((style, i) => (
          <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...style }} />
        ))}

        {/* Tactical Badges */}
        <div style={{ position: 'absolute', top: 30, left: 50, color: 'rgba(124,58,237,0.4)', fontSize: '10px', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>
          NETWORK_SCAN v4.2 [ACTIVE]
        </div>
        <div style={{ position: 'absolute', bottom: 30, right: 50, color: 'rgba(124,58,237,0.4)', fontSize: '10px', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>
          INTEL_FEED_ENHANCED // {new Date().toLocaleTimeString()}
        </div>
      </div>

      <ReactFlowProvider>
        <FlowInner
          layoutedNodes={layoutedNodes}
          layoutedEdges={layoutedEdges}
          onNodeClick={handleNodeClickWrapper}
          graphNodeCount={layoutedNodes.length}
        />
      </ReactFlowProvider>
    </div>
  );
};

export default SupplyGraph
