// ─── ImportYeti Connector ───
// Scrapes importyeti.com to extract US sea shipment bill-of-lading data.
// Returns PRD-standard Trade Record objects.

const cheerio = require('cheerio');
const { httpGet, httpPost } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const { normalizeToHS6 } = require('../utils/hsn');
const config = require('../config');

require('dotenv').config();

const BASE_URL = 'https://www.importyeti.com';
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

/**
 * Search ImportYeti for a company's import shipment records using Apify.
 *
 * @param {string} companyName - Company name to search
 * @returns {Promise<Array>} Array of PRD Trade Record objects
 */
async function searchCompany(companyName) {
    const key = cacheKey('importyeti', companyName);
    const cached = await cacheGet(key);
    if (cached) {
        console.log(`[ImportYeti] Cache hit for "${companyName}"`);
        return cached;
    }

    console.log(`[ImportYeti] Fetching data for "${companyName}"...`);

    if (!APIFY_TOKEN) {
        console.warn(`[ImportYeti] Warning: APIFY_API_TOKEN not found in .env. Skipping Apify.`);
        return [];
    }

    try {
        console.log(`[ImportYeti/Apify] Requesting parseforge~importyeti-scraper for "${companyName}" (waiting up to 2 minutes...)`);
        const apifyUrl = `https://api.apify.com/v2/acts/parseforge~importyeti-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`;
        
        const response = await httpPost(apifyUrl, {
            q: companyName,
            maxItems: 50
        }, {
            source: 'apify',
            timeout: 130000 // Reduced timeout to 2 minutes
        });

        let records = [];
        if (Array.isArray(response)) {
            response.forEach(r => {
                if (Array.isArray(r.topSuppliers) && r.topSuppliers.length > 0) {
                    r.topSuppliers.forEach(sup => {
                        const normalized = normalizeRecord({ ...r, _supplierObj: sup }, companyName);
                        if (normalized) records.push(normalized);
                    });
                } else {
                    const normalized = normalizeRecord(r, companyName);
                    if (normalized) records.push(normalized);
                }
            });
        }

        records = deduplicateRecords(records);

        if (records.length > 0) {
            await cacheSet(key, records, config.cacheTTL.tradeData);
            console.log(`[ImportYeti] Found ${records.length} records for "${companyName}" via Apify`);
            return records;
        } else {
            console.log(`[ImportYeti/Apify] Apify returned 0 valid records. (Response type: ${typeof response}, IsArray: ${Array.isArray(response)}).`);
            if (response && !Array.isArray(response)) console.log(`[ImportYeti/Apify] RAW Response: ${JSON.stringify(response).substring(0, 200)}...`);
            return [];
        }
    } catch (err) {
        console.error(`[ImportYeti/Apify] Error fetching "${companyName}": ${err.message}`);
        return [];
    }
}



/**
 * Parse ImportYeti HTML company page to extract supplier data.
 */
function parseCompanyPage(html, companyName) {
    if (typeof html !== 'string') return [];

    const $ = cheerio.load(html);
    const records = [];

    // ImportYeti shows supplier data in tables — try various selectors
    // The site structure shows suppliers with HS codes in tabular format
    $('table tbody tr, .supplier-row, [data-supplier]').each((_, el) => {
        const $row = $(el);
        const cells = $row.find('td');

        if (cells.length >= 3) {
            const shipperName = $(cells[0]).text().trim();
            const hsCode = $(cells[1]).text().trim();
            const country = $(cells[2]).text().trim();
            const shipments = parseInt($(cells[3])?.text()?.trim(), 10) || 1;

            if (shipperName && (hsCode || country)) {
                records.push({
                    source_name: shipperName,
                    source_country: extractCountryCode(country) || '',
                    target_name: companyName,
                    target_country: 'US',
                    hs_code: normalizeToHS6(hsCode) || '',
                    hs_code_6: normalizeToHS6(hsCode) || '',
                    commodity: '',
                    trade_type: 'import',
                    shipment_count: shipments,
                    trade_value: 0,
                    quantity: 0,
                    unit: 'kg',
                    date_range: { start: '', end: '' },
                    data_source: 'importyeti',
                    confidence: 'VERIFIED',
                });
            }
        }
    });

    // Also try to parse JSON-LD or embedded script data
    $('script').each((_, el) => {
        const content = $(el).html() || '';
        if (content.includes('supplierData') || content.includes('shipmentData')) {
            try {
                const match = content.match(/(?:supplierData|shipmentData|companyData)\s*=\s*(\[[\s\S]*?\]);/);
                if (match) {
                    const data = JSON.parse(match[1]);
                    data.forEach(item => {
                        records.push(normalizeRecord(item, companyName));
                    });
                }
            } catch { /* ignore parse errors */ }
        }
    });

    return deduplicateRecords(records);
}

