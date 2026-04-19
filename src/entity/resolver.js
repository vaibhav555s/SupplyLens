// ─── Entity Resolution Orchestrator ───
// Tries resolution sources in priority order:
// 1. OpenCorporates (most reliable legal entity data)
// 2. Wikidata (large known companies, parent/subsidiary)
// 3. Nominatim (geocoding only — adds lat/lng)
// 4. LLM fallback (last resort — result marked INFERRED)
//
// Returns unified PRD Entity Object.

const opencorporates = require('./opencorporates');
const wikidata = require('./wikidata');
const nominatim = require('./nominatim');
const llmFallback = require('./llm_fallback');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');

/**
 * Resolve a fuzzy company name to a canonical entity record.
 * Tries each source in priority order, enriches with geocoding.
 *
 * @param {string} companyName - Fuzzy company name
 * @param {string} [countryIso] - Optional country hint (ISO alpha-2)
 * @param {object} [options]
 * @param {boolean} [options.skipLLM] - Skip LLM fallback
 * @param {boolean} [options.forceRefresh] - Bypass cache
 * @returns {Promise<object|null>} PRD Entity Object
 */
async function resolveEntity(companyName, countryIso, options = {}) {
    if (!companyName) return null;

    const { skipLLM = false, forceRefresh = false } = options;

    // Check unified cache first
    const key = cacheKey('entity_resolved', companyName, countryIso || 'any');
    if (!forceRefresh) {
        const cached = await cacheGet(key);
        if (cached) {
            console.log(`[Resolver] Cache hit for "${companyName}"`);
            return cached;
        }
    }

    console.log(`[Resolver] Resolving "${companyName}" (${countryIso || 'unknown country'})...`);

    let entity = null;
    let resolutionPath = [];

    // ─── Step 1: Parallel Search (OpenCorporates & Wikidata) ───
    try {
        const [ocPromise, wikiPromise] = [
            opencorporates.searchCompany(companyName, countryIso).catch(err => {
                console.warn(`[Resolver] OpenCorporates failed: ${err.message}`);
                return null;
            }),
            wikidata.searchCompany(companyName, countryIso).catch(err => {
                console.warn(`[Resolver] Wikidata failed: ${err.message}`);
                return null;
            })
        ];

        const [ocEntity, wikiEntity] = await Promise.all([ocPromise, wikiPromise]);

        if (ocEntity) {
            entity = ocEntity;
            resolutionPath.push('opencorporates');
        }

        if (wikiEntity) {
            if (!entity) {
                entity = wikiEntity;
                resolutionPath.push('wikidata');
            } else {
                entity = enrichEntity(entity, wikiEntity);
                resolutionPath.push('wikidata_enrich');
            }
        }
    } catch (err) {
        console.error(`[Resolver] Parallel search error: ${err.message}`);
    }

    // ─── Step 1b: Fallback to Wikidata Fuzzy if still no entity ───
    if (!entity) {
        try {
            entity = await wikidata.searchCompanyFuzzy(companyName, countryIso);
            if (entity) {
                resolutionPath.push('wikidata_fuzzy');
                console.log(`[Resolver] ✓ Wikidata fuzzy: "${entity.name}" (${entity.country})`);
            }
        } catch (err) {
            console.warn(`[Resolver] Wikidata fuzzy failed: ${err.message}`);
        }
    }

    // ─── Step 3: Nominatim geocoding ───
    if (entity && (!entity.lat || !entity.lng)) {
        try {
            // Try geocoding with company name + country
            const geoQuery = entity.extra?.registered_address ||
                `${entity.name}, ${entity.extra?.headquarters || entity.country}`;
            const geo = await nominatim.geocode(geoQuery);

            if (geo) {
                entity.lat = geo.lat;
                entity.lng = geo.lng;
                resolutionPath.push('nominatim');
                console.log(`[Resolver] ✓ Geocoded: ${geo.lat}, ${geo.lng}`);
            }
        } catch (err) {
            console.warn(`[Resolver] Nominatim failed: ${err.message}`);
        }
    }

    // If still no entity coords, at least get country centroid
    if (entity && (!entity.lat || !entity.lng) && entity.country) {
        try {
            const countryGeo = await nominatim.geocodeCountry(entity.country);
            if (countryGeo) {
                entity.lat = countryGeo.lat;
                entity.lng = countryGeo.lng;
                resolutionPath.push('nominatim_country');
            }
        } catch { /* ignore */ }
    }

    // ─── Step 4: LLM fallback ───
    if (!entity && !skipLLM) {
        try {
            entity = await llmFallback.resolveEntity(companyName, countryIso);
            if (entity) {
                resolutionPath.push('llm');
                console.log(`[Resolver] ⚠ LLM inferred: "${entity.name}" (${entity.country})`);

                // Try to geocode the LLM result
                if (entity.country) {
                    const countryGeo = await nominatim.geocodeCountry(entity.country);
                    if (countryGeo) {
                        entity.lat = countryGeo.lat;
                        entity.lng = countryGeo.lng;
                    }
                }
            }
        } catch (err) {
            console.warn(`[Resolver] LLM fallback failed: ${err.message}`);
        }
    }

    // ─── Finalize ───
    if (entity) {
        entity.resolution_path = resolutionPath;

        // Cache the resolved entity
        await cacheSet(key, entity, config.cacheTTL.entityResolution);
        console.log(`[Resolver] ✓ Resolved "${companyName}" via: ${resolutionPath.join(' → ')}`);
    } else {
        console.warn(`[Resolver] ✗ Could not resolve "${companyName}" from any source`);
    }

    return entity;
}

/**
 * Enrich a base entity with data from another source.
 */
function enrichEntity(base, additional) {
    return {
        ...base,
        // Prefer non-null lat/lng
        lat: base.lat || additional.lat,
        lng: base.lng || additional.lng,
        // Prefer non-empty country
        country: base.country || additional.country,
        // Merge extra data
        extra: {
            ...base.extra,
            ...additional.extra,
            // Keep both source IDs
            sources: [base.source, additional.source].filter(Boolean),
        },
    };
}

/**
 * Batch resolve multiple company names.
 *
 * @param {Array<{name: string, country?: string}>} companies
 * @returns {Promise<object>} Map of name → Entity Object
 */
async function batchResolve(companies) {
    const results = {};

    const resolvePromises = companies.map(async ({ name, country }) => {
        try {
            const entity = await resolveEntity(name, country);
            if (entity) {
                results[name] = entity;
            }
        } catch (err) {
            console.warn(`[Resolver] Batch: failed on "${name}": ${err.message}`);
        }
    });

    await Promise.all(resolvePromises);
    return results;
}

module.exports = { resolveEntity, batchResolve };
