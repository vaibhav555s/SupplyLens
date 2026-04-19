import React, { useEffect, useRef, useState, useMemo } from 'react'
import Globe from 'react-globe.gl'
import { motion } from 'framer-motion'

// Beautiful dark palette for nodes and edges
const COLORS = {
  root: '#a855f7',         // purple
  verified: '#10b981',     // emerald
  inferred: '#3b82f6',     // blue
  disrupted: '#ef4444',    // red
  sanctions: '#ef4444',    // red
  bg: '#05050A',           // deep space
}

const COUNTRY_COORDS = {
  US: { lat: 37.09, lng: -95.71, name: 'United States' }, CN: { lat: 35.86, lng: 104.19, name: 'China' }, JP: { lat: 36.20, lng: 138.25, name: 'Japan' },
  KR: { lat: 35.90, lng: 127.76, name: 'South Korea' }, TW: { lat: 23.69, lng: 120.96, name: 'Taiwan' }, DE: { lat: 51.16, lng: 10.45, name: 'Germany' },
  IN: { lat: 20.59, lng: 78.96, name: 'India' }, MX: { lat: 23.63, lng: -102.55, name: 'Mexico' }, CA: { lat: 56.13, lng: -106.34, name: 'Canada' },
  GB: { lat: 55.37, lng: -3.43, name: 'United Kingdom' }, FR: { lat: 46.22, lng: 2.21, name: 'France' }, IT: { lat: 41.87, lng: 12.56, name: 'Italy' },
  BR: { lat: -14.23, lng: -51.92, name: 'Brazil' }, VN: { lat: 14.05, lng: 108.27, name: 'Vietnam' }, TH: { lat: 15.87, lng: 100.99, name: 'Thailand' },
  MY: { lat: 4.21, lng: 101.97, name: 'Malaysia' }, ID: { lat: -0.78, lng: 113.92, name: 'Indonesia' }, SG: { lat: 1.35, lng: 103.82, name: 'Singapore' },
  AU: { lat: -25.27, lng: 133.77, name: 'Australia' }, NL: { lat: 52.13, lng: 5.29, name: 'Netherlands' }, HK: { lat: 22.39, lng: 114.10, name: 'Hong Kong' },
  PH: { lat: 12.87, lng: 121.77, name: 'Philippines' },
}

const getMarkerColor = (node, disruptions = []) => {
  if (disruptions.includes(node.id)) return COLORS.disrupted
  if (node.sanctions_flag) return COLORS.sanctions
  if (node.tier === 0) return COLORS.root
  if (node.confidence === 'INFERRED') return COLORS.inferred
  if (node.countryRisk > 60) return '#f59e0b'
  return COLORS.verified
}

