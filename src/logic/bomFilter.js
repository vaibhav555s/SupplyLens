/**
 * BOM Filter v2 — Supply Chain Input Relevancy Module
 *
 * Priority order:
 *   1. bomTree.json prefix-match   → instant, deterministic (no API)
 *   2. Clear-irrelevant chapter set → instant chapter-level prune
 *   3. LLM check                   → only for genuinely ambiguous high-volume codes
 *
 * Existing filterBOM() signature is preserved — all callers in builder.js continue to work.
 */

const path = require('path');
const bomTree = require('../data/bomTree.json');
const llmChecker = require('./llmChecker');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const { normalizeToHS6 } = require('../utils/hsn');

// HS chapters that are always irrelevant to manufacturing supply chains.
// Paper(48), Office plastics(39 partial), Furniture(94), Misc(96), Arms(93)
const ALWAYS_IRRELEVANT_CHAPTERS = new Set([48, 94, 96, 93, 82]);

/**
 * Get the 4-digit heading prefix from a normalised HS6.
 * e.g. "870899" → "8708"
 */
function heading4(hs6) {
    return hs6.replace('.', '').substring(0, 4);
}

/**
 * Find the best bomTree entry for a given parent HS code.
 * First tries exact 6-digit match, then 4-digit prefix match.
 * Returns null if not found.
 */
function getBomEntry(parentHs6) {
    // Try exact key first
    const directKey = Object.keys(bomTree).find(k => k.replace('.', '') === parentHs6.replace('.', ''));
    if (directKey) return bomTree[directKey];

    // Try 4-digit prefix match
    const prefix4 = heading4(parentHs6);
    const prefixKey = Object.keys(bomTree).find(k => k.replace('.', '').startsWith(prefix4));
    if (prefixKey) return bomTree[prefixKey];

    return null;
}

/**
 * Filter candidate HS codes against a parent HS code.
 *
 * @param {string} parentHs - Parent commodity HS code (any format)
 * @param {Array<string|{hsn: string, shipment_count?: number}>} candidateHscodes
 * @returns {Promise<{kept: string[], pruned: {hsn: string, reason: string}[], filterMethod: string}>}
 */
async function filterBOM(parentHs, candidateHscodes) {
    if (!parentHs || !candidateHscodes || candidateHscodes.length === 0) {
        return { kept: candidateHscodes, pruned: [], filterMethod: 'passthrough' };
    }

    const pHs6 = normalizeToHS6(parentHs);
    const validInputPrefixes = getBomEntry(pHs6);

    // No bomTree entry — unknown parent product, pass everything through (safe fallback)
    if (validInputPrefixes === null) {
        console.log(`[BOM v2] No bomTree entry for ${pHs6} — passthrough mode.`);
        const kept = candidateHscodes.map(c => (typeof c === 'string' ? c : c.hsn));
        return { kept, pruned: [], filterMethod: 'no-bom-entry' };
    }

    // Terminal node — raw material, no upstream inputs
    if (validInputPrefixes.length === 0) {
        const pruned = candidateHscodes.map(c => ({
            hsn: typeof c === 'string' ? c : c.hsn,
            reason: 'Terminal node — raw material with no upstream'
        }));
        return { kept: [], pruned, filterMethod: 'terminal' };
    }

    const kept = [];
    const pruned = [];
    const ambiguous = [];

    console.log(`[BOM v2] Parent: ${pHs6} | validPrefixes: [${validInputPrefixes.join(',')}] | candidates: ${candidateHscodes.length}`);

    for (const raw of candidateHscodes) {
        const hsn = typeof raw === 'string' ? raw : raw.hsn;
        const shipmentCount = typeof raw === 'object' ? (raw.shipment_count || 0) : 0;
        const cHs6 = normalizeToHS6(hsn);
        if (!cHs6) continue;

        const prefix4 = heading4(cHs6);
        const parentPrefix4 = heading4(pHs6);
        const chapter = parseInt(prefix4.substring(0, 2), 10);

        // 1. Same heading match — if it's the same category (e.g. motors to motors), keep it
        if (prefix4 === parentPrefix4) {
            kept.push(cHs6);
            continue;
        }

        // 2. bomTree prefix match — instant deterministic decision
        const matchesTree = validInputPrefixes.some(v => v.replace('.', '').substring(0, 4) === prefix4);
        if (matchesTree) {
            kept.push(cHs6);
            continue;
        }

        // 2. Always-irrelevant chapter — instant prune
        if (ALWAYS_IRRELEVANT_CHAPTERS.has(chapter)) {
            pruned.push({ hsn: cHs6, reason: 'Prefix mismatch — irrelevant HS chapter (office/furniture/paper)' });
            continue;
        }

        // 3. Check Redis cache for previous LLM decisions
        const cKey = cacheKey('bom_filter_v2', pHs6, cHs6);
        const cached = await cacheGet(cKey);
        if (cached !== null) {
            if (cached.isInput) {
                kept.push(cHs6);
            } else {
                pruned.push({ hsn: cHs6, reason: `Cached: ${cached.reasoning}` });
            }
            continue;
        }

        // 4. Genuinely ambiguous — only escalate to LLM if high-volume supplier
        if (shipmentCount > 50) {
            ambiguous.push({ hsn: cHs6, shipmentCount, cKey });
        } else {
            pruned.push({ hsn: cHs6, reason: 'Prefix mismatch — not a direct production input' });
        }
    }

    // LLM batch check — only for ambiguous high-volume codes
    if (ambiguous.length > 0) {
        console.log(`[BOM v2] LLM check for ${ambiguous.length} ambiguous high-volume codes...`);
        for (const item of ambiguous) {
            try {
                const llmResult = await llmChecker.checkRelevanceWithLLM(pHs6, item.hsn);
                await cacheSet(item.cKey, llmResult, 2592000); // 30-day cache
                if (llmResult.isInput) {
                    kept.push(item.hsn);
                } else {
                    pruned.push({ hsn: item.hsn, reason: llmResult.reasoning || 'LLM: not a direct material input' });
                }
            } catch (err) {
                // LLM failed — default to keep (safe)
                console.warn(`[BOM v2] LLM failed for ${item.hsn}: ${err.message} — keeping by default`);
                kept.push(item.hsn);
            }
        }
    }

    if (kept.length === 0 && candidateHscodes.length > 0) {
        console.log(`[BOM v2] Strict filtering removed all candidates. Falling back to passthrough to prevent pipeline collapse.`);
        const fallbackKept = candidateHscodes.map(c => (typeof c === 'string' ? c : c.hsn));
        return { kept: fallbackKept, pruned: [], filterMethod: 'passthrough-fallback' };
    }

    console.log(`[BOM v2] Results for ${pHs6}: kept=${kept.length}, pruned=${pruned.length}, filterMethod=prefix-first`);
    return { kept, pruned, filterMethod: 'prefix-first' };
}

module.exports = { filterBOM };
