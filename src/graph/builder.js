// ─── Supply Chain Graph Builder v2 ───
// Strategy: API-FIRST → Structured Sources → LLM Last Resort
//
// Tier 1-2:  ImportYeti → Zauba → Comtrade (real customs data)
// Tier 3-6:  Comtrade deep-dive → SEC EDGAR → Wikidata → LLM last resort
// Cycle guard: visitedSet prevents infinite expansion loops

const { httpPost } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');
const { importyeti, zauba, comtrade } = require('../connectors');
const { jsonrepair } = require('jsonrepair');
const { filterBOM } = require('../logic/bomFilter');
const { getSupplierMentions } = require('../connectors/edgar');
const { getCompaniesByIndustryAndCountry } = require('../connectors/wikidata');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRY_COORDS = {
    US: { lat: 37.09, lng: -95.71 }, CN: { lat: 35.86, lng: 104.19 }, JP: { lat: 36.20, lng: 138.25 },
    KR: { lat: 35.90, lng: 127.76 }, TW: { lat: 23.69, lng: 120.96 }, DE: { lat: 51.16, lng: 10.45 },
    IN: { lat: 20.59, lng: 78.96 }, MX: { lat: 23.63, lng: -102.55 }, CA: { lat: 56.13, lng: -106.34 },
    GB: { lat: 55.37, lng: -3.43 }, FR: { lat: 46.22, lng: 2.21 }, IT: { lat: 41.87, lng: 12.56 },
    BR: { lat: -14.23, lng: -51.92 }, VN: { lat: 14.05, lng: 108.27 }, TH: { lat: 15.87, lng: 100.99 },
    MY: { lat: 4.21, lng: 101.97 }, ID: { lat: -0.78, lng: 113.92 }, SG: { lat: 1.35, lng: 103.82 },
    AU: { lat: -25.27, lng: 133.77 }, NL: { lat: 52.13, lng: 5.29 }, HK: { lat: 22.39, lng: 114.10 },
    PH: { lat: 12.87, lng: 121.77 },
};

function coordsFor(iso) { return COUNTRY_COORDS[(iso || '').toUpperCase()] || { lat: 0, lng: 0 }; }

function countryRisk(iso) {
    if (['CN', 'RU', 'IR', 'KP', 'BY', 'MM'].includes(iso)) return Math.floor(Math.random() * 20) + 60;
    if (['IN', 'VN', 'ID', 'MX', 'NG', 'PK'].includes(iso)) return Math.floor(Math.random() * 20) + 40;
    return Math.floor(Math.random() * 30) + 20;
}

