/**
 * Risk Enrichment v2 — Supply Chain X-Ray
 *
 * Replaces the random countryRisk() stub in builder.js with real, sourced data.
 *
 * Data Sources (priority order):
 *   1. World Bank WGI API   — Political Stability, Rule of Law, Gov. Effectiveness
 *                             Free, no key. refreshed annually.
 *                             https://api.worldbank.org/v2/country/{iso}/indicator/{ind}
 *
 *   2. GPR Static Table     — Geopolitical Risk Index (Caldara & Iacoviello 2024)
 *                             Embedded as a curated country lookup.
 *                             Original: https://www.matteoiacoviello.com/gpr.htm
 *
 *   3. Hardcoded Fallback   — Deterministic scores for countries not in WB API.
 *
 * Output: country_risk_score (0-100, higher = riskier) + gpr_score (0-100)
 *
 * Caching: World Bank data cached 30 days (rarely changes).
 */

const { httpGet } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');

// ─────────────────────────────────────────────────────────────────────────────
// GPR Index — Geopolitical Risk Scores (Caldara & Iacoviello, 2024 avg)
// Normalized to 0-100. Source: https://www.matteoiacoviello.com/gpr.htm
// ─────────────────────────────────────────────────────────────────────────────
const GPR_SCORES = {
    // Very High GPR (conflict zones / active geopolitical tension)
    RU: 94, UA: 96, IR: 91, KP: 88, SY: 95, YE: 97, AF: 98, SD: 89, LY: 88, MM: 85,
    // High GPR
    CN: 68, PK: 72, IQ: 82, EG: 65, NG: 74, VE: 70, BY: 76, CU: 62, SS: 90, SO: 91,
    // Elevated GPR
    IN: 54, TH: 48, PH: 52, VN: 42, ID: 40, MX: 58, TR: 61, BR: 44, ZA: 55, KZ: 50,
    // Low GPR (stable)
    US: 35, DE: 22, JP: 28, KR: 38, TW: 45, GB: 25, FR: 24, IT: 20, CA: 18, AU: 15,
    NL: 15, SG: 16, HK: 32, SE: 12, NO: 11, CH: 13, MX: 58, MY: 38, TH: 48, PL: 26,
    HU: 30, CZ: 22, AT: 14, BE: 18, ES: 20, PT: 14, FI: 14, DK: 13, NZ: 12,
};

// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded Fallback Risk Scores
// Used when World Bank API is unavailable or country not listed.
// Scale: 0-100, higher = riskier.
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_RISK = {
    // Sanctioned / conflict zones
    RU: 88, IR: 91, KP: 95, BY: 82, SY: 93, YE: 95, AF: 96, SD: 87, MM: 80, CU: 72, VE: 68,
    // High-risk emerging markets
    NG: 70, PK: 68, ZW: 74, LY: 82, SS: 88, SO: 92, IQ: 78, VN: 44, PH: 48, ID: 40,
    // Moderate risk
    CN: 62, IN: 45, MX: 50, TH: 42, MY: 38, TR: 55, BR: 42, ZA: 52, EG: 58, UA: 78,
    // Low risk — developed economies
    US: 18, DE: 14, JP: 20, KR: 28, TW: 38, GB: 16, FR: 18, IT: 22, CA: 12, AU: 10,
    NL: 14, SG: 12, HK: 30, SE: 10, NO: 10, CH: 10, AT: 14, BE: 16, ES: 20, PL: 24,
    HU: 28, CZ: 20, FI: 10, DK: 10,
};

// ─────────────────────────────────────────────────────────────────────────────
// World Bank Indicator IDs (WGI — Worldwide Governance Indicators)
// ─────────────────────────────────────────────────────────────────────────────
const WB_INDICATORS = {
    politicalStability: 'PV.EST',  // Political Stability & Absence of Violence
    ruleOfLaw: 'RL.EST',           // Rule of Law
    corruption: 'CC.EST',           // Control of Corruption
    govEffectiveness: 'GE.EST',    // Government Effectiveness
};

