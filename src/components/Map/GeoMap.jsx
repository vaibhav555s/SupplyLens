import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { motion } from 'framer-motion'

const RISK_COLORS = {
  'VERIFIED': '#22c55e',
  'INFERRED': '#64748b',
  'sanctions': '#ef4444',
}

const getMarkerColor = (node, disruptions = []) => {
  if (disruptions.includes(node.id)) return '#ef4444'
  if (node.sanctions) return '#ef4444'
  if (node.confidence === 'INFERRED') return '#64748b'
  if (node.countryRisk < 60) return '#f59e0b'
  return '#22c55e'
}

const MapAutoFit = ({ nodes }) => {
  const map = useMap()
  useEffect(() => {
    if (nodes.length === 0) return
    const bounds = nodes.map(n => [n.lat, n.lng])
    try {
      map.fitBounds(bounds, { padding: [60, 60] })
    } catch (e) { }
  }, [nodes.length])
  return null
}

const GeoMap = ({ graphData, visibleTiers, selectedNode, onNodeClick, disruptions = [] }) => {
  if (!graphData) return null

  const nodes = graphData.nodes.filter(n => n.lat && n.lng && (visibleTiers ? visibleTiers.includes(n.tier) : true))
  const edges = graphData.edges.filter(e => {
    const src = nodes.find(n => n.id === e.source)
    const tgt = nodes.find(n => n.id === e.target)
    return src && tgt
  })

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ width: '100%', height: '100%', background: '#0a0a10' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='© <a href="https://carto.com/">Carto</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        <MapAutoFit nodes={nodes} />

        {/* Trade flow lines */}
        {edges.map((edge) => {
          const src = nodes.find(n => n.id === edge.source)
          const tgt = nodes.find(n => n.id === edge.target)
          if (!src || !tgt) return null
          const isVerified = edge.confidence === 'VERIFIED'
          const isDisrupted = disruptions.includes(edge.source) || disruptions.includes(edge.target)

          return (
            <Polyline
              key={edge.id || `${edge.source}-${edge.target}`}
              positions={[[src.lat, src.lng], [tgt.lat, tgt.lng]]}
              pathOptions={{
                color: isDisrupted
                  ? 'rgba(239,68,68,0.6)'
                  : isVerified
                    ? 'rgba(139,92,246,0.5)'
                    : 'rgba(100,116,139,0.3)',
                weight: isVerified ? 1.5 : 1,
                dashArray: isVerified ? null : '6, 6',
              }}
            />
          )
        })}

        {/* Node markers */}
        {nodes.map((node) => {
          const color = getMarkerColor(node, disruptions)
          const isSelected = selectedNode?.id === node.id
          const radius = node.tier === 0 ? 12 : node.tier === 1 ? 9 : node.tier === 2 ? 7 : 5

          return (
            <CircleMarker
              key={node.id}
              center={[node.lat, node.lng]}
              radius={isSelected ? radius + 3 : radius}
              pathOptions={{
                color: isSelected ? '#a855f7' : color,
                fillColor: color,
                fillOpacity: 0.85,
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onNodeClick?.(node),
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -10]}
                permanent={false}
              >
                <div style={{
                  background: 'rgba(13,13,20,0.95)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontFamily: 'Inter, sans-serif',
                  color: '#f8fafc',
                  minWidth: '140px',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', fontFamily: 'Sora, sans-serif' }}>
                    {node.flag} {node.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>T{node.tier} · {node.confidence}</div>
                  {node.hsn && (() => {
                    const hsnArr = Array.isArray(node.hsn)
                      ? node.hsn
                      : String(node.hsn).split(',').map(s => s.trim()).filter(Boolean);
                    return hsnArr.length > 0 ? (
                      <div style={{ fontSize: '10px', color: '#a855f7', fontFamily: 'JetBrains Mono, monospace', marginTop: '4px' }}>
                        {hsnArr.join(' · ')}
                      </div>
                    ) : null;
                  })()}
                  {node.shipments > 0 && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      {node.shipments.toLocaleString()} shipments
                    </div>
                  )}
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* Risk Legend */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        background: 'rgba(13,13,20,0.9)',
        border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: '12px',
        padding: '14px 16px',
        zIndex: 1000,
        backdropFilter: 'blur(20px)',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
          Legend
        </div>
        {[
          { color: '#22c55e', label: 'Verified supplier' },
          { color: '#64748b', label: 'Inferred supplier' },
          { color: '#f59e0b', label: 'Elevated risk' },
          { color: '#ef4444', label: 'Disrupted / Sanctions' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{item.label}</span>
          </div>
        ))}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
        {[
          { style: '━━', color: '#7c3aed', label: 'Verified flow' },
          { style: '- -', color: '#64748b', label: 'Inferred flow' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: item.color, fontFamily: 'monospace', minWidth: '24px' }}>{item.style}</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default GeoMap
