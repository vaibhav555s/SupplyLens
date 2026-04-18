/**
 * BOM Filter - Supply Chain Input Relevancy Module
 * Responsibility: Filter candidate HS codes to ensure they are true material inputs for a parent product.
 */

const hsTree = require('../utils/hsTree');
const llmChecker = require('./llmChecker');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const { normalizeToHS6 } = require('../utils/hsn');

/**
 * Filter a list of candidate HS codes against a parent HS code.
 *
 * @param {string} parentHs - The parent commodity HS code
 * @param {string[]} candidateHscodes - Array of candidate input HS codes
 * @returns {Promise<{kept: string[], pruned: {hsn: string, reason: string}[]}>}
 */
async function filterBOM(parentHs, candidateHscodes) {
    if (!parentHs || !candidateHscodes || candidateHscodes.length === 0) {
        return { kept: candidateHscodes, pruned: [] };
    }

    const pHs6 = normalizeToHS6(parentHs);
    const results = { kept: [], pruned: [] };

    console.log(`[BOM Filter] Analysing ${candidateHscodes.length} candidates for parent ${pHs6}...`);

    for (const rawCandidate of candidateHscodes) {
        const cHs6 = normalizeToHS6(rawCandidate);
        if (!cHs6) continue;

        // Step 1: Deterministic Check (HS Tree Utils)
        const deterministicResult = hsTree.isStructuralInput(pHs6, cHs6);

        if (deterministicResult === true) {
            results.kept.push(cHs6);
            continue;
        } else if (deterministicResult === false) {
            results.pruned.push({ hsn: cHs6, reason: 'Deterministic: Irrelevant HS Chapter/Heading hierarchy' });
            continue;
        }

        // Step 2: Cache Check (Redis)
        const cKey = cacheKey('bom_filter', pHs6, cHs6);
        const cachedResult = await cacheGet(cKey);

        if (cachedResult !== null) {
            if (cachedResult.isInput) {
                results.kept.push(cHs6);
            } else {
                results.pruned.push({ hsn: cHs6, reason: `Cached: ${cachedResult.reasoning}` });
            }
            continue;
        }

        // Step 3: LLM Check (Ambiguous Case)
        console.log(`[BOM Filter] Ambiguous pair (${pHs6} -> ${cHs6}). Calling LLM...`);
        const llmResult = await llmChecker.checkRelevanceWithLLM(pHs6, cHs6);

        // Store result in cache (TTL: 30 days)
        await cacheSet(cKey, llmResult, 2592000);

        if (llmResult.isInput) {
            results.kept.push(cHs6);
        } else {
            results.pruned.push({ hsn: cHs6, reason: llmResult.reasoning });
        }
    }

    console.log(`[BOM Filter] Results: Kept ${results.kept.length}, Pruned ${results.pruned.length}`);
    return results;
}

module.exports = { filterBOM };
