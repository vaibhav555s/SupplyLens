// ─── OpenCorporates Entity Resolver ───
// Searches OpenCorporates API for company legal entities.
// Returns PRD Entity Object format.

const { httpGet } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');

const BASE_URL = 'https://api.opencorporates.com/v0.4';

/**
 * Search OpenCorporates for a company by name and optional jurisdiction.
 *
 * @param {string} companyName - Fuzzy company name to search
 * @param {string} [countryIso] - ISO alpha-2 country code to narrow search
 * @returns {Promise<object|null>} PRD Entity Object or null
 */
async function searchCompany(companyName, countryIso) {
    const key = cacheKey('opencorp', companyName, countryIso || 'any');
    const cached = await cacheGet(key);
    if (cached) {
        console.log(`[OpenCorp] Cache hit for "${companyName}"`);
        return cached;
    }

    console.log(`[OpenCorp] Searching for "${companyName}" (${countryIso || 'global'})...`);

    if (!config.openCorporatesApiKey) {
        console.warn(`[OpenCorp] Skipping search for "${companyName}": No API key configured.`);
        return null;
    }

    try {
        const params = { q: companyName };

        // Add jurisdiction filter if country provided
        if (countryIso) {
            params.jurisdiction_code = countryIso.toLowerCase();
        }

        // Add API key if available
        if (config.openCorporatesApiKey) {
            params.api_token = config.openCorporatesApiKey;
        }

        const data = await httpGet(`${BASE_URL}/companies/search`, {
            source: 'opencorporates',
            params,
            timeout: 5000,
        });

        const entity = parseOpenCorpResponse(data, companyName, countryIso);

        if (entity) {
            await cacheSet(key, entity, config.cacheTTL.entityResolution);
        }

        return entity;
    } catch (err) {
        console.error(`[OpenCorp] Error searching "${companyName}": ${err.message}`);
        return null;
    }
}

/**
 * Parse OpenCorporates API response to PRD Entity Object.
 */
function parseOpenCorpResponse(data, searchName, searchCountry) {
    if (!data?.results?.companies?.length) return null;

    // Find best match — prefer exact name match, then jurisdiction match
    const companies = data.results.companies;
    let best = companies[0].company;

    for (const item of companies) {
        const co = item.company;
        const nameMatch = co.name?.toLowerCase().includes(searchName.toLowerCase());
        const countryMatch = !searchCountry ||
            co.jurisdiction_code?.toUpperCase().startsWith(searchCountry.toUpperCase());

        if (nameMatch && countryMatch) {
            best = co;
            break;
        }
    }

    if (!best) return null;

    // Extract country from jurisdiction_code (e.g., "us_ca" → "US")
    const country = best.jurisdiction_code
        ? best.jurisdiction_code.split('_')[0].toUpperCase()
        : (searchCountry || '');

    return {
        node_id: `opencorp_${best.company_number || best.opencorporates_url?.split('/').pop() || ''}`,
        name: best.name || searchName,
        country: country,
        node_type: 'COMPANY',
        lat: null,
        lng: null,
        confidence: 'VERIFIED',
        source: 'opencorporates',
        extra: {
            company_number: best.company_number || '',
            jurisdiction: best.jurisdiction_code || '',
            status: best.current_status || '',
            incorporation_date: best.incorporation_date || '',
            opencorporates_url: best.opencorporates_url || '',
            registered_address: best.registered_address_in_full || '',
        },
    };
}

module.exports = { searchCompany };
