// ─── UN Comtrade Connector ───
// Queries the UN Comtrade API for country-to-country HS-code trade flows.
// Used at Tier-2+ when company-level data is unavailable.
// Returns PRD-standard Trade Record objects with confidence: "INFERRED"

const { httpGet } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const { normalizeToHS6 } = require('../utils/hsn');
const config = require('../config');

// UN Comtrade API v1 base URL
const BASE_URL = 'https://comtradeapi.un.org';

// ISO 3166-1 numeric codes for common countries (Comtrade uses numeric)
const COUNTRY_CODES = {
    US: 842, CN: 156, JP: 392, KR: 410, DE: 276, IN: 356,
    TW: 158, MX: 484, CA: 124, GB: 826, FR: 250, IT: 380,
    BR: 76, VN: 704, TH: 764, MY: 458, ID: 360, SG: 702,
    AU: 36, NL: 528, ES: 724, CH: 756, SE: 752, PL: 616,
    BE: 56, AT: 40, CZ: 203, HU: 348, RO: 642, PH: 608,
    CL: 152, ZA: 710, AE: 784, SA: 682, EG: 818, NG: 566,
    AR: 32, CO: 170, PE: 604, BD: 50, PK: 586, LK: 144,
    HK: 344, IE: 372, FI: 246, DK: 208, NO: 578, NZ: 554,
    IL: 376, KE: 404, GH: 288, ET: 231, TZ: 834,
};

/**
 * Get the numeric UN Comtrade code for an ISO alpha-2 country code.
 */
function getNumericCode(isoAlpha2) {
    return COUNTRY_CODES[isoAlpha2?.toUpperCase()] || 0;
}

/**
 * Query UN Comtrade for import data: which countries supply a given HS code to a reporter country.
 *
 * @param {string} reporterCountryIso - ISO alpha-2 code of the importing country
 * @param {string} hsCode - HS code (any format, will be normalized to 6-digit)
 * @param {object} [options]
 * @param {string} [options.period] - Year to query (default: latest available)
 * @param {string} [options.flowCode] - 'M' for imports, 'X' for exports (default: 'M')
 * @returns {Promise<Array>} Array of PRD Trade Record objects
 */
async function queryTradeFlows(reporterCountryIso, hsCode, options = {}) {
    const hs6 = normalizeToHS6(hsCode);
    const { period = '2023', flowCode = 'M' } = options;

    const key = cacheKey('comtrade', reporterCountryIso, hs6, period, flowCode);
    const cached = await cacheGet(key);
    if (cached) {
        console.log(`[Comtrade] Cache hit: ${reporterCountryIso} ← HS ${hs6}`);
        return cached;
    }

    const reporterCode = getNumericCode(reporterCountryIso);
    if (!reporterCode) {
        console.warn(`[Comtrade] Unknown country code: ${reporterCountryIso}`);
        return [];
    }

    console.log(`[Comtrade] Querying: reporter=${reporterCountryIso}(${reporterCode}), HS=${hs6}, flow=${flowCode}...`);

    try {
        // UN Comtrade API v1 — public preview endpoint (no key needed for preview, key for full)
        const params = {
            reporterCode: reporterCode,
            cmdCode: hs6,
            period: period,
            flowCode: flowCode,
        };

        // Always use the public preview endpoint.
        // The paid endpoint requires a valid subscription key — until one is confirmed
        // working, we stay on the free preview tier to avoid HTTP 401 errors.
        const url = `${BASE_URL}/public/v1/preview/C/A/HS`;

        const data = await httpGet(url, {
            source: 'comtrade',
            params,
            timeout: 30000,
        });

        const records = parseComtradeResponse(data, reporterCountryIso, hs6, flowCode);

        if (records.length > 0) {
            await cacheSet(key, records, config.cacheTTL.comtrade);
        }

        console.log(`[Comtrade] Found ${records.length} partner countries for HS ${hs6}`);
        return records;
    } catch (err) {
        console.error(`[Comtrade] Error querying ${reporterCountryIso}/HS:${hs6}: ${err.message}`);
        return [];
    }
}

/**
 * Parse UN Comtrade JSON response into PRD Trade Records.
 */
function parseComtradeResponse(data, reporterIso, hs6, flowCode) {
    if (!data) return [];

    // The API response has a 'data' array
    const items = data.data || data || [];
    if (!Array.isArray(items)) return [];

    const records = [];

    for (const item of items) {
        // Skip world aggregates and self-trade
        const partnerCode = item.partnerCode || item.partner2Code;
        if (!partnerCode || partnerCode === 0) continue;

        const partnerIso = getIsoFromNumeric(partnerCode);
        if (!partnerIso || partnerIso === reporterIso) continue;

        const tradeValue = parseFloat(item.primaryValue || item.tradeValue || item.cifvalue || item.fobvalue || 0);
        const qty = parseFloat(item.netWgt || item.qty || item.grossWgt || 0);

        // Determine source/target based on flow direction
        const isImport = flowCode === 'M';

        records.push({
            source_name: partnerIso,  // Country-level node — name is the country code
            source_country: isImport ? partnerIso : reporterIso,
            target_name: reporterIso,
            target_country: isImport ? reporterIso : partnerIso,
            hs_code: hs6,
            hs_code_6: hs6,
            commodity: item.cmdDescE || item.cmdDesc || '',
            trade_type: isImport ? 'import' : 'export',
            shipment_count: 0,  // Comtrade doesn't give shipment counts
            trade_value: tradeValue,
            quantity: qty,
            unit: item.qtyUnitAbbr || 'kg',
            date_range: {
                start: `${item.period || '2023'}-01-01`,
                end: `${item.period || '2023'}-12-31`,
            },
            data_source: 'comtrade',
            confidence: 'INFERRED',  // Country-level = inferred
        });
    }

    // Sort by trade value descending (most significant partners first)
    records.sort((a, b) => b.trade_value - a.trade_value);

    return records;
}

/**
 * Reverse lookup: numeric Comtrade code → ISO alpha-2.
 */
function getIsoFromNumeric(numericCode) {
    for (const [iso, num] of Object.entries(COUNTRY_CODES)) {
        if (num === numericCode) return iso;
    }
    return null;
}

/**
 * Get top import partners for a country + HS code.
 * Convenience wrapper that returns the top N results.
 *
 * @param {string} countryIso
 * @param {string} hsCode
 * @param {number} [topN=10]
 * @returns {Promise<Array>}
 */
async function getTopImportPartners(countryIso, hsCode, topN = 10) {
    const records = await queryTradeFlows(countryIso, hsCode, { flowCode: 'M' });
    return records.slice(0, topN);
}

/**
 * Get top export destinations for a country + HS code.
 */
async function getTopExportPartners(countryIso, hsCode, topN = 10) {
    const records = await queryTradeFlows(countryIso, hsCode, { flowCode: 'X' });
    return records.slice(0, topN);
}

module.exports = {
    queryTradeFlows,
    getTopImportPartners,
    getTopExportPartners,
    getNumericCode,
    COUNTRY_CODES,
};
