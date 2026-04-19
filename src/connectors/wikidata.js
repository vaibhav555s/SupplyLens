/**
 * Wikidata Connector v2
 *
 * Uses Wikidata SPARQL to find real companies in a given industry + country.
 * This is the 4th-priority source in the Tier-3+ waterfall:
 *   Comtrade → EDGAR → crossref → Wikidata → LLM last
 *
 * No API key required. Rate-limited to 1 req/sec to respect Wikidata ToS.
 */

const { httpGet } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

/**
 * Map 4-digit HS code prefixes to Wikidata industry class QIDs.
 * Used to resolve what kind of company to look up in Wikidata.
 */
const HS_TO_INDUSTRY_QID = {
    '7403': 'Q46076',    // copper smelting / production
    '7225': 'Q9121',     // steel manufacturing
    '7208': 'Q9121',     // steel manufacturing
    '7201': 'Q1064681',  // iron and steel
    '7601': 'Q37756',    // aluminium smelting
    '7606': 'Q37756',    // aluminium products
    '7408': 'Q46076',    // copper wire
    '2601': 'Q1055670',  // iron ore mining
    '2603': 'Q190517',   // copper mining
    '2606': 'Q247091',   // aluminium ore (bauxite)
    '8507': 'Q1077097',  // battery manufacturing
    '8542': 'Q20826604', // semiconductor manufacturing
    '8486': 'Q20826604', // semiconductor equipment
    '8504': 'Q6502917',  // power electronics
    '8501': 'Q193060',   // electric motor manufacturing
    '8503': 'Q193060',   // motor/generator parts
    '8544': 'Q211009',   // wire & cable manufacturing
    '4011': 'Q177629',   // tyre manufacturing
    '4001': 'Q60772',    // natural rubber
    '8482': 'Q848943',   // bearing manufacturing
    '8483': 'Q848943',   // transmission components
    '8408': 'Q184661',   // diesel engine manufacturing
    '8407': 'Q184661',   // gasoline engine manufacturing
    '8708': 'Q1030598',  // automotive parts
    '8471': 'Q17228393', // computer hardware
    '8473': 'Q17228393', // computer components
    '8517': 'Q11032',    // telecommunications equipment
    '8802': 'Q11436',    // aircraft manufacturing
    '2709': 'Q83588',    // crude oil extraction
    '2710': 'Q12757',    // petroleum refining
};

/**
 * Map HS code to a human-readable industry label for SPARQL queries.
 */
const HS_TO_INDUSTRY_LABEL = {
    '7403': 'copper smelting',
    '7225': 'steel manufacturing',
    '7208': 'steel production',
    '7201': 'iron and steel',
    '7601': 'aluminium smelting',
    '7606': 'aluminium products',
    '7408': 'copper wire production',
    '2601': 'iron ore mining',
    '2603': 'copper mining',
    '2606': 'aluminium ore (bauxite)',
    '8507': 'battery manufacturing',
    '8542': 'semiconductor manufacturing',
    '8486': 'semiconductor equipment',
    '8504': 'power electronics',
    '8501': 'electric motor manufacturing',
    '8503': 'motor parts manufacturing',
    '8544': 'cable manufacturing',
    '4011': 'tire manufacturing',
    '4001': 'natural rubber production',
    '8482': 'bearing manufacturing',
    '8483': 'transmission components',
    '8408': 'diesel engine manufacturing',
    '8708': 'automotive parts manufacturing',
    '8517': 'telecommunications equipment',
    '8802': 'aircraft manufacturing',
    '2709': 'crude oil extraction',
    '2710': 'petroleum refining',
    '2804': 'silicon production',
    '3901': 'polyethylene production',
    '3902': 'polypropylene production',
    '3904': 'PVC manufacturing',
    '8411': 'turbojet manufacturing',
    '8413': 'pump manufacturing',
    '8414': 'compressor manufacturing',
    '8481': 'valve manufacturing',
    '8537': 'electrical control boards',
    '9013': 'liquid crystal devices',
    '9032': 'automatic regulating instruments',
    '2917': 'phthalic anhydride (chemicals)',
    '2933': 'heterocyclic compounds (chemicals)',
    '5402': 'synthetic yarn production',
    '5201': 'cotton production',
};

/**
 * Get the industry QID and label for an HS code.
 */
function getIndustryForHS(hsCode) {
    const prefix4 = (hsCode || '').replace('.', '').substring(0, 4);
    return {
        qid: HS_TO_INDUSTRY_QID[prefix4] || null,
        label: HS_TO_INDUSTRY_LABEL[prefix4] || null,
    };
}

