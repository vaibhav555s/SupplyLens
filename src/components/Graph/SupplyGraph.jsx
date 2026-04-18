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
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 120, marginx: 40, marginy: 40 })

  nodes.forEach((node) => {
    const width = node.data.tier === 0 ? 220 : node.data.tier === 1 ? 180 : 170
    g.setNode(node.id, { width, height: 140 })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  return {
    nodes: nodes.map((node) => {
      const nodeWithPosition = g.node(node.id)
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - (node.data.tier === 0 ? 110 : 90),
          y: nodeWithPosition.y - 70,
        },
      }
    }),
    edges,
  }
}

const getEdgeStyle = (confidence, isDisrupted) => {
  if (isDisrupted) {
    return {
      style: { stroke: 'rgba(239,68,68,0.7)', strokeWidth: 2 },
      animated: true,
      type: 'smoothstep',
    }
  }
  switch (confidence) {
    case 'VERIFIED':
      return {
        style: { stroke: 'rgba(139, 92, 246, 0.6)', strokeWidth: 2 },
        animated: true,
        type: 'smoothstep',
      }
    case 'INFERRED':
      return {
        style: { stroke: 'rgba(100, 116, 139, 0.4)', strokeWidth: 1.5, strokeDasharray: '5,5' },
        animated: false,
        type: 'smoothstep',
      }
    default:
      return {
        style: { stroke: 'rgba(100, 116, 139, 0.3)', strokeWidth: 1, strokeDasharray: '2,4' },
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
const FlowInner = ({ layoutedNodes, layoutedEdges, onNodeClick, displayedCount, graphNodeCount }) => {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)
  const [ripple, setRipple] = useState(null)
  const [revealedCount, setRevealedCount] = useState(0)

  // Staged tier-by-tier reveal with stagger
  useEffect(() => {
    setRevealedCount(0)
    setEdges([]) // hide edges initially
    const totalNodes = layoutedNodes.length
    if (totalNodes === 0) return

    // Sort by tier so reveal is tier-0 → tier-1 → tier-2...
    const sorted = [...layoutedNodes].sort((a, b) => (a.data.tier || 0) - (b.data.tier || 0))

    setNodes([])

    let idx = 0
    // Add nodes one at a time with per-tier stagger delay
    const addNext = () => {
      if (idx >= sorted.length) {
        // All nodes shown — now reveal edges with a fade
        setTimeout(() => setEdges(layoutedEdges), 300)
        // Then fit the view
        setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 600)
        return
      }
      setNodes(prev => [...prev, sorted[idx]])
      setRevealedCount(idx + 1)
      idx++

      // Slightly longer delay at tier boundaries to create a "wave" effect
      const currentTier = sorted[idx - 1]?.data?.tier || 0
      const nextTier = sorted[idx]?.data?.tier
      const delay = nextTier !== undefined && nextTier !== currentTier ? 400 : 120
      setTimeout(addNext, delay)
    }

    const startTimer = setTimeout(addNext, 200)
    return () => {
      clearTimeout(startTimer)
      setNodes(sorted)
      setEdges(layoutedEdges)
    }
  }, [layoutedNodes.map(n => n.id).join(',')])

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

const SupplyGraph = ({ graphData, visibleTiers, selectedNode, onNodeClick, disruptions = [] }) => {
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
          atRisk: !disruptions.includes(n.id) &&
            graphData.edges.some(e => disruptions.includes(e.source) && e.target === n.id),
        },
        position: { x: 0, y: 0 },
      }))
  }, [graphData, visibleTiers, disruptions])

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
        const edgeStyle = getEdgeStyle(e.confidence, isDisrupted)
        return {
          id: e.id || `${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          label: e.hsn,
          labelStyle: {
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            fill: '#7c3aed',
          },
          labelBgStyle: { fill: 'rgba(8,8,15,0.8)' },
          ...edgeStyle,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: e.confidence === 'VERIFIED' ? 'rgba(139,92,246,0.6)' : 'rgba(100,116,139,0.4)',
          },
        }
      })
  }, [graphData, visibleTiers, disruptions])

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => (rawNodes.length > 0 ? getLayoutedElements(rawNodes, rawEdges) : { nodes: [], edges: [] }),
    [rawNodes, rawEdges]
  )

  const handleNodeClickWrapper = useCallback((event, node) => {
    const fullNode = graphData?.nodes.find(n => n.id === node.id)
    onNodeClick?.(fullNode || node.data)
  }, [graphData, onNodeClick])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlowProvider>
        <FlowInner
          layoutedNodes={layoutedNodes}
          layoutedEdges={layoutedEdges}
          onNodeClick={handleNodeClickWrapper}
          graphNodeCount={layoutedNodes.length}
        />
      </ReactFlowProvider>
    </div>
  )
}

export default SupplyGraph
