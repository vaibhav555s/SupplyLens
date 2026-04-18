// ─── Supply Chain Graph Builder ───
// Strategy: API-FIRST → LLM Fallback
//
// 1. Try real connectors (ImportYeti → Zauba → Comtrade) for Tier 1+2.
// 2. Feed those real nodes into the LLM to reason out Tiers 3-6.
// 3. If ALL APIs fail, fall all the way back to pure LLM generation.

const { httpPost } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');
const { importyeti, zauba, comtrade } = require('../connectors');
const { jsonrepair } = require('jsonrepair');

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
// SECTION 2: LLM enrichment — adds ONLY Tier 3-6 nodes, then merges
// ─────────────────────────────────────────────────────────────────────────────

async function expandGraphWithLLM(companyName, country, hsnCodes, existingGraph) {
    const hsnString = hsnCodes.slice(0, 5).join(',') || 'general components';
    const hasRealData = existingGraph?.edges?.length > 0;
    const hsn0 = hsnCodes[0] || '';

    const systemMsg = 'You are a supply chain expert. Output ONLY a single compact valid JSON object. No markdown, no prose, no explanation.';

    let userMsg;
    if (hasRealData) {
        const t1Nodes = existingGraph.nodes.filter(n => n.tier === 1);
        const t2Nodes = existingGraph.nodes.filter(n => n.tier === 2);

        const missingT1 = t1Nodes.length === 0;
        const missingT2 = t2Nodes.length === 0;

        let promptTiers = [];
        if (missingT1) promptTiers.push('- Tier 1: 3 direct suppliers (parent: root)');
        if (missingT2) promptTiers.push('- Tier 2: 3 regional distributors (parent: a Tier 1 id)');

        const t2Ids = t2Nodes.map(n => n.id).join(', ');
        const t2Parent = missingT2 ? 'a Tier 2 id' : (t2Ids ? `one of: ${t2Ids}` : 'root');

        promptTiers.push(`- Tier 3: 4 component producers (parent: ${t2Parent})`);
        promptTiers.push('- Tier 4: 3 raw material producers (parent: a Tier 3 id)');
        promptTiers.push('- Tier 5: 2 miners (parent: a Tier 4 id)');
        promptTiers.push('- Tier 6: 2 terminal inputs (parent: a Tier 5 id)');

        const t1ParentList = t1Nodes.map(n => n.id).join(',');
        const rootAvail = 'root' + (t1ParentList ? `, Tier 1: ${t1ParentList}` : '') + (t2Ids ? `, Tier 2: ${t2Ids}` : '');

        userMsg = `Supply chain for "${companyName}" (${country}), HSN: ${hsnString}.
Available parent IDs: ${rootAvail}.
Create ONLY new nodes (use real company names).
Nodes:
${promptTiers.join('\n')}
Required fields per node: id,label,productName,sector,tier(integer!),country(ISO-2),country_risk_score(float),gpr_score(float),sanctions_flag(bool),data_source,data_source_detail,lat(float),lng(float).
Required fields per edge: id,source,target,type,hsn,confidence.
Return ONLY JSON: {"nodes":[...],"edges":[...]}`;
    } else {
        // No API data — generate full 6-tier graph from scratch
        userMsg = `Generate a realistic 6-tier supply chain for "${companyName}" (${country}) HSN: ${hsnString}.
Tier counts: 0=1(id:"root"), 1=3, 2=3, 3=2, 4=2, 5=2, 6=2. Total: 15 nodes.
Edge: higher-tier source → lower-tier target. Tier 1 edges target "root".
Node fields: id,label,productName,sector,tier,country(ISO-2),country_risk_score(1-100),gpr_score(1-100),sanctions_flag(bool),data_source("LLM-inferred"),data_source_detail,lat,lng.
Edge fields: id,source,target,type("supplies"),hsn,confidence("INFERRED").
Return ONLY JSON: {"nodes":[...],"edges":[]}`;
    }

    const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.2-1b-preview'];
    let lastError;

    for (const model of models) {
        try {
            console.log(`[LLM] Requesting deep tiers from "${model}"...`);
            const response = await httpPost(GROQ_API_URL, {
                model,
                max_tokens: hasRealData ? 3500 : 5000,
                temperature: 0.3,
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: userMsg },
                ],
            }, {
                headers: { 'Authorization': `Bearer ${config.groqApiKey}` },
                timeout: 60000,
            });

            const text = response?.choices?.[0]?.message?.content || '';
            if (!text) throw new Error('Empty response from LLM');

            const parsed = extractJson(text);
            if (!parsed) {
                console.error(`[LLM Debug] No JSON from ${model}. Snippet: ${text.slice(0, 300)}`);
                throw new Error('No valid JSON in LLM response');
            }
            if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
                console.error(`[LLM Debug] Malformed graph structure. Parsed keys: ${Object.keys(parsed)}`);
                throw new Error('LLM returned malformed graph structure');
            }

            // --- HELPER TO ENFORCE STRICT TIER TOPOLOGY ---
            const enforceStrictTopology = (allNodes, allEdges) => {
                let cleanedEdges = [];
                const tierMap = {};
                for (let i = 0; i <= 6; i++) {
                    tierMap[i] = allNodes.filter(n => n.tier === i);
                }

                // First pass: keep only edges that connect to the expected strict lower-tier parent
                for (const edge of allEdges) {
                    const src = allNodes.find(n => n.id === edge.source);
                    const tgt = allNodes.find(n => n.id === edge.target);
                    if (!src || !tgt || src.tier <= tgt.tier) continue;

                    // Does it skip intermediate populated tiers?
                    let hasIntermediate = false;
                    for (let t = src.tier - 1; t > tgt.tier; t--) {
                        if (tierMap[t].length > 0) {
                            hasIntermediate = true;
                            break;
                        }
                    }
                    if (!hasIntermediate) {
                        cleanedEdges.push(edge);
                    }
                }

                // Second pass: ensure every node > 0 has at least one edge downstream
                for (let i = 1; i <= 6; i++) {
                    const nodesInTier = tierMap[i];
                    if (!nodesInTier || nodesInTier.length === 0) continue;

                    // Find nearest populated lower tier
                    let lowerTierNodes = null;
                    for (let lower = i - 1; lower >= 0; lower--) {
                        if (tierMap[lower] && tierMap[lower].length > 0) {
                            lowerTierNodes = tierMap[lower];
                            break;
                        }
                    }

                    if (lowerTierNodes) {
                        for (const node of nodesInTier) {
                            const hasValidEdge = cleanedEdges.some(e => e.source === node.id && lowerTierNodes.some(p => p.id === e.target));
                            if (!hasValidEdge) {
                                const randomParent = lowerTierNodes[Math.floor(Math.random() * lowerTierNodes.length)];
                                cleanedEdges.push({
                                    id: `e_enforce_${node.id}_${randomParent.id}`,
                                    source: node.id,
                                    target: randomParent.id,
                                    type: 'supplies',
                                    hsn: hsn0,
                                    confidence: 'INFERRED'
                                });
                            }
                        }
                    }
                }
                return cleanedEdges;
            };

            if (hasRealData) {
                // MERGE: add new LLM deep-tier nodes to existing API skeleton
                const existingIds = new Set(existingGraph.nodes.map(n => n.id));
                const newNodes = parsed.nodes.map(n => ({
                    ...n,
                    tier: parseInt(n.tier, 10) || 1, // Parse tier to integer
                    country_risk_score: parseFloat(n.country_risk_score) || 50,
                    gpr_score: parseFloat(n.gpr_score) || 50,
                    lat: parseFloat(n.lat) || 0,
                    lng: parseFloat(n.lng) || 0,
                    hsn: n.hsn || hsn0,
                    productName: n.productName || 'Component',
                    sector: n.sector || 'Manufacturing',
                    data_source_detail: n.data_source_detail || 'Inferred via supply chain dynamics'
                })).filter(n => !existingIds.has(n.id) && !isNaN(n.tier));

                const mergedNodes = [...existingGraph.nodes, ...newNodes];
                let mergedEdges = [...existingGraph.edges, ...parsed.edges];

                mergedEdges = enforceStrictTopology(mergedNodes, mergedEdges);

                console.log(`[LLM] Merged: ${mergedNodes.length} total nodes (${newNodes.length} new), ${mergedEdges.length} edges.`);
                return { nodes: mergedNodes, edges: mergedEdges };
            } else {
                // Full LLM graph — normalize fields and root ID
                const parsedNodes = parsed.nodes.map(n => ({
                    ...n,
                    tier: parseInt(n.tier, 10) || 1,
                    country_risk_score: parseFloat(n.country_risk_score) || 50,
                    gpr_score: parseFloat(n.gpr_score) || 50,
                    lat: parseFloat(n.lat) || 0,
                    lng: parseFloat(n.lng) || 0,
                    hsn: n.hsn || hsn0,
                    productName: n.productName || (n.tier === 0 ? companyName : 'Component'),
                    sector: n.sector || 'Manufacturing',
                    data_source_detail: n.data_source_detail || 'Inferred via deep-tier analysis'
                }));
                const rootNode = parsedNodes.find(n => n.tier === 0);
                if (rootNode && rootNode.id !== 'root') {
                    const oldId = rootNode.id;
                    rootNode.id = 'root';
                    parsed.edges.forEach(e => {
                        if (e.source === oldId) e.source = 'root';
                        if (e.target === oldId) e.target = 'root';
                    });
                }
                parsed.nodes = parsedNodes;
                parsed.edges = enforceStrictTopology(parsed.nodes, parsed.edges);

                console.log(`[LLM] Full graph: ${parsed.nodes.length} nodes, ${parsed.edges.length} edges.`);
                return parsed;
            }
        } catch (err) {
            lastError = err;
            console.warn(`[LLM] Model "${model}" failed: ${err.message}. Trying next...`);
        }
    }

    throw lastError || new Error('All LLM models failed');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

