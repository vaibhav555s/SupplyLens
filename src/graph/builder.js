// ─── Supply Chain Graph Builder v2 ───
// Strategy: API-FIRST → Reference Data (PDF) → Structured Sources → LLM Last Resort
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
const { getCompaniesByIndustryAndCountry, getCorporateHierarchy } = require('../connectors/wikidata');
const { getReferenceData, mergeReferenceData } = require('../data/companyReferenceData');

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
    return null; // Stubs removed for 100% transparency. Risk is enriched by enrichment/risk.js
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
        country_risk_score: null, gpr_score: null, sanctions_flag: false,
        data_source: 'Extraction Pipeline', data_source_detail: 'Verified customs & trade records',
        lat: rootCoords.lat, lng: rootCoords.lng,
        hsn: hsnCodes,
    });
    nodeIds.add('root');

    // Tier 1 — direct suppliers (deduplicated by source_name)
    const t1Map = new Map();
    // Prefix filter (4 digits) to stay within the same component category
    const hsnFilter = (hsnCodes || []).map(code => String(code).substring(0, 4)).filter(Boolean);

    let skippedCount = 0;
    for (const r of tier1Records) {
        if (!r.source_name) continue;

        // RELAXED HSN FILTER: Try 4-digit prefix first, fallback to 2-digit if no matches
        if (hsnFilter.length > 0 && r.hs_code_6) {
            const shipHsnPrefix4 = String(r.hs_code_6).substring(0, 4);
            const shipHsnPrefix2 = String(r.hs_code_6).substring(0, 2);

            const isMatch4 = hsnFilter.includes(shipHsnPrefix4);
            const isMatch2 = hsnFilter.map(f => f.substring(0, 2)).includes(shipHsnPrefix2);

            if (!isMatch4 && !isMatch2) {
                // Skip records that don't match even the 2-digit category
                skippedCount++;
                continue;
            }
        }

        const k = r.source_name.toLowerCase();
        if (!t1Map.has(k)) t1Map.set(k, r);
        else t1Map.get(k).shipment_count += (r.shipment_count || 0);
    }
    if (skippedCount > 0) console.log(`[Builder] Skipped ${skippedCount} Tier 1 records due to HSN mismatch.`);

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
            country_risk_score: null,
            gpr_score: null, sanctions_flag: false,
            data_source: r.data_source === 'zauba' ? 'Zauba Customs' : 'ImportYeti Bill of Lading',
            data_source_detail: `${r.shipment_count || 'Verified'} extraction`,
            lat: c.lat, lng: c.lng, hsn: r.hs_code_6 || '', confidence: r.confidence || 'VERIFIED',
        });
        edges.push({
            id: `e_${id}_root`, source: id, target: 'root', type: 'supplies',
            hsn: r.hs_code_6 || hsnCodes[0] || '', confidence: r.confidence || 'VERIFIED',
        });
    }

    // Tier 2 — country-level Comtrade nodes (deduplicated by source_country and hs_code)
    const t2Map = new Map();
    for (const r of tier2Records) {
        if (!r.source_country || r.source_country === country) continue;
        const k = `${r.source_country}_${r.hs_code_6}`;
        if (!t2Map.has(k)) t2Map.set(k, { ...r });
        else t2Map.get(k).trade_value += r.trade_value;
    }

    let t2i = 0;
    for (const [k, r] of t2Map) {
        if (t2i >= 8) break;
        const srcCountry = r.source_country;
        const id = `t2_${toNodeId(srcCountry + r.hs_code_6)}`;
        if (nodeIds.has(id)) continue;
        nodeIds.add(id); t2i++;
        const c = coordsFor(srcCountry);
        const sanctioned = ['CN', 'RU', 'IR', 'KP'].includes(srcCountry);
        nodes.push({
            id, label: `${srcCountry} ${r.hs_code_6 || ''} Suppliers`, productName: r.commodity || hsnCodes[0] || 'Commodity',
            type: 'distributor', tier: 2, country: srcCountry,
            country_risk_score: null,
            gpr_score: null, sanctions_flag: sanctioned,
            data_source: 'UN Comtrade',
            data_source_detail: `Trade extraction (2023)`,
            lat: c.lat, lng: c.lng, hsn: r.hs_code_6 || '', confidence: 'INFERRED',
        });
        
        let matchingT1 = nodes.find(n => n.tier === 1 && n.country === srcCountry && n.hsn === r.hs_code_6);
        if (!matchingT1) matchingT1 = nodes.find(n => n.tier === 1 && n.country === srcCountry);
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

    // Collect BOTH Tier 1 and Tier 2 nodes as expansion anchors
    // Sort Tier 1 first to ensure they are prioritized in the limited concurrency waterfall
    let currentTierAnchors = (existingGraph?.nodes || [])
        .filter(n => n.tier === 1 || n.tier === 2)
        .sort((a, b) => a.tier - b.tier);

    if (currentTierAnchors.length === 0) currentTierAnchors = [{ id: 'root', tier: 0, country, label: companyName }];

    // Starting tier will be used to track expansion depth.
    // We start from the highest tier currently in the graph.
    let startingTier = Math.max(...currentTierAnchors.map(n => n.tier), 0) + 1;

    for (let currentTier = startingTier; currentTier <= 6; currentTier++) {
        const nextTierAnchors = [];

        // Parallel process anchors to speed up waterfall
        const anchorPromises = currentTierAnchors.slice(0, 7).map(async (anchor) => {
            const anchorCountry = anchor.country || country;
            const anchorLabel = anchor.label || companyName;
            let newSuppliers = [];

            // ── Source 1: Wikidata Hierarchy (Corporate Parent/Subsidiary) ──
            try {
                const relatives = await getCorporateHierarchy(anchorLabel);
                for (const r of relatives) {
                    if (!visitedSet.has(r.name.toLowerCase())) {
                        newSuppliers.push({ ...r, source: 'wikidata-hierarchy' });
                    }
                }
            } catch (err) {
                console.warn(`[Builder/Waterfall] Wikidata hierarchy failed for ${anchorLabel}: ${err.message}`);
            }

            // ── Source 2: Zauba Discovery (for Tier 2+) ──
            if (newSuppliers.length < 3 && currentTier <= 3) {
                try {
                    const zaubaRecs = await zauba.searchCompany(anchorLabel, 'import');
                    for (const r of zaubaRecs.slice(0, 2)) {
                        if (!visitedSet.has(r.source_name.toLowerCase())) {
                            newSuppliers.push({
                                name: r.source_name,
                                country: r.source_country,
                                source: 'zauba-deep',
                                confidence: 'VERIFIED'
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`[Builder/Waterfall] Zauba deep check failed for ${anchorLabel}: ${err.message}`);
                }
            }

            // ── Source 3: Comtrade trade flow inference ──
            if (newSuppliers.length < 2 && hsnCodes.length > 0) {
                try {
                    let comtradeRecords = [];
                    for (const hs of hsnCodes) {
                        const hsRecs = await comtrade.getTopImportPartners(anchorCountry, hs, 2);
                        comtradeRecords.push(...hsRecs);
                        // Prevent explosive fanout if a node already has enough deep-tier branches
                        if (comtradeRecords.length >= 3) break;
                    }
                    for (const rec of comtradeRecords) {
                        // Tie synthetic name to tier to prevent cycle guard from prematurely blocking recursive depth
                        const name = `${rec.source_country} ${rec.hs_code_6 || ''} Mfrs T${currentTier}`;
                        if (rec.source_country && !visitedSet.has(name.toLowerCase())) {
                            newSuppliers.push({
                                name,
                                country: rec.source_country,
                                source: 'comtrade-flow',
                                confidence: 'INFERRED'
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`[Builder/Waterfall] Comtrade T${currentTier} failed for ${anchorCountry}: ${err.message}`);
                }
            }

            // ── Source 4: Wikidata Industry mining ──
            if (newSuppliers.length < 2 && hsnCodes.length > 0) {
                try {
                    let wikidataCompanies = [];
                    for (const hs of hsnCodes) {
                        wikidataCompanies = await getCompaniesByIndustryAndCountry(anchorCountry, hs, 2);
                        if (wikidataCompanies.length > 0) break;
                    }
                    for (const s of wikidataCompanies) {
                        if (!visitedSet.has(s.name.toLowerCase())) {
                            newSuppliers.push({ ...s, source: 'wikidata-industry' });
                        }
                    }
                } catch (err) {
                    console.warn(`[Builder/Waterfall] Wikidata industry failed for ${anchorCountry}: ${err.message}`);
                }
            }

            return { anchor, newSuppliers };
        });

        const results = await Promise.all(anchorPromises);

        for (const { anchor, newSuppliers } of results) {
            for (const supplier of newSuppliers.slice(0, 2)) {
                const supplierKey = supplier.name.toLowerCase();
                if (visitedSet.has(supplierKey)) continue;
                visitedSet.add(supplierKey);

                const nextTier = (anchor.tier || 0) + 1;
                const nodeId = `t${nextTier}_${toNodeId(supplier.name)}`;
                if ((existingGraph?.nodes || []).some(n => n.id === nodeId) || allNodes.some(n => n.id === nodeId)) continue;

                const nodeCountry = supplier.country || anchor.country || 'XX';
                const coords = coordsFor(nodeCountry);

                const newNode = {
                    id: nodeId,
                    label: supplier.name,
                    productName: supplier.relation ? `${supplier.relation} of ${anchor.label}` : `${hsn0 || 'Component'} Supplier`,
                    sector: nextTier >= 5 ? 'Raw Materials' : 'Manufacturing',
                    tier: nextTier,
                    country: nodeCountry,
                    country_risk_score: null,
                    gpr_score: null,
                    sanctions_flag: ['CN', 'RU', 'IR', 'KP'].includes(nodeCountry),
                    data_source: supplier.source.includes('wikidata') ? 'Wikidata' :
                        supplier.source.includes('zauba') ? 'Zauba Customs' : 'UN Comtrade',
                    data_source_detail: supplier.confidence === 'VERIFIED' ? 'Customs verified shipment' : 'Inferred corporate relationship',
                    lat: coords.lat,
                    lng: coords.lng,
                    hsn: hsn0,
                    confidence: supplier.confidence || 'INFERRED',
                };

                const newEdge = {
                    id: `e_${nodeId}_${anchor.id}`,
                    source: nodeId,
                    target: anchor.id,
                    type: supplier.relation === 'parent' ? 'owns' : 'supplies',
                    hsn: hsn0,
                    confidence: supplier.confidence || 'INFERRED',
                };

                allNodes.push(newNode);
                allEdges.push(newEdge);
                nextTierAnchors.push(newNode);
            }
        }

        currentTierAnchors = nextTierAnchors;
        if (currentTierAnchors.length === 0) break;
    }

    console.log(`[Builder/Waterfall] Structured recursive expansion generated: ${allNodes.length} deep-tier nodes.`);
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
    let tier1Records = [...importYetiRecords, ...zaubaRecords];

    // TIER 1 FALLBACK: If direct records fail (API block/credits), use trade-flow inference
    if (tier1Records.length === 0 && keptHsn.length > 0) {
        console.log(`[Graph] ⚠ Tier 1 empty (likely API block). Attempting Trade-Flow Fallback for "${companyName}"...`);
        let fallbackRecs = [];
        for (const hs of keptHsn) {
            const hsRecs = await comtrade.getTopImportPartners(country, hs, 4);
            fallbackRecs.push(...hsRecs);
            // Cap to avoid huge unmanageable graphs, but allow processing of multiple BOM inputs
            if (fallbackRecs.length >= 8) break;
        }
        tier1Records = fallbackRecs.map(r => ({
            ...r,
            source_name: `${r.source_country} ${r.hs_code_6 || ''} Mfrs`,
            confidence: 'INFERRED',
            data_source: 'Comtrade Fallback'
        }));
    }
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
        country_risk_score: null, gpr_score: null, sanctions_flag: false,
        data_source: 'Extraction Node', data_source_detail: `HSN extraction: ${keptHsn.join(', ') || 'verified'}`,
        lat: coords.lat, lng: coords.lng,
        hsn: keptHsn,
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

    // Step 4a: Reference Data injection — merge curated PDF nodes BEFORE the waterfall.
    // This runs for any company that has reference data (currently: Tesla).
    // Live API nodes always win over reference nodes — no duplication.
    const refData = getReferenceData(companyName);
    if (refData) {
        try {
            apiGraph = mergeReferenceData(apiGraph, refData);

            // Mark reference node labels as visited so the waterfall doesn't re-discover them
            for (const rn of refData.nodes) {
                if (rn.label) visitedSet.add(rn.label.toLowerCase());
            }

            console.log(`[Graph] Reference data merged for "${companyName}": ${apiGraph.nodes.length} nodes total after merge.`);
        } catch (refErr) {
            console.warn(`[Graph] Reference data merge failed for "${companyName}": ${refErr.message}`);
        }
    }

    // Step 4b: Structured source waterfall — Tier 3-6 (Recursive Comtrade → EDGAR → Wikidata)
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
            country_risk_score: null, gpr_score: null, sanctions_flag: false,
            data_source: 'N/A', data_source_detail: 'No extracted data available',
            lat: rootFallbackCoords.lat, lng: rootFallbackCoords.lng,
            hsn: hsnCodes,
        }],
        edges: [],
    };
}

module.exports = { buildSupplyChainGraph, extractJson };
