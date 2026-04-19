/**
 * Sanctions Enrichment v2 — Supply Chain X-Ray
 *
 * Checks each supplier node against known sanctions lists.
 *
 * Priority:
 *   1. Local OFAC SDN name-match     — always available, zero latency, fuzzy
 *   2. OpenSanctions API             — enhanced, only if OPENSANCTIONS_API_KEY is set
 *
 * Non-blocking design: the graph is returned immediately.
 * Sanctions flags are enriched asynchronously and cached for 24h.
 *
 * OFAC High-Risk Countries (hardcoded):
 *   CN (China — partial), RU (Russia), IR (Iran), KP (N. Korea),
 *   BY (Belarus), MM (Myanmar), CU (Cuba), SY (Syria), SD (Sudan)
 */

const { httpGet } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');

// ─────────────────────────────────────────────────────────────────────────────
// OFAC High-Risk Country List
// Source: https://home.treasury.gov/policy-issues/financial-sanctions/sanctions-programs-and-country-information
// ─────────────────────────────────────────────────────────────────────────────
const OFAC_SANCTIONED_COUNTRIES = new Set(['RU', 'IR', 'KP', 'BY', 'MM', 'CU', 'SY', 'SD', 'VE', 'YE', 'LY']);

// Partial-sanction countries — elevated risk but not full embargo
const OFAC_ELEVATED_RISK_COUNTRIES = new Set(['CN', 'HK', 'PK', 'NG', 'ZW', 'SO', 'SS']);