const WB_API_BASE = 'https://api.worldbank.org/v2/country';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert World Bank WGI estimate (-2.5 to +2.5) → risk score (0-100).
 * Higher score = higher RISK (inverted from WB scale where higher = better governance).
 */
function wgiToRisk(estimate) {
    if (estimate === null || estimate === undefined || isNaN(estimate)) return null;
    // WB range: -2.5 (worst) to +2.5 (best)
    // Risk: 2.5 → 0,  0 → 50,  -2.5 → 100
    const clamped = Math.max(-2.5, Math.min(2.5, parseFloat(estimate)));
    return Math.round(((2.5 - clamped) / 5.0) * 100);
}

/**
 * Fetch a single World Bank indicator for a country (most recent value).
 *
 * @param {string} isoCode  ISO-2 country code
 * @param {string} indicator  WB indicator ID (e.g. "PV.EST")
 * @returns {Promise<number|null>} Raw WGI estimate or null
 */
async function fetchWBIndicator(isoCode, indicator) {
    const url = `${WB_API_BASE}/${isoCode}/indicator/${indicator}`;
    try {
        const data = await httpGet(url, {
            source: 'worldbank',
            params: { format: 'json', mrv: 1, per_page: 1 },
            timeout: 8000,
        });

        // WB response is an array: [metadata, [data_rows]]
        if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) return null;
        const rows = data[1];
        if (rows.length === 0) return null;

        const value = rows[0]?.value;
        return value !== null ? parseFloat(value) : null;
    } catch (err) {
        // Don't log every miss — WB API is occasionally unavailable
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Risk Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all 4 WGI indicators for a country and aggregate them into a composite risk score.
 * Returns null if the API is unavailable.
 *
 * @param {string} isoCode
 * @returns {Promise<{ wb_risk: number, indicators: object } | null>}
 */
async function fetchWorldBankRisk(isoCode) {
    const [psRaw, rlRaw, ccRaw, geRaw] = await Promise.all([
        fetchWBIndicator(isoCode, WB_INDICATORS.politicalStability),
        fetchWBIndicator(isoCode, WB_INDICATORS.ruleOfLaw),
        fetchWBIndicator(isoCode, WB_INDICATORS.corruption),
        fetchWBIndicator(isoCode, WB_INDICATORS.govEffectiveness),
    ]);

    // Require at least 2 indicators to produce a valid WB score
    const riskScores = [psRaw, rlRaw, ccRaw, geRaw]
        .map(wgiToRisk)
        .filter(v => v !== null);

    if (riskScores.length < 2) return null;

    const avg = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
    return {
        wb_risk: Math.round(avg),
        indicators: {
            political_stability: psRaw !== null ? Math.round(wgiToRisk(psRaw)) : null,
            rule_of_law: rlRaw !== null ? Math.round(wgiToRisk(rlRaw)) : null,
            control_of_corruption: ccRaw !== null ? Math.round(wgiToRisk(ccRaw)) : null,
            gov_effectiveness: geRaw !== null ? Math.round(wgiToRisk(geRaw)) : null,
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get comprehensive risk profile for a country.
 * Combines World Bank WGI + GPR. Cached 30 days.
 *
 * @param {string} isoCode  ISO-2 country code (e.g. "CN")
 * @returns {Promise<{
 *   country_risk_score: number,   // 0-100, higher = riskier  (composite)
 *   gpr_score: number,            // 0-100  (Geopolitical Risk)
 *   wb_risk: number|null,         // 0-100  (World Bank composite)
 *   wb_indicators: object|null,   // individual WB indicator scores
 *   risk_label: string,           // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
 *   data_source: string,          // 'WorldBank+GPR' | 'GPR+Fallback' | 'Fallback'
 * }>}
 */
async function getCountryRisk(isoCode) {
    const iso = (isoCode || 'XX').toUpperCase();
    const cKey = cacheKey('country_risk_v2', iso);

    const cached = await cacheGet(cKey);
    if (cached) return cached;

    // --- GPR Score (embedded table — instant) ---
    const gprRaw = GPR_SCORES[iso] ?? 50;

    // --- World Bank WGI Score (live API) ---
    let wbResult = null;
    try {
        wbResult = await fetchWorldBankRisk(iso);
    } catch (err) {
        // Fail silently — WB API is supplementary
    }

    // --- Compose Final Score ---
    let country_risk_score;
    let data_source;

    if (wbResult) {
        // 60% World Bank (governance) + 40% GPR (geopolitical events)
        country_risk_score = Math.round(0.60 * wbResult.wb_risk + 0.40 * gprRaw);
        data_source = 'WorldBank+GPR';
    } else {
        // No live WB data — use fallback table + GPR
        const fallbackRisk = FALLBACK_RISK[iso] ?? 50;
        country_risk_score = Math.round(0.55 * fallbackRisk + 0.45 * gprRaw);
        data_source = FALLBACK_RISK[iso] !== undefined ? 'GPR+Fallback' : 'Fallback';
    }

    // Clamp to 0-100
    country_risk_score = Math.max(0, Math.min(100, country_risk_score));

    // --- Risk Label ---
    let risk_label;
    if (country_risk_score >= 75) risk_label = 'CRITICAL';
    else if (country_risk_score >= 55) risk_label = 'HIGH';
    else if (country_risk_score >= 35) risk_label = 'MEDIUM';
    else risk_label = 'LOW';

    const result = {
        country_risk_score,
        gpr_score: gprRaw,
        wb_risk: wbResult?.wb_risk ?? null,
        wb_indicators: wbResult?.indicators ?? null,
        risk_label,
        data_source,
    };

    // Cache 30 days (WB data is annual; GPR is monthly)
    await cacheSet(cKey, result, 60 * 60 * 24 * 30);

    console.log(`[Risk v2] ${iso}: score=${country_risk_score} label=${risk_label} src=${data_source} gpr=${gprRaw} wb=${wbResult?.wb_risk ?? 'N/A'}`);
    return result;
}

/**
 * Enrich an entire graph's nodes with real risk scores.
 * Replaces the random countryRisk() stubs from builder.js.
 *
 * @param {Array<object>} nodes
 * @returns {Promise<Array<object>>} Nodes with updated country_risk_score, gpr_score, risk_label, wb_indicators
 */
async function enrichGraphWithRisk(nodes) {
    if (!nodes || nodes.length === 0) return nodes;

    // Deduplicate countries to minimize API calls
    const countries = [...new Set(nodes.map(n => n.country).filter(Boolean))];
    console.log(`[Risk v2] Fetching risk for ${countries.length} unique countries: ${countries.join(', ')}`);

    const riskMap = {};
    await Promise.all(
        countries.map(async (iso) => {
            riskMap[iso] = await getCountryRisk(iso);
        })
    );

    return nodes.map(node => {
        const iso = (node.country || '').toUpperCase();
        const risk = riskMap[iso];
        if (!risk) return node;

        return {
            ...node,
            country_risk_score: risk.country_risk_score,
            gpr_score: risk.gpr_score,
            risk_label: risk.risk_label,
            wb_risk: risk.wb_risk,
            wb_indicators: risk.wb_indicators,
            risk_data_source: risk.data_source,
        };
    });
}

/**
 * Get an aggregate risk summary for a graph.
 *
 * @param {Array<object>} enrichedNodes
 * @returns {{ avg_risk: number, high_risk_countries: string[], breakdown: object }}
 */
function getRiskSummary(enrichedNodes) {
    const scored = enrichedNodes.filter(n => n.tier > 0 && n.country_risk_score != null);
    if (scored.length === 0) return { avg_risk: 0, high_risk_countries: [], breakdown: {} };

    const avg = scored.reduce((sum, n) => sum + n.country_risk_score, 0) / scored.length;

    const breakdown = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const n of scored) breakdown[n.risk_label || 'MEDIUM'] = (breakdown[n.risk_label || 'MEDIUM'] || 0) + 1;

    const highRisk = [...new Set(
        scored.filter(n => ['HIGH', 'CRITICAL'].includes(n.risk_label)).map(n => n.country)
    )];

    return {
        avg_risk: Math.round(avg),
        high_risk_countries: highRisk,
        breakdown,
        node_count: scored.length,
    };
}

module.exports = { getCountryRisk, enrichGraphWithRisk, getRiskSummary };
