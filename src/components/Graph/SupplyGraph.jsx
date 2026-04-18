import React, { useCallback, useEffect, useState, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from '@dagrejs/dagre'
import { motion } from 'framer-motion'
import CustomNode from './CustomNode'

const nodeTypes = { custom: CustomNode }

const getLayoutedElements = (nodes, edges) => {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 120, marginx: 40, marginy: 40 })

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
    const width = node.data && node.data.tier === 0 ? 220 : node.data && node.data.tier === 1 ? 180 : 170
    g.setNode(node.id, { width, height: 140 })
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
          x: nodeWithPosition.x - (node.data && node.data.tier === 0 ? 110 : 90),
          y: nodeWithPosition.y - 70,
        },
      }
    }),
    edges: connectedEdges,
  }
}

const getEdgeStyle = (confidence) => {
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

const SupplyGraph = ({ graphData, visibleTiers, selectedNode, onNodeClick, disruptions = [] }) => {
  const [displayedCount, setDisplayedCount] = useState(0)

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
            (graphData.edges || []).some(e => disruptions.includes(e.source) && e.target === n.id),
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
        const edgeStyle = getEdgeStyle(e.confidence)
        const isDisrupted = disruptions.includes(e.source) || disruptions.includes(e.target)
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
          style: {
            ...edgeStyle.style,
            ...(isDisrupted ? { stroke: 'rgba(239,68,68,0.6)' } : {}),
          },
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

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)

  // Stagger nodes in one by one
  useEffect(() => {
    setDisplayedCount(0)
    setEdges(layoutedEdges)
    const totalNodes = layoutedNodes.length
    if (totalNodes === 0) return

    // Sort by tier so tier-0 appears first
    const sorted = [...layoutedNodes].sort((a, b) => (a.data.tier || 0) - (b.data.tier || 0))

    let idx = 0
    const interval = setInterval(() => {
      if (idx >= sorted.length) {
        clearInterval(interval)
        return
      }
      setNodes(prev => [...prev, sorted[idx]])
      idx++
      setDisplayedCount(idx)
    }, 150)

    return () => {
      clearInterval(interval)
      setNodes(sorted)
    }
  }, [layoutedNodes.map(n => n.id).join(','), disruptions.join(',')])

  const onNodeClickHandler = useCallback((_, node) => {
    const fullNode = graphData?.nodes.find(n => n.id === node.id)
    onNodeClick?.(fullNode || node.data)
  }, [graphData, onNodeClick])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(139,92,246,0.15)"
          size={1}
          gap={20}
        />
        <Controls
          style={{
            bottom: '20px',
            left: '20px',
          }}
        />
      </ReactFlow>

      {/* Node count badge */}
      {displayedCount < (layoutedNodes.length) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            background: 'rgba(13,13,20,0.85)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: '10px',
            padding: '8px 14px',
            fontSize: '12px',
            color: '#94a3b8',
            fontFamily: 'Inter, sans-serif',
            backdropFilter: 'blur(12px)',
          }}
        >
          Loading nodes… {displayedCount}/{layoutedNodes.length}
        </motion.div>
      )}
    </div>
  )
}

export default SupplyGraph