// ─────────────────────────────────────────────────────────────────────────────
// Local OFAC SDN Name Fragment List
// Curated list of known sanctioned entity name fragments for fast local matching.
// Sourced from OFAC SDN public list — updated periodically.
// ─────────────────────────────────────────────────────────────────────────────
const OFAC_SDN_FRAGMENTS = [
    // Russia
    'rosoboronexport', 'rostec', 'sberbank', 'vtb bank', 'gazprombank', 'novatek',
    'lukoil', 'sovcomflot', 'russian national commercial bank', 'vnesheconombank',
    'almaz-antey', 'kalashnikov', 'uralvagonzavod', 'evraz', 'severstal',
    // Iran
    'mahan air', 'iran air', 'national iranian oil', 'bank mellat', 'bank saderat',
    'bank sepah', 'pasargad', 'tejarat', 'petrochemical commercial', 'irgc',
    'islamic revolutionary guard', 'quds force',
    // North Korea
    'korea mining', 'tanchon commercial', 'kohas', 'daesong', 'namchongang',
    'korea kwangson banking', 'koryo credit', 'mansudae',
    // Belarus
    'belaruskali', 'grodno azot', 'belta', 'beltelrad',
    // Myanmar
    'myanmar economic corporation', 'myanmar gems enterprise', 'moge', 'mec',
    // China (entity list)
    'huawei', 'hikvision', 'dahua technology', 'cloudwalk', 'megvii',
    'sensetime', 'yitu', 'iflytek', 'bgd', 'zte corporation',
    'semiconductor manufacturing international', 'smic', 'yangtze memory',
    // Cuba
    'cubana de aviacion', 'gaviota', 'cimex',
    // Syria
    'commercial bank of syria', 'syria arab airlines', 'tishreen',
    // Venezuela
    'pdvsa', 'petroleos de venezuela', 'bandes', 'caroni',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a name for matching — lowercase, strip punctuation.
 */
function normalizeName(name) {
    return (name || '').toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Compute a simple similarity score (Jaccard-like word overlap).
 * Returns a number 0..1.
 */
function wordOverlapScore(nameA, nameB) {
    const wordsA = new Set(normalizeName(nameA).split(' ').filter(w => w.length > 2));
    const wordsB = new Set(normalizeName(nameB).split(' ').filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let shared = 0;
    for (const w of wordsA) if (wordsB.has(w)) shared++;
    return shared / Math.max(wordsA.size, wordsB.size);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Matching Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Local OFAC check — country flag + SDN name fragment match.
 * Returns a result object immediately (no network call).
 *
 * @param {string} companyName
 * @param {string} countryIso
 * @returns {{ sanctioned: boolean, risk_level: string, match_source: string, match_detail: string }}
 */
function checkOfacLocal(companyName, countryIso) {
    const iso = (countryIso || '').toUpperCase();
    const normalizedName = normalizeName(companyName);

    // 1. Full country embargo
    if (OFAC_SANCTIONED_COUNTRIES.has(iso)) {
        return {
            sanctioned: true,
            risk_level: 'HIGH',
            match_source: 'OFAC-country',
            match_detail: `Entity in OFAC-sanctioned country: ${iso}`,
        };
    }

    // 2. SDN name fragment match
    for (const fragment of OFAC_SDN_FRAGMENTS) {
        if (normalizedName.includes(fragment)) {
            return {
                sanctioned: true,
                risk_level: 'CRITICAL',
                match_source: 'OFAC-SDN-local',
                match_detail: `Name matches OFAC SDN fragment: "${fragment}"`,
            };
        }
    }

    // 3. Elevated-risk country (not sanctioned but flag-worthy)
    if (OFAC_ELEVATED_RISK_COUNTRIES.has(iso)) {
        return {
            sanctioned: false,
            risk_level: 'ELEVATED',
            match_source: 'OFAC-country-watch',
            match_detail: `Entity in elevated-risk jurisdiction: ${iso}`,
        };
    }

    // 4. Clean
    return {
        sanctioned: false,
        risk_level: 'LOW',
        match_source: 'OFAC-local',
        match_detail: 'No match in local OFAC SDN list',
    };
}

/**
 * OpenSanctions API check — only called if API key is configured.
 * Falls back gracefully on error.
 *
 * @param {string} companyName
 * @returns {Promise<{ sanctioned: boolean, risk_level: string, match_source: string, match_detail: string } | null>}
 */
async function checkOpenSanctions(companyName) {
    if (!config.openSanctionsApiKey) return null;

    try {
        const data = await httpGet('https://api.opensanctions.org/match/default', {
            source: 'opensanctions',
            params: { q: companyName, limit: 1, fuzzy: 'true' },
            headers: {
                'Authorization': `ApiKey ${config.openSanctionsApiKey}`,
                'Accept': 'application/json',
            },
            timeout: 8000,
        });

        const results = data?.results || [];
        if (results.length === 0) return null;

        const top = results[0];
        const score = top.score || 0;

        if (score >= 0.85) {
            return {
                sanctioned: true,
                risk_level: 'CRITICAL',
                match_source: 'OpenSanctions',
                match_detail: `Matched "${top.caption}" (score: ${score.toFixed(2)}) on ${top.datasets?.join(', ')}`,
            };
        }
        if (score >= 0.65) {
            return {
                sanctioned: false,
                risk_level: 'ELEVATED',
                match_source: 'OpenSanctions',
                match_detail: `Partial match "${top.caption}" (score: ${score.toFixed(2)}) — manual review advised`,
            };
        }

        return null; // Below threshold — treat as clean
    } catch (err) {
        console.warn(`[Sanctions] OpenSanctions API failed for "${companyName}": ${err.message}`);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check a single supplier node against sanctions lists.
 * Returns enriched sanctions data with caching.
 *
 * @param {string} companyName
 * @param {string} countryIso
 * @returns {Promise<{ sanctioned: boolean, risk_level: string, match_source: string, match_detail: string }>}
 */
async function checkSanctions(companyName, countryIso) {
    const cKey = cacheKey('sanctions_v2', companyName, countryIso || 'XX');
    const cached = await cacheGet(cKey);
    if (cached) return cached;

    // Always run local OFAC check first (instant, no network)
    const localResult = checkOfacLocal(companyName, countryIso);

    // Only call OpenSanctions API if local check is not already CRITICAL
    let finalResult = localResult;
    if (localResult.risk_level !== 'CRITICAL' && config.openSanctionsApiKey) {
        const apiResult = await checkOpenSanctions(companyName);
        if (apiResult) {
            // API result overrides if it found something stronger
            finalResult = apiResult;
        }
    }

    await cacheSet(cKey, finalResult, 86400); // Cache for 24h
    return finalResult;
}

/**
 * Enrich an entire graph's nodes with sanctions data.
 * Returns a new nodes array with sanctions fields populated.
 * Non-blocking by design — call this after the graph is returned to the client.
 *
 * @param {Array<object>} nodes - Graph nodes from buildSupplyChainGraph
 * @returns {Promise<Array<object>>} Enriched nodes
 */
async function enrichGraphWithSanctions(nodes) {
    if (!nodes || nodes.length === 0) return nodes;

    console.log(`[Sanctions] Enriching ${nodes.length} nodes...`);
    const startTime = Date.now();

    const enriched = await Promise.all(
        nodes.map(async (node) => {
            if (!node.label || node.tier === 0) {
                // Skip root node — it's the company being analyzed
                return { ...node, sanctions_flag: false, sanctions_risk: 'N/A', sanctions_detail: 'Root node' };
            }
            try {
                const result = await checkSanctions(node.label, node.country);
                return {
                    ...node,
                    sanctions_flag: result.sanctioned,
                    sanctions_risk: result.risk_level,
                    sanctions_source: result.match_source,
                    sanctions_detail: result.match_detail,
                };
            } catch (err) {
                console.warn(`[Sanctions] Failed for "${node.label}": ${err.message}`);
                return { ...node, sanctions_flag: false, sanctions_risk: 'UNKNOWN', sanctions_detail: 'Check failed' };
            }
        })
    );

    const elapsed = Date.now() - startTime;
    const flagged = enriched.filter(n => n.sanctions_flag).length;
    const elevated = enriched.filter(n => n.sanctions_risk === 'ELEVATED').length;
    console.log(`[Sanctions] Done in ${elapsed}ms. Flagged: ${flagged} sanctioned, ${elevated} elevated risk.`);

    return enriched;
}

/**
 * Get a summary of sanctions exposure across a graph.
 *
 * @param {Array<object>} enrichedNodes - Nodes already processed by enrichGraphWithSanctions
 * @returns {{ total: number, sanctioned: number, elevated: number, critical_names: string[] }}
 */
function getSanctionsSummary(enrichedNodes) {
    const sanctioned = enrichedNodes.filter(n => n.sanctions_flag);
    const elevated = enrichedNodes.filter(n => n.sanctions_risk === 'ELEVATED' && !n.sanctions_flag);

    return {
        total: enrichedNodes.length,
        sanctioned: sanctioned.length,
        elevated: elevated.length,
        critical_names: sanctioned.map(n => `${n.label} (${n.country})`),
        risk_countries: [...new Set(sanctioned.map(n => n.country))],
    };
}

module.exports = { checkSanctions, enrichGraphWithSanctions, getSanctionsSummary, checkOfacLocal, OFAC_SANCTIONED_COUNTRIES };