function toNodeId(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
        || `n_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract a valid JSON object from a possibly-truncated LLM response.
 * Uses jsonrepair to close unclosed brackets/braces before parsing.
 */
function extractJson(text) {
    let raw = text.trim();
    // Remove markdown code blocks if present
    if (raw.startsWith('```')) {
        raw = raw.replace(/^```[a-z]*\n/, '').replace(/```$/, '').trim();
    }

    try { return JSON.parse(raw); } catch { }

    // Find the JSON block (skip any preamble text)
    const startObj = raw.indexOf('{');
    const startArr = raw.indexOf('[');

    let start = -1;
    if (startObj !== -1 && startArr !== -1) start = Math.min(startObj, startArr);
    else if (startObj !== -1) start = startObj;
    else if (startArr !== -1) start = startArr;

    if (start !== -1) {
        raw = raw.slice(start);
        try { return JSON.parse(raw); } catch { }
    }

    // Use jsonrepair to fix truncated / malformed JSON (closes unclosed arrays/objects)
    try {
        const repaired = jsonrepair(raw);
        return JSON.parse(repaired);
    } catch (err) {
        console.error(`[LLM JSONRepair Failed] ${err.message}. Raw prefix: ${raw.slice(0, 100)}`);
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: API connectors — build Tier 1 & 2
// ─────────────────────────────────────────────────────────────────────────────

async function fetchTier1FromImportYeti(companyName) {
    try {
        console.log(`[Graph/API] ImportYeti: fetching for "${companyName}"...`);
        const records = await importyeti.searchCompany(companyName);
        console.log(`[Graph/API] ImportYeti: ${records.length} records.`);
        return records;
    } catch (err) {
        console.warn(`[Graph/API] ImportYeti failed: ${err.message}`);
        return [];
    }
}

async function fetchTier1FromZauba(companyName) {
    try {
        console.log(`[Graph/API] Zauba: fetching for "${companyName}"...`);
        const records = await zauba.searchCompany(companyName, 'import');
        console.log(`[Graph/API] Zauba: ${records.length} records.`);
        return records;
    } catch (err) {
        console.warn(`[Graph/API] Zauba failed: ${err.message}`);
        return [];
    }
}

async function fetchTier2FromComtrade(countryIso, hsnCodes) {
    const allRecords = [];
    for (const hs of hsnCodes.slice(0, 3)) {
        try {
            console.log(`[Graph/API] Comtrade: HS ${hs} for ${countryIso}...`);
            const records = await comtrade.getTopImportPartners(countryIso, hs, 5);
            allRecords.push(...records);
        } catch (err) {
            console.warn(`[Graph/API] Comtrade failed for HS ${hs}: ${err.message}`);
        }
    }
    console.log(`[Graph/API] Comtrade: ${allRecords.length} total records.`);
    return allRecords;
}

function recordsToGraph(companyName, country, tier1Records, tier2Records, hsnCodes) {
    const nodes = [];
    const edges = [];
    const nodeIds = new Set();

    // Tier 0 — root
    const rootCoords = coordsFor(country);
    nodes.push({
        id: 'root', label: companyName, productName: 'End Product / Assembly',
        type: 'root', tier: 0, country,
        country_risk_score: countryRisk(country), gpr_score: 50, sanctions_flag: false,
        data_source: 'ImportYeti / Zauba', data_source_detail: 'US & India Customs Import Records',
        lat: rootCoords.lat, lng: rootCoords.lng,
    });
    nodeIds.add('root');

    // Tier 1 — direct suppliers (deduplicated by source_name)
    const t1Map = new Map();
    for (const r of tier1Records) {
        if (!r.source_name) continue;
        const k = r.source_name.toLowerCase();
        if (!t1Map.has(k)) t1Map.set(k, r);
        else t1Map.get(k).shipment_count += (r.shipment_count || 0);
    }

    let t1i = 0;
    for (const [, r] of t1Map) {
        if (t1i >= 8) break;
        const id = `t1_${toNodeId(r.source_name)}`;
        if (nodeIds.has(id)) continue;
        nodeIds.add(id); t1i++;
        const c = coordsFor(r.source_country);
        nodes.push({
            id, label: r.source_name, productName: r.commodity || hsnCodes[0] || 'Component',
            type: 'manufacturer', tier: 1, country: r.source_country || 'XX',
            country_risk_score: countryRisk(r.source_country),
            gpr_score: Math.floor(Math.random() * 40) + 20, sanctions_flag: false,
            data_source: r.data_source === 'zauba' ? 'Zauba Customs' : 'ImportYeti Bill of Lading',
            data_source_detail: `${r.shipment_count || 'N/A'} shipments`,
            lat: c.lat, lng: c.lng, hsn: r.hs_code_6 || '', confidence: r.confidence || 'VERIFIED',
        });
        edges.push({
            id: `e_${id}_root`, source: id, target: 'root', type: 'supplies',
            hsn: r.hs_code_6 || hsnCodes[0] || '', confidence: r.confidence || 'VERIFIED',
        });
    }

    // Tier 2 — country-level Comtrade nodes (deduplicated by source_country)
    const t2Map = new Map();
    for (const r of tier2Records) {
        const k = r.source_country;
        if (!k || k === country) continue;
        if (!t2Map.has(k)) t2Map.set(k, { ...r });
        else t2Map.get(k).trade_value += r.trade_value;
    }

    let t2i = 0;
    for (const [srcCountry, r] of t2Map) {
        if (t2i >= 8) break;
        const id = `t2_${srcCountry.toLowerCase()}`;
        if (nodeIds.has(id)) continue;
        nodeIds.add(id); t2i++;
        const c = coordsFor(srcCountry);
        const sanctioned = ['CN', 'RU', 'IR', 'KP'].includes(srcCountry);
        nodes.push({
            id, label: `${srcCountry} Suppliers`, productName: r.commodity || hsnCodes[0] || 'Commodity',
            type: 'distributor', tier: 2, country: srcCountry,
            country_risk_score: countryRisk(srcCountry),
            gpr_score: Math.floor(Math.random() * 50) + 20, sanctions_flag: sanctioned,
            data_source: 'UN Comtrade',
            data_source_detail: `Trade value: $${(r.trade_value / 1e6).toFixed(1)}M (2023)`,
            lat: c.lat, lng: c.lng, hsn: r.hs_code_6 || '', confidence: 'INFERRED',
        });
        const matchingT1 = nodes.find(n => n.tier === 1 && n.country === srcCountry);
        const target = matchingT1 ? matchingT1.id : 'root';
        edges.push({
            id: `e_${id}_${target}`, source: id, target, type: 'supplies',
            hsn: r.hs_code_6 || hsnCodes[0] || '', confidence: 'INFERRED',
        });
    }

    return { nodes, edges };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2a: Structured waterfall — Tier 3-6 nodes WITHOUT LLM
// Priority: Comtrade deep-dive → SEC EDGAR → Wikidata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build Tier 3-6 nodes using structured sources recursively (no LLM).
 * Falls back gracefully at each step — empty array if all fail.
 *
 * @param {string} companyName   - Root company
 * @param {string} country       - Root company ISO-2 country
 * @param {Array<string>} hsnCodes - Kept HS codes after BOM filter
 * @param {object} existingGraph - API skeleton with Tier 0-2 nodes
 * @param {Set<string>} visitedSet - Cycle guard (node labels already in graph)
 * @returns {Promise<{nodes: Array, edges: Array}>}
 */
async function expandWithStructuredSources(companyName, country, hsnCodes, existingGraph, visitedSet) {
    const allNodes = [];
    const allEdges = [];
    const hsn0 = hsnCodes[0] || '';

    // Collect Tier 2 nodes as expansion anchors
    // If no Tier 2, try Tier 1. If no Tier 1, try Tier 0 (root).
    let currentTierAnchors = (existingGraph?.nodes || []).filter(n => n.tier === 2);
    if (currentTierAnchors.length === 0) currentTierAnchors = (existingGraph?.nodes || []).filter(n => n.tier === 1);
    if (currentTierAnchors.length === 0) currentTierAnchors = [{ id: 'root', tier: 0, country, label: companyName }];
    
    let startingTier = currentTierAnchors[0].tier + 1;

    for (let currentTier = startingTier; currentTier <= 6; currentTier++) {
        const nextTierAnchors = [];
        
        for (const anchor of currentTierAnchors.slice(0, 4)) {
            const anchorCountry = anchor.country || country;
            const anchorLabel = anchor.label || companyName;
            let newSuppliers = [];

            // ── Source 1: Comtrade deep-dive for each anchor country ──
            if (hsnCodes.length > 0) {
                try {
                    const comtradeRecords = await comtrade.getTopImportPartners(anchorCountry, hsnCodes[0], 3);
                    for (const rec of comtradeRecords) {
                        if (rec.source_country && !newSuppliers.find(s => s.country === rec.source_country)) {
                            newSuppliers.push({
                                name: `${rec.source_country} ${rec.commodity || 'Component'} Suppliers`,
                                country: rec.source_country,
                                source: 'comtrade-tier' + currentTier,
                                confidence: 'INFERRED',
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`[Builder/Waterfall] Comtrade T${currentTier} failed for ${anchorCountry}: ${err.message}`);
                }
            }

            // ── Source 2: SEC EDGAR — supplier mentions in 10-K filings ──
            if (newSuppliers.length < 2) {
                try {
                    const edgarSuppliers = await getSupplierMentions(anchorLabel, hsn0.substring(0, 4) || 'component', hsn0);
                    for (const s of edgarSuppliers.slice(0, 3)) {
                        if (!visitedSet.has(s.name.toLowerCase())) {
                            newSuppliers.push(s);
                        }
                    }
                } catch (err) {
                    console.warn(`[Builder/Waterfall] EDGAR T${currentTier} failed for ${anchorLabel}: ${err.message}`);
                }
            }

            // ── Source 3: Wikidata — companies by industry + country ──
            if (newSuppliers.length < 2) {
                try {
                    const wikidataCompanies = await getCompaniesByIndustryAndCountry(anchorCountry, hsn0, 2);
                    for (const s of wikidataCompanies) {
                        if (!visitedSet.has(s.name.toLowerCase())) {
                            newSuppliers.push(s);
                        }
                    }
                } catch (err) {
                    console.warn(`[Builder/Waterfall] Wikidata T${currentTier} failed for ${anchorCountry}: ${err.message}`);
                }
            }

            // Build nodes from collected suppliers
            for (const supplier of newSuppliers.slice(0, 3)) {
                const supplierKey = supplier.name.toLowerCase();
                if (visitedSet.has(supplierKey)) continue;
                visitedSet.add(supplierKey);

                const nodeId = `t${currentTier}_${toNodeId(supplier.name)}`;
                if ((existingGraph?.nodes || []).some(n => n.id === nodeId) || allNodes.some(n => n.id === nodeId)) continue;

                const coords = coordsFor(supplier.country || anchorCountry);
                const nodeCountry = supplier.country || anchorCountry;

                const newNode = {
                    id: nodeId,
                    label: supplier.name,
                    productName: `${hsn0} Input`,
                    sector: currentTier >= 5 ? 'Raw Materials' : 'Manufacturing',
                    tier: currentTier,
                    country: nodeCountry,
                    country_risk_score: countryRisk(nodeCountry),
                    gpr_score: Math.floor(Math.random() * 40) + 20,
                    sanctions_flag: ['CN', 'RU', 'IR', 'KP'].includes(nodeCountry),
                    data_source: supplier.source === 'sec-edgar' ? 'SEC EDGAR 10-K' :
                                 supplier.source === 'wikidata' ? 'Wikidata' : 'UN Comtrade',
                    data_source_detail: supplier.confidence === 'VERIFIED' ?
                        'Mentioned in annual SEC filing' : 'Inferred from trade flow data',
                    lat: coords.lat,
                    lng: coords.lng,
                    hsn: hsn0,
                    confidence: supplier.confidence || 'INFERRED',
                };
                
                const newEdge = {
                    id: `e_${nodeId}_${anchor.id}`,
                    source: nodeId,
                    target: anchor.id,
                    type: 'supplies',
                    hsn: hsn0,
                    confidence: supplier.confidence || 'INFERRED',
                };

                allNodes.push(newNode);
                allEdges.push(newEdge);
                nextTierAnchors.push(newNode);
            }
        }
        
        currentTierAnchors = nextTierAnchors;
        if (currentTierAnchors.length === 0) {
            console.log(`[Builder/Waterfall] Stopped expansion at Tier ${currentTier} - no anchors found.`);
            break;
        }
    }

    console.log(`[Builder/Waterfall] Structured recursive expansion generated: ${allNodes.length} deep-tier nodes, ${allEdges.length} edges.`);
    return { nodes: allNodes, edges: allEdges };
}


// SECTION 3: Main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

async function buildSupplyChainGraph(companyName, country = 'US', hsnCodes = []) {
    // Sort HSN codes for a stable cache key regardless of order returned by HSN inferrer
    const hsnString = [...hsnCodes].sort().join(',') || 'general';
    const cKey = cacheKey('graph_build_v5', companyName, hsnString);

    // Cycle prevention — tracks all company names already added to the graph
    const visitedSet = new Set([companyName.toLowerCase()]);

    const cached = await cacheGet(cKey);
    if (cached) {
        console.log(`[Graph] Cache hit for "${companyName}".`);
        return cached;
    }

    console.log(`[Graph] Building API-first supply chain for "${companyName}" [${hsnString}]...`);

    let keptHsn = [...hsnCodes];
    let prunedHsn = [];

    // Step 0: BOM Filtering (if enabled)
    // We filter the discovery-phase HSN codes to ensure downstream expansion is relevant.
    if (config.bomFilterEnabled && hsnCodes.length > 0) {
        try {
            // We need a "parent" HS code to filter against. 
            // If the root company has multiple HS codes, we pick the most frequent one as the "anchor".
            const parentAnchor = hsnCodes[0]; 
            const filterResult = await filterBOM(parentAnchor, hsnCodes);
            keptHsn = filterResult.kept;
            prunedHsn = filterResult.pruned;
        } catch (err) {
            console.warn(`[Graph] BOM Filter failed: ${err.message}. Procceding without filter.`);
        }
    }

    // Step 1: Tier 1 from real APIs (parallel)
    const [importYetiRecords, zaubaRecords] = await Promise.all([
        fetchTier1FromImportYeti(companyName),
        fetchTier1FromZauba(companyName),
    ]);
    const tier1Records = [...importYetiRecords, ...zaubaRecords];
    console.log(`[Graph] Tier 1 total: ${tier1Records.length} records.`);

    // Step 2: Tier 2 from Comtrade
    let tier2Records = [];
    if (keptHsn.length > 0) {
        tier2Records = await fetchTier2FromComtrade(country, keptHsn);
    }

    // Step 3: Build API graph skeleton
    // Always create at least a root node so the waterfall has an anchor
    const coords = coordsFor(country);
    const rootNode = {
        id: 'root', label: companyName, productName: 'End Product / Assembly',
        type: 'root', tier: 0, country,
        country_risk_score: countryRisk(country), gpr_score: 50, sanctions_flag: false,
        data_source: 'Registry', data_source_detail: `HSN codes: ${keptHsn.join(', ') || 'inferred'}`,
        lat: coords.lat, lng: coords.lng,
    };

    let apiGraph = null;
    if (tier1Records.length > 0 || tier2Records.length > 0) {
        apiGraph = recordsToGraph(companyName, country, tier1Records, tier2Records, keptHsn);
        console.log(`[Graph] API skeleton: ${apiGraph.nodes.length} nodes, ${apiGraph.edges.length} edges.`);
    } else {
        // No API data — create minimal skeleton so waterfall still has an anchor to expand
        console.warn(`[Graph] No API data — building minimal root skeleton for waterfall.`);
        apiGraph = { nodes: [rootNode], edges: [] };
    }

    // Step 4: Structured source waterfall — Tier 3-6 (Recursive Comtrade → EDGAR → Wikidata)
    let finalGraph = apiGraph;
    if (apiGraph) {
        try {
            const { nodes: wNodes, edges: wEdges } = await expandWithStructuredSources(
                companyName, country, keptHsn, apiGraph, visitedSet
            );
            if (wNodes.length > 0) {
                finalGraph = {
                    nodes: [...apiGraph.nodes, ...wNodes],
                    edges: [...apiGraph.edges, ...wEdges],
                };
            }
        } catch (err) {
            console.warn(`[Graph] Structured waterfall failed: ${err.message}`);
        }
    }

    // Step 5: Return best available result
    if (finalGraph?.nodes?.length > 0) {
        const result = { ...finalGraph, pruned: prunedHsn };
        await cacheSet(cKey, result, 43200);
        return result;
    }

    if (apiGraph?.nodes?.length > 0) {
        console.warn(`[Graph] Using API-only graph (${apiGraph.nodes.length} nodes, no Tiers 3-6).`);
        const result = { ...apiGraph, pruned: prunedHsn };
        await cacheSet(cKey, result, 21600);
        return result;
    }

    // Absolute fallback
    console.error(`[Graph] All sources failed — returning minimal root-only graph.`);
    const rootFallbackCoords = coordsFor(country);
    return {
        nodes: [{
            id: 'root', label: companyName, productName: 'Unknown', type: 'root', tier: 0, country,
            country_risk_score: 50, gpr_score: 50, sanctions_flag: false,
            data_source: 'N/A', data_source_detail: 'No data available',
            lat: rootFallbackCoords.lat, lng: rootFallbackCoords.lng,
        }],
        edges: [],
    };
}

module.exports = { buildSupplyChainGraph, extractJson };