async function buildSupplyChainGraph(companyName, country = 'US', hsnCodes = []) {
    // Sort HSN codes for a stable cache key regardless of order returned by HSN inferrer
    const hsnString = [...hsnCodes].sort().join(',') || 'general';
    const cKey = cacheKey('graph_build_v4', companyName, hsnString);

    const cached = await cacheGet(cKey);
    if (cached) {
        console.log(`[Graph] Cache hit for "${companyName}".`);
        return cached;
    }

    console.log(`[Graph] Building API-first supply chain for "${companyName}" [${hsnString}]...`);

    // Step 1: Tier 1 from real APIs (parallel)
    const [importYetiRecords, zaubaRecords] = await Promise.all([
        fetchTier1FromImportYeti(companyName),
        fetchTier1FromZauba(companyName),
    ]);
    const tier1Records = [...importYetiRecords, ...zaubaRecords];
    console.log(`[Graph] Tier 1 total: ${tier1Records.length} records.`);

    // Step 2: Tier 2 from Comtrade
    let tier2Records = [];
    if (hsnCodes.length > 0) {
        tier2Records = await fetchTier2FromComtrade(country, hsnCodes);
    }

    // Step 3: Build API graph skeleton
    let apiGraph = null;
    if (tier1Records.length > 0 || tier2Records.length > 0) {
        apiGraph = recordsToGraph(companyName, country, tier1Records, tier2Records, hsnCodes);
        console.log(`[Graph] API skeleton: ${apiGraph.nodes.length} nodes, ${apiGraph.edges.length} edges.`);
    } else {
        console.warn(`[Graph] No API data — will use pure LLM generation.`);
    }

    // Step 4: LLM enrichment (adds Tiers 3-6 or generates full graph)
    let finalGraph = null;
    if (config.groqApiKey) {
        try {
            finalGraph = await expandGraphWithLLM(companyName, country, hsnCodes, apiGraph);
        } catch (llmErr) {
            console.error(`[Graph] LLM enrichment failed: ${llmErr.message}`);
        }
    }

    // Step 5: Return best available result
    if (finalGraph?.nodes?.length > 0) {
        await cacheSet(cKey, finalGraph, 43200);
        return finalGraph;
    }

    if (apiGraph?.nodes?.length > 0) {
        console.warn(`[Graph] Using API-only graph (${apiGraph.nodes.length} nodes, no Tiers 3-6).`);
        await cacheSet(cKey, apiGraph, 21600);
        return apiGraph;
    }

    // Absolute fallback
    console.error(`[Graph] All sources failed — returning minimal root-only graph.`);
    const coords = coordsFor(country);
    return {
        nodes: [{
            id: 'root', label: companyName, productName: 'Unknown', type: 'root', tier: 0, country,
            country_risk_score: 50, gpr_score: 50, sanctions_flag: false,
            data_source: 'N/A', data_source_detail: 'No data available',
            lat: coords.lat, lng: coords.lng,
        }],
        edges: [],
    };
}

module.exports = { expandGraphWithLLM, buildSupplyChainGraph, extractJson };
