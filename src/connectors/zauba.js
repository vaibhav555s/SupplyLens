// ─── Zauba Connector ───
// Scrapes zauba.com for Indian import/export customs data.
// Returns PRD-standard Trade Record objects.

const cheerio = require('cheerio');
const { httpGet } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const { normalizeToHS6 } = require('../utils/hsn');
const config = require('../config');

const BASE_URL = 'https://www.zauba.com';

/**
 * Search Zauba for a company's Indian import records.
 *
 * @param {string} companyName - Company name to search
 * @param {string} [tradeType='import'] - 'import' or 'export'
 * @returns {Promise<Array>} Array of PRD Trade Record objects
 */
async function searchCompany(companyName, tradeType = 'import') {
    const key = cacheKey('zauba', companyName, tradeType);
    const cached = await cacheGet(key);
    if (cached) {
        console.log(`[Zauba] Cache hit for "${companyName}" (${tradeType})`);
        return cached;
    }

    console.log(`[Zauba] Fetching ${tradeType} data for "${companyName}"...`);

    try {
        const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const url = `${BASE_URL}/${tradeType}-${slug}/LATEST`;

        const html = await httpGet(url, {
            source: 'zauba',
            headers: {
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.zauba.com/',
            },
        });

        const records = parseZaubaPage(html, companyName, tradeType);

        if (records.length > 0) {
            await cacheSet(key, records, config.cacheTTL.tradeData);
            console.log(`[Zauba] Found ${records.length} records for "${companyName}"`);
            return records;
        } else {
            throw new Error("No records found (anti-bot block)");
        }
    } catch (err) {
        console.error(`[Zauba] Error fetching "${companyName}": ${err.message}`);
        return [];
    }
}

/**
 * Parse Zauba HTML page for trade records.
 */
function parseZaubaPage(html, companyName, tradeType) {
    if (typeof html !== 'string') return [];

    const $ = cheerio.load(html);
    const records = [];

    // Zauba presents data in tables with columns: Date, HS Code, Description, Port, Country, Qty, Value
    $('table tbody tr').each((_, el) => {
        const $row = $(el);
        const cells = $row.find('td');

        if (cells.length >= 5) {
            const date = $(cells[0]).text().trim();
            const hsCode = $(cells[1]).text().trim();
            const description = $(cells[2]).text().trim();
            const port = $(cells[3]).text().trim();
            const country = $(cells[4]).text().trim();
            const quantity = parseFloat($(cells[5])?.text()?.trim()) || 0;
            const value = parseFloat($(cells[6])?.text()?.trim()?.replace(/[^0-9.]/g, '')) || 0;

            if (hsCode || description) {
                const hs6 = normalizeToHS6(hsCode);

                const record = {
                    source_name: tradeType === 'import' ? extractCompanyFromDesc(description, country) : companyName,
                    source_country: tradeType === 'import' ? extractCountryCode(country) : 'IN',
                    target_name: tradeType === 'import' ? companyName : extractCompanyFromDesc(description, country),
                    target_country: tradeType === 'import' ? 'IN' : extractCountryCode(country),
                    hs_code: hs6,
                    hs_code_6: hs6,
                    commodity: description,
                    trade_type: tradeType,
                    shipment_count: 1,
                    trade_value: value,
                    quantity: quantity,
                    unit: 'kg',
                    date_range: { start: date, end: date },
                    data_source: 'zauba',
                    confidence: 'VERIFIED',
                };

                records.push(record);
            }
        }
    });

    return aggregateRecords(records);
}

/**
 * Try to extract a company name from a description string.
 */
function extractCompanyFromDesc(description, country) {
    // Often the shipper name is embedded — return as-is if short
    if (description.length < 80) return description;
    // Truncate long descriptions
    return description.substring(0, 60) + '...';
}

/**
 * Map country names to ISO codes.
 */
function extractCountryCode(input) {
    if (!input) return '';
    const clean = input.trim().toUpperCase();
    if (clean.length === 2) return clean;

    const map = {
        'CHINA': 'CN', 'JAPAN': 'JP', 'KOREA': 'KR', 'SOUTH KOREA': 'KR',
        'TAIWAN': 'TW', 'GERMANY': 'DE', 'INDIA': 'IN', 'MEXICO': 'MX',
        'UNITED STATES': 'US', 'USA': 'US', 'UNITED KINGDOM': 'GB',
        'SINGAPORE': 'SG', 'MALAYSIA': 'MY', 'THAILAND': 'TH',
        'VIETNAM': 'VN', 'INDONESIA': 'ID', 'HONG KONG': 'HK',
        'FRANCE': 'FR', 'ITALY': 'IT', 'NETHERLANDS': 'NL',
        'AUSTRALIA': 'AU', 'CANADA': 'CA', 'BRAZIL': 'BR',
    };
    return map[clean] || clean.substring(0, 2);
}

/**
 * Aggregate records by (source, target, hs_code) — sum shipment counts.
 */
function aggregateRecords(records) {
    const map = new Map();
    for (const r of records) {
        const key = `${r.source_name}::${r.target_name}::${r.hs_code_6}`;
        if (map.has(key)) {
            const existing = map.get(key);
            existing.shipment_count += 1;
            existing.trade_value += r.trade_value;
            existing.quantity += r.quantity;
            // Extend date range
            if (r.date_range.start && (!existing.date_range.start || r.date_range.start < existing.date_range.start)) {
                existing.date_range.start = r.date_range.start;
            }
            if (r.date_range.end && (!existing.date_range.end || r.date_range.end > existing.date_range.end)) {
                existing.date_range.end = r.date_range.end;
            }
        } else {
            map.set(key, { ...r });
        }
    }
    return Array.from(map.values());
}

module.exports = { searchCompany };
