/**
 * Supply Chain X-Ray — PDF Export v6 (Premium)
 *
 * Corporate intelligence aesthetic. Clean white layout,
 * executive summary, tier distribution, risk analysis.
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Palette ──
const C = {
    white: [255, 255, 255],
    offWhite: [250, 251, 252],
    cardBg: [247, 248, 250],
    bandBg: [240, 242, 245],
    navy: [13, 27, 42],
    navyLight: [22, 42, 65],
    blue: [26, 110, 255],
    blueMuted: [55, 130, 255],
    charcoal: [45, 45, 45],
    body: [55, 65, 81],
    gray: [136, 136, 136],
    grayLight: [180, 185, 195],
    border: [222, 222, 222],
    borderFine: [235, 237, 240],
    red: [192, 57, 43],
    redBg: [253, 243, 241],
    green: [34, 160, 94],
    greenBg: [240, 253, 244],
    amber: [180, 130, 20],
    tblHead: [13, 27, 42],
}

const TIER_PILL = [
    [13, 27, 42],   // T0 navy
    [26, 110, 255],   // T1 blue
    [0, 150, 136],   // T2 teal
    [56, 142, 142],   // T3
    [100, 150, 160],  // T4
    [130, 165, 175],  // T5
    [155, 180, 185],  // T6
]

const TIER_LABELS = {
    0: 'Company Input', 1: 'Direct Suppliers', 2: 'Sub-Suppliers',
    3: 'Material Producers', 4: 'Raw Material Producers',
    5: 'Mining Inputs', 6: 'Terminal Tier',
}

const TIER_DESCS = {
    0: 'Anchor company and HSN selected from import history.',
    1: 'Resolved via ImportYeti & Zauba customs records.',
    2: 'Resolved from Tier-1 records via UN Comtrade.',
    3: 'Semi-processed materials feeding production.',
    4: 'Primary ore and metal producers.',
    5: 'Equipment and energy inputs for mining.',
    6: 'Furthest resolvable upstream tier.',
}

function src(node) {
    if (node.data_source) return node.data_source
    if (node.sanctions_flag) return 'OFAC Sanctioned'
    if (node.confidence === 'VERIFIED') return 'Customs API'
    if (node.confidence === 'INFERRED') return 'Wikidata + Comtrade'
    return 'LLM Inference'
}

function pill(doc, text, x, y, color) {
    const tw = doc.getTextWidth(text)
    doc.setFillColor(...color)
    doc.roundedRect(x, y - 3.2, tw + 5, 4.8, 2.4, 2.4, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(255, 255, 255)
    doc.text(text, x + 2.5, y + 0.2)
}

function hLine(doc, y, x1, x2) {
    doc.setDrawColor(...C.borderFine)
    doc.setLineWidth(0.15)
    doc.line(x1, y, x2, y)
}

function footer(doc, company, pg, total, W, H) {
    doc.setDrawColor(...C.navy)
    doc.setLineWidth(0.4)
    doc.line(25, H - 14, W - 25, H - 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...C.gray)
    doc.text(`Supply Chain X-Ray  |  ${company}`, 25, H - 9)
    doc.text(`Page ${pg} of ${total}`, W / 2, H - 9, { align: 'center' })
    doc.text('Confidential', W - 25, H - 9, { align: 'right' })
}

export async function generateSupplyChainPDF(companyName, graphData, hsnCodes = []) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, H = 297, M = 25
    const CW = W - 2 * M // content width
    const root = graphData.nodes.find(n => n.tier === 0)
    const cc = root?.country || 'US'

    // ── Stats ──
    const N = graphData.nodes.length
    const E = graphData.edges?.length || 0
    const flagged = graphData.nodes.filter(n => n.sanctions_flag)
    const ctrs = [...new Set(graphData.nodes.map(n => n.country).filter(Boolean))]
    const tc = {}
    graphData.nodes.forEach(n => { tc[n.tier ?? 0] = (tc[n.tier ?? 0] || 0) + 1 })
    const maxT = Math.max(...Object.keys(tc).map(Number))
    const sm = {}
    graphData.nodes.forEach(n => {
        const s = n.data_source || (n.confidence === 'VERIFIED' ? 'Customs API' : 'LLM Inference')
        sm[s] = (sm[s] || 0) + 1
    })
    const verified = graphData.nodes.filter(n => n.confidence === 'VERIFIED').length

    // ════════════════════════════════════════════════════════════
    //  PAGE 1 — COVER
    // ════════════════════════════════════════════════════════════

    // Navy header
    doc.setFillColor(...C.navy)
    doc.rect(0, 0, W, 20, 'F')
    // Thin blue accent line below navy
    doc.setFillColor(...C.blue)
    doc.rect(0, 20, W, 0.8, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text('SUPPLY CHAIN X-RAY', M, 9)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...C.grayLight)
    doc.text('Intelligence Report', M, 15)
    doc.setFontSize(7)
    doc.text(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), W - M, 12, { align: 'right' })

    // ── Hero Section ──
    let y = 32
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(26)
    doc.setTextColor(...C.navy)
    doc.text(companyName, M, y)

    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...C.body)
    doc.text(`${cc}    |    HSN: ${hsnCodes.length > 0 ? hsnCodes.join(', ') : 'Auto-inferred'}    |    Depth: ${maxT} Tiers`, M, y)

    // ── Executive Summary ──
    y += 10
    doc.setFillColor(...C.cardBg)
    doc.roundedRect(M, y, CW, 18, 2, 2, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...C.navy)
    doc.text('EXECUTIVE SUMMARY', M + 5, y + 5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.body)
    const summaryText = `This report maps the complete ${maxT}-tier supply chain of ${companyName} (${cc}), identifying ${N} entities across ${ctrs.length} countries with ${E} trade relationships. ${flagged.length > 0 ? `${flagged.length} entit${flagged.length > 1 ? 'ies' : 'y'} flagged under OFAC sanctions: ${flagged.map(n => n.label).join(', ')}.` : 'No entities flagged under OFAC/UFLPA sanctions.'} Data sourced from ${Object.keys(sm).length} APIs including customs records, trade databases, and entity registries.`
    doc.text(summaryText, M + 5, y + 10, { maxWidth: CW - 10 })

    // ── Key Metrics (2x3 Grid) ──
    y += 26
    hLine(doc, y, M, W - M)
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...C.navy)
    doc.text('KEY METRICS', M, y)
    y += 5

    const cW = (CW - 8) / 3
    const cH = 28
    const gX = 4, gY = 4

    const metrics = [
        { lbl: 'TOTAL ENTITIES', val: String(N), sub: `${maxT}-tier depth`, color: C.navy },
        { lbl: 'COUNTRIES', val: String(ctrs.length), sub: ctrs.slice(0, 4).join(', '), color: C.blue },
        { lbl: 'SANCTIONS', val: flagged.length > 0 ? String(flagged.length) : 'CLEAR', sub: flagged.length > 0 ? flagged.map(n => n.label).slice(0, 2).join(', ') : 'No flagged entities', color: flagged.length > 0 ? C.red : C.green, danger: flagged.length > 0 },
        { lbl: 'TRADE LINKS', val: String(E), sub: 'Mapped relationships', color: C.navy },
        { lbl: 'DATA SOURCES', val: `${Object.keys(sm).length} APIs`, sub: Object.keys(sm).slice(0, 2).join(' + '), color: C.blue },
        { lbl: 'VERIFIED', val: `${Math.round(verified / N * 100)}%`, sub: `${verified} of ${N} nodes`, color: verified / N > 0.5 ? C.green : C.amber },
    ]

    metrics.forEach((m, i) => {
        const col = i % 3, row = Math.floor(i / 3)
        const cx = M + col * (cW + gX)
        const cy = y + row * (cH + gY)

        // Card
        doc.setFillColor(...C.offWhite)
        doc.setDrawColor(...C.border)
        doc.setLineWidth(0.15)
        doc.roundedRect(cx, cy, cW, cH, 1.5, 1.5, 'FD')

        // Color top bar
        doc.setFillColor(...m.color)
        doc.rect(cx, cy, cW, 1, 'F')

        // Label
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(...C.gray)
        doc.text(m.lbl, cx + 4, cy + 7)

        // Value
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(18)
        doc.setTextColor(...m.color)
        doc.text(m.val, cx + 4, cy + 18)

        // Sub
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(...C.gray)
        const sub = m.sub.length > 24 ? m.sub.substring(0, 22) + '..' : m.sub
        doc.text(sub, cx + 4, cy + 24)
    })

    // ── Tier Distribution ──
    y += 2 * (cH + gY) + 6
    hLine(doc, y, M, W - M)
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...C.navy)
    doc.text('TIER DISTRIBUTION', M, y)
    y += 5

    const tierKeys = Object.keys(tc).map(Number).sort((a, b) => a - b)
    const maxCount = Math.max(...Object.values(tc))
    const barMaxW = CW - 40

    tierKeys.forEach((t) => {
        const count = tc[t]
        const barW = (count / maxCount) * barMaxW

        // Label
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...C.navy)
        doc.text(`T${t}`, M, y + 2.5)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(...C.gray)
        doc.text(TIER_LABELS[t] || 'Extended', M + 7, y + 2.5)

        // Bar
        const barX = M + 38
        doc.setFillColor(...C.bandBg)
        doc.roundedRect(barX, y, barMaxW, 4, 1, 1, 'F')
        doc.setFillColor(...(TIER_PILL[t] || C.navy))
        if (barW > 2) doc.roundedRect(barX, y, barW, 4, 1, 1, 'F')

        // Count
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(...C.charcoal)
        doc.text(String(count), barX + barMaxW + 3, y + 3)

        y += 7
    })

    // ── Data Provenance ──
    y += 3
    hLine(doc, y, M, W - M)
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...C.navy)
    doc.text('DATA PROVENANCE', M, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.body)
    Object.entries(sm).forEach(([k, v]) => {
        doc.setFont('helvetica', 'bold')
        doc.text(`${v}`, M + 2, y)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...C.gray)
        doc.text(`  ${k}`, M + 8, y)
        doc.setTextColor(...C.body)
        y += 4.5
    })

    // ── Cover footer ──
    doc.setFillColor(...C.navy)
    doc.rect(0, H - 16, W, 16, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...C.grayLight)
    doc.text('CONFIDENTIAL    |    SYN3RGY 3.0    |    Open Innovation Track', W / 2, H - 6, { align: 'center' })

    // ════════════════════════════════════════════════════════════
    //  PAGES 2+ — DATA TABLES
    // ════════════════════════════════════════════════════════════
    const tiers = {}
    graphData.nodes.forEach(n => {
        const t = n.tier ?? 0
        if (!tiers[t]) tiers[t] = []
        tiers[t].push(n)
    })
    const allTierKeys = Object.keys(tiers).map(Number).sort((a, b) => a - b)

    doc.addPage()
    let sY = 16

    // Section title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.navy)
    doc.text('TIER-WISE SUPPLY CHAIN DATA', M, 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.gray)
    doc.text(`${companyName}  |  ${cc}  |  ${N} entities  |  ${maxT} tiers`, M, 14)

    allTierKeys.forEach((tier) => {
        const nodes = tiers[tier]

        if (sY > H - 40) {
            doc.addPage()
            sY = 12
        }

        // Header band
        doc.setFillColor(...C.bandBg)
        doc.rect(M, sY, CW, 8, 'F')

        // Blue left accent
        doc.setFillColor(...(TIER_PILL[tier] || C.navy))
        doc.rect(M, sY, 1.5, 8, 'F')

        // Tier pill
        pill(doc, `T${tier}`, M + 4, sY + 5, TIER_PILL[tier] || C.navy)

        // Label
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...C.navy)
        doc.text(TIER_LABELS[tier] || 'Extended', M + 18, sY + 5.5)

        // Description
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(...C.gray)
        doc.text(TIER_DESCS[tier] || '', M + 60, sY + 5.5)

        sY += 11

        const rows = nodes.map(n => [
            `T${n.tier ?? tier}`,
            n.label || n.name || 'Unknown',
            n.country || '--',
            n.hsn || n.hs_code || '--',
            n.commodity || n.productName || n.sector || '--',
            src(n),
        ])

        const res = autoTable(doc, {
            head: [['Tier', 'Company', 'Country', 'HSN Code', 'Commodity', 'Data Source']],
            body: rows,
            startY: sY,
            margin: { left: M, right: M },
            theme: 'grid',
            styles: {
                fontSize: 7.5,
                cellPadding: 2.2,
                textColor: C.body,
                lineColor: C.borderFine,
                lineWidth: 0.1,
                font: 'helvetica',
                overflow: 'linebreak',
                minCellHeight: 6.5,
            },
            headStyles: {
                fillColor: C.tblHead,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 7.5,
                halign: 'center',
                cellPadding: 2.5,
            },
            bodyStyles: { fillColor: C.white },
            alternateRowStyles: { fillColor: C.cardBg },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: C.blue },
                1: { cellWidth: 34 },
                2: { cellWidth: 14, halign: 'center' },
                3: { cellWidth: 18, halign: 'center' },
                4: { cellWidth: 40 },
                5: { cellWidth: 'auto', fontSize: 6.5, textColor: C.gray, fontStyle: 'italic' },
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.row.raw) {
                    const s = String(data.row.raw[5] || '')
                    if (s.includes('OFAC') || s.includes('Sanctioned')) {
                        data.cell.styles.textColor = C.red
                        data.cell.styles.fontStyle = 'bold'
                        // Tint entire row
                        if (data.column.index === 0) {
                            Object.values(data.row.cells).forEach(c => { c.styles.fillColor = C.redBg })
                        }
                    }
                }
            },
        })

        sY = (res?.finalY ?? doc.lastAutoTable?.finalY ?? sY) + 6
    })

    // ── Footers ──
    const pages = doc.internal.getNumberOfPages()
    for (let i = 2; i <= pages; i++) {
        doc.setPage(i)
        footer(doc, companyName, i, pages, W, H)
    }

    // ── Save + Persist ──
    const safe = companyName.replace(/[^a-zA-Z0-9]/g, '_')
    doc.save(`${safe}_SupplyChain_Report.pdf`)

    try {
        const b64 = doc.output('datauristring')
        const token = localStorage.getItem('scxray_jwt')
        await fetch('/api/dashboard/save-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ companyName, pdfBase64: b64 }),
        })
        console.log('[PDF] Report saved to database')
    } catch (e) {
        console.warn('[PDF] DB persist failed:', e.message)
    }
}
