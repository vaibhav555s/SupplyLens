/**
 * HSN Inference v2
 *
 * Priority:
 *   1. Exact registry lookup  → instant, deterministic
 *   2. Fuzzy registry lookup  → substring / partial match
 *   3. LLM fallback           → only if registry misses
 */

const { httpPost } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');
const { jsonrepair } = require('jsonrepair');
const registry = require('../data/hsnRegistry.json');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Build a lookup-ready version of the registry (lowercase keys, stripped punctuation)
const REGISTRY_KEYS = Object.keys(registry).filter(k => !k.startsWith('_'));

/**
 * Normalize a company name for registry matching.
 */
function normalizeCompanyKey(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

/**
 * Find the best registry entry for a given company name.
 * Returns null if no match found.
 */
function registryLookup(companyName) {
    const key = normalizeCompanyKey(companyName);

    // Step 1 — exact match
    if (registry[key]) {
        console.log(`[HSN v2] Registry exact match: "${key}"`);
        return { codes: registry[key], source: 'registry-exact' };
    }

    // Step 2 — fuzzy substring match (registry key is substring of company name or vice versa)
    const fuzzyKey = REGISTRY_KEYS.find(rk => {
        const nrk = normalizeCompanyKey(rk);
        return key.includes(nrk) || nrk.includes(key);
    });

    if (fuzzyKey) {
        console.log(`[HSN v2] Registry fuzzy match: "${companyName}" → "${fuzzyKey}"`);
        return { codes: registry[fuzzyKey], source: 'registry-fuzzy' };
    }

    return null;
}

/**
 * Infer HS codes for a company using the LLM.
 * (Existing logic, unchanged — now only called as fallback)
 */
async function inferWithLLM(companyName) {
    if (!config.groqApiKey) {
        throw new Error('Groq API Key is required for LLM fallback HSN inference');
    }

    const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.2-1b-preview'];
    let lastError;

    for (const model of models) {
        try {
            const response = await httpPost(GROQ_API_URL, {
                model,
                max_tokens: 1000,
                temperature: 0.1,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: 'You are a global supply chain trade expert. Output only valid JSON.',
                    },
                    {
                        role: 'user',
                        content: `Identify the top 6 most likely imported products (and their real 6-digit HSN codes) for the company "${companyName}".
Return ONLY a JSON object with a single key "hsnCodes" containing an array of objects.
IMPORTANT: DO NOT just copy generic examples. The HSN codes MUST accurately reflect "${companyName}"'s primary industry.
Each object must have exactly these keys:
"code" (string, the realistic 6-digit HSN code),
"description" (string, short product description).`,
                    },
                ],
            }, {
                headers: {
                    'Authorization': `Bearer ${config.groqApiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            });

            const text = response?.choices?.[0]?.message?.content || '';

            let parsed;
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error('No JSON found');
                parsed = JSON.parse(jsonMatch[0]);
            } catch {
                const start = text.indexOf('{');
                if (start === -1) throw new Error('No JSON found');
                parsed = JSON.parse(jsonrepair(text.slice(start)));
            }

            return parsed.hsnCodes || [];
        } catch (err) {
            lastError = err;
            console.warn(`[HSN v2] LLM model ${model} failed: ${err.message}. Trying next...`);
        }
    }

    throw lastError;
}

/**
 * Main entry point — infer HS codes for a company.
 * Returns an array of HSN code objects (same format as before).
 *
 * @param {string} companyName
 * @returns {Promise<Array>}
 */
async function inferCompanyHSNCodes(companyName) {
    const cKey = cacheKey('hsn_infer_v2', companyName);
    const cached = await cacheGet(cKey);
    if (cached) {
        console.log(`[HSN v2] Cache hit for "${companyName}"`);
        return cached;
    }

    /* 
    // Step 1 & 2 — registry lookup (DISABLED — Per user request for 100% extraction)
    const registryResult = registryLookup(companyName);
    if (registryResult) {
        ...
    }
    */

    // Step 3 — LLM fallback
    console.log(`[HSN v2] Registry miss for "${companyName}" — calling LLM...`);
    try {
        const result = await inferWithLLM(companyName);
        if (result.length > 0) {
            await cacheSet(cKey, result, 86400);
        }
        return result;
    } catch (err) {
        console.error(`[HSN v2] All sources failed for "${companyName}": ${err.message}`);
        return [];
    }
}

module.exports = { inferCompanyHSNCodes };
