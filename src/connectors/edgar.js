/**
 * SEC EDGAR Connector v2
 *
 * Uses the SEC EDGAR full-text search API (EFTS) to find real supplier names
 * mentioned in annual filings (10-K, 20-F). Free, no API key required.
 *
 * Used as primary Tier-3+ company name resolver — runs before Wikidata and LLM.
 * Returns a list of named supplier entities for a given parent company + commodity.
 */

const { httpGet } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');

const EDGAR_EFTS_URL = 'https://efts.sec.gov/LATEST/search-index';
const EDGAR_COMPANY_URL = 'https://data.sec.gov/submissions';

/**
 * Search SEC EDGAR full-text search for supplier mentions.
 *
 * @param {string} companyName   - Parent company (e.g. "Tesla")
 * @param {string} commodity     - Product term (e.g. "lithium cells")
 * @param {string} hsnCode       - HS code for context
 * @returns {Promise<Array<{name: string, country: string, source: string, confidence: string}>>}
 */
async function searchSECEdgar(companyName, commodity, hsnCode) {
    const cKey = cacheKey('edgar', companyName, commodity);
    const cached = await cacheGet(cKey);
    if (cached) {
        console.log(`[EDGAR] Cache hit: "${companyName}" + "${commodity}"`);
        return cached;
    }

    console.log(`[EDGAR] Searching filings for "${companyName}" + supplier of "${commodity}"...`);

    try {
        // Query EFTS for annual filings mentioning the commodity + "supplier"
        const query = encodeURIComponent(`"${commodity}" supplier`);
        const entity = encodeURIComponent(companyName);

        const data = await httpGet(EDGAR_EFTS_URL, {
            source: 'edgar',
            params: {
                q: `${query}`,
                dateRange: 'custom',
                startdt: '2021-01-01',
                enddt: new Date().getFullYear() + '-12-31',
                forms: '10-K,20-F',
                entity: companyName,
            },
            timeout: 15000,
        });

        const suppliers = parseEdgarHits(data, companyName);

        if (suppliers.length > 0) {
            await cacheSet(cKey, suppliers, 86400 * 7); // 7-day cache — filings change slowly
        }

        console.log(`[EDGAR] Found ${suppliers.length} supplier mentions for "${companyName}"`);
        return suppliers;
    } catch (err) {
        console.warn(`[EDGAR] Search failed for "${companyName}": ${err.message}`);
        return [];
    }
}

/**
 * Parse EDGAR EFTS hits to extract supplier entity names.
 * Looks for patterns like "our supplier X", "from X Corporation", etc.
 */
function parseEdgarHits(data, parentCompany) {
    if (!data || !data.hits || !data.hits.hits) return [];

    const suppliers = [];
    const seen = new Set();

    for (const hit of data.hits.hits.slice(0, 10)) {
        const text = hit._source?.file_date ? '' : (hit._source?.period_of_report ? '' : '');
        const filingText = hit.highlight?.['file.content']?.[0] || hit._source?.['file.content'] || '';

        if (!filingText) continue;

        // Extract supplier name patterns from filing text snippets
        const patterns = [
            /our (?:primary |sole |key )?supplier[,s]?\s+([A-Z][A-Za-z0-9\s&.,]+(?:Inc|Corp|Ltd|Co|LLC|GmbH|AG|plc|SE|SA)\.?)/g,
            /(?:supplied|manufactured) by\s+([A-Z][A-Za-z0-9\s&.,]+(?:Inc|Corp|Ltd|Co|LLC|GmbH|AG|plc|SE|SA)\.?)/g,
            /from\s+([A-Z][A-Za-z0-9\s&.,]+(?:Inc|Corp|Ltd|Co|LLC|GmbH|AG|plc|SE|SA)\.?)/g,
            /([A-Z][A-Za-z0-9\s&.,]+(?:Inc|Corp|Ltd|Co|LLC|GmbH|AG|plc|SE|SA)\.?)\s+(?:is|are|serves as)\s+(?:a|our)?\s+(?:key|major|primary)?\s+supplier/g,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(filingText)) !== null) {
                const name = match[1].trim().replace(/\.$/, '');
                if (name.length < 3 || name.length > 60) continue;
                if (name.toLowerCase() === parentCompany.toLowerCase()) continue;
                if (seen.has(name.toLowerCase())) continue;

                seen.add(name.toLowerCase());
                suppliers.push({
                    name,
                    country: '', // Country resolved separately or left for Comtrade
                    source: 'sec-edgar',
                    confidence: 'VERIFIED', // Filed under SEC oversight
                    filingDate: hit._source?.file_date || '',
                });
            }
        }
    }

    return suppliers;
}

/**
 * Look up a company's CIK from EDGAR company search.
 * Useful for retrieving structured filings data.
 *
 * @param {string} companyName
 * @returns {Promise<string|null>} CIK number or null
 */
async function getCompanyCIK(companyName) {
    try {
        const data = await httpGet('https://efts.sec.gov/LATEST/search-index', {
            source: 'edgar',
            params: { q: `"${companyName}"`, forms: '10-K', dateRange: 'custom', startdt: '2023-01-01', enddt: '2024-12-31' },
            timeout: 10000,
        });

        const cik = data?.hits?.hits?.[0]?._source?.entity_id;
        return cik || null;
    } catch {
        return null;
    }
}

/**
 * Get a company's supplier mentions from their most recent 10-K.
 * Uses the company CIK to fetch structured submissions.
 *
 * @param {string} companyName
 * @param {string} commodity
 * @param {string} hsnCode
 * @returns {Promise<Array>}
 */
async function getSupplierMentions(companyName, commodity, hsnCode) {
    return searchSECEdgar(companyName, commodity, hsnCode);
}

module.exports = { searchSECEdgar, getSupplierMentions, getCompanyCIK };