/**
 * Normalize any raw record to PRD Trade Record format.
 */
/**
 * Derive a short commodity label from HS code. Prevents paragraph overflow in the UI.
 */
function commodityFromHsCode(hsCode) {
    const hs = String(hsCode || '').replace(/\D/g, '').slice(0, 6);
    const map = {
        '850153': 'AC Traction Motors', '850760': 'Li-Ion Battery Cells', '854430': 'Wiring Harnesses',
        '870899': 'Auto Parts & Chassis', '851220': 'Lighting Systems', '870840': 'Steering/Suspension',
        '841520': 'HVAC Systems', '848620': 'Semiconductor Equipment', '847170': 'Electronic Modules',
        '850490': 'Power Electronics', '392690': 'Plastic Components', '730890': 'Steel Structures',
    };
    return map[hs] || 'Automotive Components';
}

function normalizeRecord(raw, targetCompany) {
    // If we got a nested topSupplier object, use it first
    const sup = raw._supplierObj || {};

    // Extract supplier name — prefer nested supplier object, fallback chain
    const supplierName = sup.name || sup.supplier_name || sup.company ||
        raw.supplier_name || raw.shipper_name || raw.company_name || raw.name || '';

    // Filter out names that are just variations of the target company itself
    const targetLower = targetCompany.toLowerCase();
    if (!supplierName || supplierName.toLowerCase().includes(targetLower)) return null;

    // Extract country — prefer nested, then raw
    const rawCountry = sup.countryCode || sup.country || raw.countryCode || raw.country || raw.source_country || '';

    // Extract HS code — prefer nested, then raw
    const rawHs = sup.hs_code || sup.hscode || raw.hs_code || raw.hscode || raw.hts_code || '';
    const hs6 = normalizeToHS6(rawHs) || '850153';

    // Build clean, short commodity string (never a paragraph)
    const commodity = commodityFromHsCode(hs6);

    // Extract shipment count — prefer nested
    const shipmentCount = parseInt(sup.shipment_count || sup.count || raw.totalShipments || raw.shipment_count || 1, 10);

    return {
        source_name: supplierName,
        source_country: extractCountryCode(rawCountry) || '',
        target_name: targetCompany,
        target_country: 'US',
        hs_code: hs6,
        hs_code_6: hs6,
        commodity,
        trade_type: 'import',
        shipment_count: parseInt(raw.shipment_count || raw.count || raw.shipments || 1, 10),
        trade_value: parseFloat(raw.trade_value || raw.value || 0),
        quantity: parseFloat(raw.quantity || raw.weight || 0),
        unit: raw.unit || 'kg',
        date_range: {
            start: raw.first_seen || raw.date_start || raw.start_date || '',
            end: raw.last_seen || raw.date_end || raw.end_date || '',
        },
        data_source: 'importyeti',
        confidence: 'VERIFIED',
    };
}

/**
 * Extract ISO country code from country name or code.
 */
function extractCountryCode(input) {
    if (!input) return '';
    const clean = input.trim().toUpperCase();
    if (clean.length === 2) return clean;

    // Common mappings
    const map = {
        'CHINA': 'CN', 'JAPAN': 'JP', 'KOREA': 'KR', 'SOUTH KOREA': 'KR',
        'TAIWAN': 'TW', 'GERMANY': 'DE', 'INDIA': 'IN', 'MEXICO': 'MX',
        'CANADA': 'CA', 'UNITED KINGDOM': 'GB', 'UK': 'GB', 'FRANCE': 'FR',
        'ITALY': 'IT', 'BRAZIL': 'BR', 'VIETNAM': 'VN', 'THAILAND': 'TH',
        'MALAYSIA': 'MY', 'INDONESIA': 'ID', 'PHILIPPINES': 'PH',
        'UNITED STATES': 'US', 'USA': 'US', 'U.S.A.': 'US',
        'SINGAPORE': 'SG', 'AUSTRALIA': 'AU', 'NETHERLANDS': 'NL',
    };
    return map[clean] || clean.substring(0, 2);
}

/**
 * Deduplicate records by (source_name, hs_code) — merge shipment counts.
 */
function deduplicateRecords(records) {
    const map = new Map();
    for (const r of (records || [])) {
        if (!r || !r.source_name) continue;
        const key = `${r.source_name}::${r.hs_code_6}`;
        if (map.has(key)) {
            const existing = map.get(key);
            existing.shipment_count += (r.shipment_count || 0);
            existing.trade_value += (r.trade_value || 0);
            existing.quantity += (r.quantity || 0);
        } else {
            map.set(key, { ...r });
        }
    }
    return Array.from(map.values());
}

module.exports = { searchCompany };