const GeoMapGlobe = ({ graphData, visibleTiers, selectedNode, onNodeClick, disruptions = [] }) => {
  const globeEl = useRef()
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const containerRef = useRef()

  // Track resizing
  useEffect(() => {
    const observe = new ResizeObserver((entries) => {
      if (entries[0]) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        })
      }
    })
    if (containerRef.current) observe.observe(containerRef.current)
    return () => observe.disconnect()
  }, [])

  // Auto-focus camera on the root node
  useEffect(() => {
    if (graphData?.nodes && globeEl.current) {
      const root = graphData.nodes.find(n => n.tier === 0)
      if (root && root.lat && root.lng) {
        // slight offset to make it look great
        globeEl.current.pointOfView({ lat: root.lat - 10, lng: root.lng + 20, altitude: 1.8 }, 2000)
        // Enable auto-rotate after initial focus
        setTimeout(() => {
          if (globeEl.current) {
            globeEl.current.controls().autoRotate = true
            globeEl.current.controls().autoRotateSpeed = 0.5
          }
        }, 2000)
      }
    }
  }, [graphData])

  if (!graphData) return null

  // Filter nodes & edges
  const nodes = useMemo(() => {
    const coordsMap = {}
    return graphData.nodes
      .filter(n => n.lat != null && n.lng != null && (visibleTiers ? visibleTiers.includes(n.tier) : true))
      .map(n => {
        const key = `${Number(n.lat).toFixed(2)},${Number(n.lng).toFixed(2)}`
        coordsMap[key] = (coordsMap[key] || 0) + 1
        const offset = coordsMap[key] - 1

        // Dispersion: arrange overlapping nodes in a small circle around the center coordinate
        const angle = offset * (Math.PI / 3)
        const radius = offset > 0 ? 1.5 + (offset * 0.5) : 0

        return {
          ...n,
          lat: n.lat + Math.sin(angle) * radius,
          lng: n.lng + Math.cos(angle) * radius,
          color: getMarkerColor(n, disruptions),
          size: n.tier === 0 ? 1.5 : Math.max(0.2, 1.2 - (n.tier * 0.15)),
          desc: `T${n.tier ?? '?'} · ${n.data_source || n.confidence || 'Inferred'}`
        }
      })
  }, [graphData, visibleTiers, disruptions])

  const countryLabels = useMemo(() => {
    const uniqueCountries = [...new Set(graphData.nodes.map(n => n.country).filter(Boolean))]
    return uniqueCountries.map(iso => ({
      ...COUNTRY_COORDS[iso.toUpperCase()],
      iso,
      type: 'countryLabel'
    })).filter(c => c.lat != null)
  }, [graphData])

  const edges = useMemo(() => {
    return graphData.edges.filter(e => {
      const src = nodes.find(n => n.id === e.source)
      const tgt = nodes.find(n => n.id === e.target)
      return src && tgt
    }).map(e => {
      const src = nodes.find(n => n.id === e.source)
      const tgt = nodes.find(n => n.id === e.target)
      const isDisrupted = disruptions.includes(src.id) || disruptions.includes(tgt.id)
      const isVerified = e.confidence === 'VERIFIED'
      return {
        ...e,
        startLat: src.lat, startLng: src.lng,
        endLat: tgt.lat, endLng: tgt.lng,
        color: isDisrupted ? ['#ef4444', '#b91c1c'] : isVerified ? ['#a855f7', '#10b981'] : ['#3b82f6', '#1d4ed8'],
        dashLength: 0.15, // Make all arcs dotted
      }
    })
  }, [graphData, visibleTiers, nodes, disruptions])

  // Custom rich HTML tooltip
  const getTooltipHTML = (d) => `
    <div style="
      background: rgba(13,13,20,0.85);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 10px 14px;
      font-family: 'Inter', sans-serif;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      min-width: 160px;
    ">
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
        <span style="font-size:14px">${d.flag || '🏢'}</span>
        <strong style="color:#f8fafc; font-size:13px; font-family:'Sora', sans-serif;">${d.label || d.name}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
        <span style="color:${d.color}; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">Tier ${d.tier}</span>
        <span style="color:#94a3b8; font-size:10px;">${d.country || ''}</span>
      </div>
      <div style="color:#cbd5e1; font-size:11px; margin-bottom: 4px;">${d.productName || d.commodity || 'Component'}</div>
      ${d.hsn ? `<div style="color:#a855f7; font-family:'JetBrains Mono', monospace; font-size:10px;">HSN: ${Array.isArray(d.hsn) ? d.hsn.join(', ') : d.hsn}</div>` : ''}
      <div style="color:#64748b; font-size:9px; margin-top:6px; text-transform:uppercase; letter-spacing:0.5px;">Src: ${d.desc}</div>
    </div>
  `

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: 'radial-gradient(circle at 50% 50%, #0f0c1b 0%, #05050A 100%)', overflow: 'hidden' }}>

      {/* ── 3D Globe ── */}
      <Globe
        ref={globeEl}
        width={dimensions.width}
        height={dimensions.height}
        // Base globe textures
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)" // Transparent to show gradient

        // Atmosphere layer
        atmosphereColor="#a855f7"
        atmosphereAltitude={0.15}

        // Polygons (Points)
        pointsData={nodes}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={d => d.tier === 0 ? 0.1 : 0.05}
        pointRadius="size"
        pointsMerge={false}
        pointResolution={32}
        pointLabel={getTooltipHTML}
        onPointClick={onNodeClick}

        // Glowing rings
        ringsData={nodes}
        ringLat="lat"
        ringLng="lng"
        ringColor={d => t => d.id === selectedNode?.id ? `rgba(168,85,247,${1 - t})` : `rgba(${d.tier === 0 ? '168,85,247' : '16,185,129'},${1 - t})`}
        ringMaxRadius={d => d.id === selectedNode?.id ? 8 : d.tier === 0 ? 5 : 2}
        ringPropagationSpeed={d => d.id === selectedNode?.id ? 2 : 1}
        ringRepeatPeriod={d => d.id === selectedNode?.id ? 800 : d.tier === 0 ? 1000 : 2000}

        // Animated Flowing Dotted Arcs
        arcsData={edges}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor="color"
        arcDashLength="dashLength"
        arcDashGap={0.2}            // Make them dotted like the graph
        arcDashAnimateTime={1500}   // Flowing animation speed
        arcStroke={d => d.confidence === 'VERIFIED' ? 1.5 : 1}
        arcAltitudeAutoScale={0.4}

        // HTML Overlays (Nodes + Countries) for perfect rendering
        htmlElementsData={[...nodes, ...countryLabels]}
        htmlLat="lat"
        htmlLng="lng"
        htmlElement={d => {
          const el = document.createElement('div')
          if (d.type === 'countryLabel') {
            el.innerHTML = d.name || d.iso
            el.style.color = 'rgba(255, 255, 255, 0.08)' // highly transparent watermark
            el.style.fontSize = '12px'
            el.style.fontWeight = '800'
            el.style.pointerEvents = 'none'
            el.style.fontFamily = 'Sora, sans-serif'
            el.style.textTransform = 'uppercase'
            el.style.letterSpacing = '0.5em'
            el.style.transform = 'translate(-50%, 30px)' // shifted down away from the cluster
          } else {
            el.innerHTML = d.label || d.name
            el.style.color = d.tier === 0 ? '#d8b4fe' : '#f1f5f9'
            el.style.fontSize = '10px'
            el.style.fontWeight = '600'
            el.style.fontFamily = 'Inter, sans-serif'
            el.style.pointerEvents = 'auto'
            el.style.cursor = 'pointer'
            el.style.background = d.tier === 0 ? 'rgba(168,85,247,0.3)' : 'rgba(15,23,42,0.6)'
            el.style.border = d.tier === 0 ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.1)'
            el.style.padding = '3px 8px'
            el.style.borderRadius = '6px'
            el.style.backdropFilter = 'blur(4px)'
            el.style.transform = 'translate(10px, -20px)' // offset from point
            el.onclick = () => onNodeClick?.(d)
          }
          return el
        }}
      />

      {/* ── Overlay Glow Vignette ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 40%, rgba(5,5,10,0.8) 100%)' }} />

      {/* ── Professional Legend Overlay ── */}
      <div style={{
        position: 'absolute', bottom: '24px', right: '24px',
        background: 'rgba(10, 10, 16, 0.75)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px', padding: '16px 20px',
        zIndex: 10, backdropFilter: 'blur(16px)',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '14px' }}>
          Real-Time Telemetry
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Nodes</div>
            {[
              { color: COLORS.root, label: 'Anchor (Root)' },
              { color: COLORS.verified, label: 'Customs API' },
              { color: COLORS.inferred, label: 'AI Inference' },
              { color: COLORS.disrupted, label: 'Sanctions / Alert' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, boxShadow: `0 0 8px ${item.color}` }} />
                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{item.label}</span>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Trade Flows</div>
            {[
              { style: '——', color: '#a855f7', label: 'Tier-1 Customs', dash: false },
              { style: '- - ', color: '#3b82f6', label: 'UN Comtrade', dash: true },
              { style: '——', color: '#ef4444', label: 'Cascading Shock', dash: false },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{
                  width: '16px', height: '2px',
                  background: item.dash ? 'repeating-linear-gradient(90deg, transparent, transparent 2px, #3b82f6 2px, #3b82f6 4px)' : item.color,
                  boxShadow: `0 0 4px ${item.color}`
                }} />
                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}

export default GeoMapGlobe
