// ─── HSN Code Normalisation Utility ───
// Handles cross-country HS code normalisation as specified in PRD Section 4.5

/**
 * Country-specific HS code digit lengths.
 * WCO standard is 6, but countries extend with national digits.
 */
const NATIONAL_FORMATS = {
    US: 10,  // HTS — 10 digits
    IN: 8,   // HSN — 8 digits
    EU: 8,   // CN  — 8 digits
    CN: 10,  // GB  — 10 digits
    GB: 10,  // UK  — 10 digits
    DE: 8,   // EU CN
    FR: 8,
    IT: 8,
    JP: 9,   // Japan — 9 digits
    KR: 10,  // Korea — 10 digits
};

/**
 * Normalize any HS/HSN/HTS code to 6-digit WCO base.
 * Strips dots, spaces, and truncates to 6 digits.
 *
 * @param {string} code - Raw HS code in any national format
 * @returns {string} 6-digit WCO base code
 *
 * @example
 * normalizeToHS6("8501.53.4000") // → "850153"
 * normalizeToHS6("8501 5300")    // → "850153"
 * normalizeToHS6("850153")       // → "850153"
 * normalizeToHS6("85015300")     // → "850153"
 */
function normalizeToHS6(code) {
    if (!code) return '';
    // Remove dots, spaces, dashes
    const clean = String(code).replace(/[\s.\-]/g, '');
    // Take first 6 digits
    return clean.substring(0, 6);
}

/**
 * Expand a 6-digit WCO base to national format by padding with zeros.
 *
 * @param {string} hs6 - 6-digit WCO code
 * @param {string} countryIso - ISO 3166-1 alpha-2 country code
 * @returns {string} Padded code in national format
 *
 * @example
 * expandToNational("850153", "US") // → "8501530000"
 * expandToNational("850153", "IN") // → "85015300"
 */
function expandToNational(hs6, countryIso) {
    const base = normalizeToHS6(hs6);
    const targetLen = NATIONAL_FORMATS[countryIso?.toUpperCase()] || 6;
    return base.padEnd(targetLen, '0');
}

/**
 * Extract the 2-digit HS Chapter from any code.
 * Used for stop-condition checking (Chapters 01–27 = raw materials).
 *
 * @param {string} code - Any HS code format
 * @returns {number} Chapter number (1-99)
 *
 * @example
 * getChapter("850153") // → 85
 * getChapter("2709.00") // → 27  (crude petroleum — raw material)
 */
function getChapter(code) {
    const hs6 = normalizeToHS6(code);
    return parseInt(hs6.substring(0, 2), 10) || 0;
}

/**
 * Check if an HS code represents a raw material (Chapters 01–27).
 * These are traversal stop conditions — no meaningful upstream.
 *
 * @param {string} code
 * @returns {boolean}
 */
function isRawMaterial(code) {
    const chapter = getChapter(code);
    return chapter >= 1 && chapter <= 27;
}

/**
 * Format a 6-digit code as dotted (e.g., "850153" → "8501.53").
 * Useful for human-readable display.
 *
 * @param {string} hs6
 * @returns {string}
 */
function formatDotted(hs6) {
    const clean = normalizeToHS6(hs6);
    if (clean.length < 4) return clean;
    return `${clean.substring(0, 4)}.${clean.substring(4)}`;
}

module.exports = {
    normalizeToHS6,
    expandToNational,
    getChapter,
    isRawMaterial,
    formatDotted,
    NATIONAL_FORMATS,
};
