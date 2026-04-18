// ─── Wikidata SPARQL Entity Resolver ───
// Queries Wikidata for known companies — returns QID, HQ country, parent org.
// Uses SPARQL endpoint: https://query.wikidata.org/sparql

const { httpGet } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

/**
 * Search Wikidata for a company entity by name.
 *
 * @param {string} companyName - Company name to search
 * @param {string} [countryIso] - Optional ISO alpha-2 country code hint
 * @returns {Promise<object|null>} PRD Entity Object or null
 */
async function searchCompany(companyName, countryIso) {
    const key = cacheKey('wikidata', companyName, countryIso || 'any');
    const cached = await cacheGet(key);
    if (cached) {
        console.log(`[Wikidata] Cache hit for "${companyName}"`);
        return cached;
    }

    console.log(`[Wikidata] SPARQL search for "${companyName}"...`);

    try {
        // Build SPARQL query to find a company by label
        const escapedName = companyName.replace(/"/g, '\\"');
        const sparql = buildCompanyQuery(escapedName);

        const data = await httpGet(SPARQL_ENDPOINT, {
            source: 'wikidata',
            params: {
                query: sparql,
                format: 'json',
            },
            headers: {
                'Accept': 'application/sparql-results+json',
            },
            timeout: 20000,
        });

        const entity = parseSparqlResponse(data, companyName, countryIso);

        if (entity) {
            await cacheSet(key, entity, config.cacheTTL.entityResolution);
        }

        return entity;
    } catch (err) {
        console.error(`[Wikidata] Error searching "${companyName}": ${err.message}`);
        return null;
    }
}

/**
 * Build SPARQL query to search for a company entity.
 * Searches by label, looking for instances of business/enterprise/organization.
 */
function buildCompanyQuery(companyName) {
    return `
SELECT ?company ?companyLabel ?country ?countryLabel ?countryCode
       ?hqLabel ?parentLabel ?coord ?industryLabel
WHERE {
  # Search by label
  ?company rdfs:label "${companyName}"@en.

  # Must be some kind of organization or business
  {
    ?company wdt:P31/wdt:P279* wd:Q4830453.  # business
  } UNION {
    ?company wdt:P31/wdt:P279* wd:Q783794.   # company
  } UNION {
    ?company wdt:P31/wdt:P279* wd:Q6881511.  # enterprise
  } UNION {
    ?company wdt:P31 wd:Q891723.             # public company
  }

  # Get headquarters location and its country
  OPTIONAL {
    ?company wdt:P159 ?hq.
    ?hq wdt:P17 ?country.
    OPTIONAL { ?country wdt:P297 ?countryCode. }
  }

  # Direct country if no HQ
  OPTIONAL {
    ?company wdt:P17 ?country.
    OPTIONAL { ?country wdt:P297 ?countryCode. }
  }

  # Parent org
  OPTIONAL { ?company wdt:P749 ?parent. }

  # Coordinates
  OPTIONAL { ?company wdt:P625 ?coord. }

  # Industry
  OPTIONAL { ?company wdt:P452 ?industry. }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 5
  `.trim();
}

/**
 * If exact label search fails, try a broader search.
 */
function buildFuzzyQuery(companyName) {
    return `
SELECT ?company ?companyLabel ?country ?countryLabel ?countryCode
       ?hqLabel ?parentLabel ?coord
WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:api "EntitySearch".
    bd:serviceParam wikibase:endpoint "www.wikidata.org".
    bd:serviceParam mwapi:search "${companyName}".
    bd:serviceParam mwapi:language "en".
    ?company wikibase:apiOutputItem mwapi:item.
  }

  # Must be business-like
  ?company wdt:P31/wdt:P279* wd:Q4830453.

  OPTIONAL {
    ?company wdt:P159 ?hq.
    ?hq wdt:P17 ?country.
    OPTIONAL { ?country wdt:P297 ?countryCode. }
  }

  OPTIONAL { ?company wdt:P749 ?parent. }
  OPTIONAL { ?company wdt:P625 ?coord. }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 5
  `.trim();
}

/**
 * Parse SPARQL JSON response to PRD Entity Object.
 */
function parseSparqlResponse(data, searchName, searchCountry) {
    const bindings = data?.results?.bindings;
    if (!bindings || bindings.length === 0) return null;

    // Find best match
    let best = bindings[0];
    if (searchCountry) {
        const countryMatch = bindings.find(b =>
            b.countryCode?.value?.toUpperCase() === searchCountry.toUpperCase()
        );
        if (countryMatch) best = countryMatch;
    }

    // Extract QID from entity URI
    const entityUri = best.company?.value || '';
    const qid = entityUri.split('/').pop(); // e.g., "Q478214"

    // Parse coordinates if available
    let lat = null, lng = null;
    if (best.coord?.value) {
        const coordMatch = best.coord.value.match(/Point\((-?[\d.]+)\s+(-?[\d.]+)\)/);
        if (coordMatch) {
            lng = parseFloat(coordMatch[1]);
            lat = parseFloat(coordMatch[2]);
        }
    }

    const country = best.countryCode?.value?.toUpperCase() || searchCountry || '';

    return {
        node_id: `wikidata_${qid}`,
        name: best.companyLabel?.value || searchName,
        country: country,
        node_type: 'COMPANY',
        lat: lat,
        lng: lng,
        confidence: 'VERIFIED',
        source: 'wikidata',
        extra: {
            qid: qid,
            wikidata_url: entityUri,
            headquarters: best.hqLabel?.value || '',
            parent_company: best.parentLabel?.value || '',
            industry: best.industryLabel?.value || '',
            country_name: best.countryLabel?.value || '',
        },
    };
}

/**
 * Fallback: try fuzzy search if exact label search fails.
 */
async function searchCompanyFuzzy(companyName, countryIso) {
    try {
        const sparql = buildFuzzyQuery(companyName.replace(/"/g, '\\"'));

        const data = await httpGet(SPARQL_ENDPOINT, {
            source: 'wikidata',
            params: { query: sparql, format: 'json' },
            headers: { 'Accept': 'application/sparql-results+json' },
            timeout: 20000,
        });

        return parseSparqlResponse(data, companyName, countryIso);
    } catch (err) {
        console.error(`[Wikidata] Fuzzy search failed for "${companyName}": ${err.message}`);
        return null;
    }
}

module.exports = { searchCompany, searchCompanyFuzzy };