/**
 * Query Wikidata for companies in a given industry + country.
 *
 * @param {string} countryIso  - ISO 2-letter country code (e.g. "CN")
 * @param {string} hsCode      - HS code (used to determine industry)
 * @param {number} [limit=5]   - Max results
 * @returns {Promise<Array<{name: string, country: string, source: string, confidence: string}>>}
 */
async function getCompaniesByIndustryAndCountry(countryIso, hsCode, limit = 5) {
    const { qid, label } = getIndustryForHS(hsCode);

    if (!qid) {
        console.log(`[Wikidata] No industry QID for HS prefix ${hsCode.substring(0, 4)} — skipping`);
        return [];
    }

    const cKey = cacheKey('wikidata', countryIso, qid);
    const cached = await cacheGet(cKey);
    if (cached) {
        console.log(`[Wikidata] Cache hit: ${countryIso} + ${label}`);
        return cached;
    }

    // Map ISO-2 to Wikidata country QID
    const countryQid = ISO_TO_WIKIDATA_QID[countryIso.toUpperCase()];
    if (!countryQid) {
        console.log(`[Wikidata] No QID for country ${countryIso} — skipping`);
        return [];
    }

    const sparql = buildSparqlQuery(qid, countryQid, limit);

    console.log(`[Wikidata] Querying: ${label} companies in ${countryIso}...`);

    try {
        const data = await httpGet(WIKIDATA_SPARQL, {
            source: 'wikidata',
            params: { query: sparql, format: 'json' },
            headers: {
                'User-Agent': 'SupplyChainXRay/2.0 (supply-chain-research; contact@syn3rgy.ai)',
                'Accept': 'application/sparql-results+json',
            },
            timeout: 20000,
        });

        const results = parseWikidataResults(data, countryIso);

        if (results.length > 0) {
            await cacheSet(cKey, results, 86400 * 30); // 30-day cache — Wikidata is stable
        }

        console.log(`[Wikidata] Found ${results.length} companies for ${label} in ${countryIso}`);
        return results;
    } catch (err) {
        console.warn(`[Wikidata] Query failed for ${label}/${countryIso}: ${err.message}`);
        return [];
    }
}

/**
 * Build a SPARQL query to find companies by industry class and country.
 */
function buildSparqlQuery(industryQid, countryQid, limit) {
    return `
SELECT DISTINCT ?company ?companyLabel ?countryLabel WHERE {
  ?company wdt:P31/wdt:P279* wd:Q4830453 . # instance of: business or company (transitive)
  ?company wdt:P452 wd:${industryQid} .   # industry
  ?company wdt:P17 wd:${countryQid} .     # country
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?company)
LIMIT ${limit}
`.trim();
}

/**
 * Parse Wikidata SPARQL results into the standard supplier format.
 */
function parseWikidataResults(data, countryIso) {
    if (!data || !data.results || !data.results.bindings) return [];

    return data.results.bindings
        .filter(b => b.companyLabel && b.companyLabel.value)
        .map(b => ({
            name: b.companyLabel.value,
            country: countryIso,
            source: 'wikidata',
            confidence: 'INFERRED', // Wikidata is structured but not customs-verified
            wikidataId: b.company?.value?.split('/').pop() || '',
        }));
}

// ISO 2-letter → Wikidata QID for country
const ISO_TO_WIKIDATA_QID = {
    CN: 'Q148', JP: 'Q17', KR: 'Q884', TW: 'Q865',
    DE: 'Q183', IN: 'Q668', MX: 'Q96', CA: 'Q16',
    GB: 'Q145', FR: 'Q142', IT: 'Q38', BR: 'Q155',
    VN: 'Q881', TH: 'Q869', MY: 'Q833', ID: 'Q252',
    SG: 'Q334', AU: 'Q408', NL: 'Q55', HK: 'Q8646',
    US: 'Q30', CL: 'Q298', ZA: 'Q258', PL: 'Q36',
    SE: 'Q34', CH: 'Q39', BE: 'Q31', AT: 'Q40',
    ES: 'Q29', FI: 'Q33', DK: 'Q35', NO: 'Q20',
};

/**
 * Query Wikidata for corporate hierarchy (subsidiaries or parent companies).
 *
 * @param {string} companyName - Company to find relatives for
 * @returns {Promise<Array<{name: string, country: string, source: string, confidence: string, relation: string}>>}
 */
