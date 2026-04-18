// ─── Nominatim Geocoder ───
// Geocodes company addresses and country names → lat/lng.
// Rate limited: 1 request/sec per OSM usage policy.

const { httpGet } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');

const BASE_URL = 'https://nominatim.openstreetmap.org';

/**
 * Geocode a query string (company address, city, or country) to coordinates.
 *
 * @param {string} query - Free-form location query
 * @returns {Promise<{ lat: number, lng: number, display_name: string } | null>}
 */
async function geocode(query) {
    if (!query) return null;

    const key = cacheKey('nominatim', query);
    const cached = await cacheGet(key);
    if (cached) {
        console.log(`[Nominatim] Cache hit for "${query}"`);
        return cached;
    }

    console.log(`[Nominatim] Geocoding "${query}"...`);

    try {
        const data = await httpGet(`${BASE_URL}/search`, {
            source: 'nominatim',
            params: {
                q: query,
                format: 'jsonv2',
                limit: 1,
                addressdetails: 1,
            },
            headers: {
                'User-Agent': 'SupplyChainXRay/1.0 (academic-research; contact@supplychainxray.com)',
            },
            timeout: 10000,
        });

        if (!Array.isArray(data) || data.length === 0) {
            console.log(`[Nominatim] No results for "${query}"`);
            return null;
        }

        const result = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            display_name: data[0].display_name || '',
            country_code: data[0].address?.country_code?.toUpperCase() || '',
        };

        await cacheSet(key, result, config.cacheTTL.geocode);
        return result;
    } catch (err) {
        console.error(`[Nominatim] Geocoding error for "${query}": ${err.message}`);
        return null;
    }
}

/**
 * Geocode a country by ISO alpha-2 code.
 *
 * @param {string} countryIso
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
async function geocodeCountry(countryIso) {
    if (!countryIso) return null;

    // Common country centroids (avoid API call for frequent lookups)
    const CENTROIDS = {
        US: { lat: 39.8283, lng: -98.5795 },
        CN: { lat: 35.8617, lng: 104.1954 },
        JP: { lat: 36.2048, lng: 138.2529 },
        KR: { lat: 35.9078, lng: 127.7669 },
        DE: { lat: 51.1657, lng: 10.4515 },
        IN: { lat: 20.5937, lng: 78.9629 },
        TW: { lat: 23.6978, lng: 120.9605 },
        MX: { lat: 23.6345, lng: -102.5528 },
        CA: { lat: 56.1304, lng: -106.3468 },
        GB: { lat: 55.3781, lng: -3.436 },
        FR: { lat: 46.2276, lng: 2.2137 },
        IT: { lat: 41.8719, lng: 12.5674 },
        BR: { lat: -14.235, lng: -51.9253 },
        VN: { lat: 14.0583, lng: 108.2772 },
        TH: { lat: 15.87, lng: 100.9925 },
        MY: { lat: 4.2105, lng: 101.9758 },
        SG: { lat: 1.3521, lng: 103.8198 },
        AU: { lat: -25.2744, lng: 133.7751 },
        NL: { lat: 52.1326, lng: 5.2913 },
        ID: { lat: -0.7893, lng: 113.9213 },
        PH: { lat: 12.8797, lng: 121.774 },
        SA: { lat: 23.8859, lng: 45.0792 },
        AE: { lat: 23.4241, lng: 53.8478 },
        ZA: { lat: -30.5595, lng: 22.9375 },
        CL: { lat: -35.6751, lng: -71.543 },
    };

    const upper = countryIso.toUpperCase();
    if (CENTROIDS[upper]) return CENTROIDS[upper];

    // Fallback to Nominatim API
    return await geocode(upper);
}

module.exports = { geocode, geocodeCountry };