async function getCorporateHierarchy(companyName) {
    if (!companyName || companyName.length < 3) return [];

    const cKey = cacheKey('wikidata_hierarchy', companyName);
    const cached = await cacheGet(cKey);
    if (cached) return cached;

    console.log(`[Wikidata] Searching hierarchy for "${companyName}"...`);

    const sparql = `
SELECT ?relative ?relativeLabel ?countryCode ?relation WHERE {
  SERVICE wikibase:mwapi {
      bd:serviceParam wikibase:api "EntitySearch" .
      bd:serviceParam wikibase:endpoint "www.wikidata.org" .
      bd:serviceParam mwapi:search "${companyName}" .
      bd:serviceParam mwapi:language "en" .
      ?company wikibase:apiOutputItem mwapi:item .
  }
  
  {
    ?company wdt:P355 ?relative . # subsidiary
    BIND("subsidiary" AS ?relation)
  } UNION {
    ?relative wdt:P355 ?company . # parent
    BIND("parent" AS ?relation)
  } UNION {
    ?company wdt:P127 ?relative . # owned by
    BIND("parent" AS ?relation)
  } UNION {
    ?relative wdt:P127 ?company . # owns
    BIND("subsidiary" AS ?relation)
  }

  OPTIONAL { 
    ?relative wdt:P17 ?countryObj .
    ?countryObj wdt:P298 ?countryCode . # ISO-3166-1 alpha-3
  }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 5
`.trim();

    try {
        const data = await httpGet(WIKIDATA_SPARQL, {
            source: 'wikidata',
            params: { query: sparql, format: 'json' },
            headers: {
                'User-Agent': 'SupplyChainXRay/2.0 (supply-chain-research; contact@syn3rgy.ai)',
                'Accept': 'application/sparql-results+json',
            },
            timeout: 15000,
        });

        const results = [];
        if (data?.results?.bindings) {
            data.results.bindings.forEach(b => {
                if (b.relativeLabel?.value) {
                    results.push({
                        name: b.relativeLabel.value,
                        country: b.countryCode?.value?.substring(0, 2) || 'XX',
                        source: 'wikidata-hierarchy',
                        confidence: 'INFERRED',
                        relation: b.relation?.value || 'related'
                    });
                }
            });
        }

        if (results.length > 0) {
            await cacheSet(cKey, results, 86400 * 7);
        }
        return results;
    } catch (err) {
        console.warn(`[Wikidata] Hierarchy query failed for ${companyName}: ${err.message}`);
        return [];
    }
}

/**
 * Simple search for a company by name on Wikidata.
 */
async function searchCompany(companyName, countryIso) {
    if (!companyName) return null;

    const query = `
SELECT ?company ?companyLabel ?countryLabel ?website ?description WHERE {
  SERVICE wikibase:mwapi {
      bd:serviceParam wikibase:api "EntitySearch" .
      bd:serviceParam wikibase:endpoint "www.wikidata.org" .
      bd:serviceParam mwapi:search "${companyName}" .
      bd:serviceParam mwapi:language "en" .
      ?company wikibase:apiOutputItem mwapi:item .
  }
  ?company wdt:P31/wdt:P279* wd:Q4830453 . # instance of business
  OPTIONAL { ?company wdt:P17 ?country . ?country wdt:P297 ?countryCode . }
  OPTIONAL { ?company wdt:P856 ?website . }
  OPTIONAL { 
    ?company schema:description ?description .
    FILTER(LANG(?description) = "en")
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 1
`;

    try {
        const data = await httpGet(WIKIDATA_SPARQL, {
            source: 'wikidata',
            params: { query, format: 'json' },
            headers: { 'Accept': 'application/sparql-results+json' },
            timeout: 10000
        });

        if (data?.results?.bindings?.length > 0) {
            const b = data.results.bindings[0];
            return {
                name: b.companyLabel?.value || companyName,
                country: b.countryCode?.value || countryIso || 'XX',
                source: 'wikidata',
                website: b.website?.value || '',
                description: b.description?.value || '',
                confidence: 'VERIFIED'
            };
        }
    } catch (err) {
        console.warn(`[Wikidata] Search failed for ${companyName}: ${err.message}`);
    }
    return null;
}

/**
 * Fuzzy search fallback.
 */
async function searchCompanyFuzzy(companyName, countryIso) {
    return searchCompany(companyName, countryIso); // Standard search is already fuzzy via MWAPI
}

module.exports = { 
    getCompaniesByIndustryAndCountry, 
    getIndustryForHS, 
    getCorporateHierarchy,
    searchCompany,
    searchCompanyFuzzy,
    HS_TO_INDUSTRY_QID 
};
