// ─── LLM Fallback Entity Resolver ───
// Uses Groq API to resolve unknown companies.
// All results marked confidence: "INFERRED"

const { httpPost } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Use Groq API to infer company identity when structured sources fail.
 *
 * @param {string} companyName - Company name to resolve
 * @param {string} [countryHint] - Optional country context
 * @param {string} [industryHint] - Optional industry context
 * @returns {Promise<object|null>} PRD Entity Object with confidence: "INFERRED"
 */
async function resolveEntity(companyName, countryHint, industryHint) {
    if (!config.groqApiKey) {
        console.warn('[LLM] No Groq API key configured — skipping LLM fallback');
        return null;
    }

    const key = cacheKey('llm_entity', companyName, countryHint || '');
    const cached = await cacheGet(key);
    if (cached) {
        console.log(`[LLM] Cache hit for "${companyName}"`);
        return cached;
    }

    console.log(`[LLM] Resolving "${companyName}" via Groq (Llama 3)...`);

    try {
        const prompt = buildPrompt(companyName, countryHint, industryHint);

        const response = await httpPost(GROQ_API_URL, {
            model: 'llama3-70b-8192',
            max_tokens: 500,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        }, {
            source: 'llm',
            headers: {
                'Authorization': `Bearer ${config.groqApiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });

        const entity = parseGroqResponse(response, companyName, countryHint);

        if (entity) {
            await cacheSet(key, entity, config.cacheTTL.entityResolution);
        }

        return entity;
    } catch (err) {
        console.error(`[LLM] Error resolving "${companyName}": ${err.message}`);
        return null;
    }
}

/**
 * Build a structured prompt for entity resolution.
 */
function buildPrompt(companyName, countryHint, industryHint) {
    let context = '';
    if (countryHint) context += ` The company is likely based in or associated with ${countryHint}.`;
    if (industryHint) context += ` The company operates in the ${industryHint} industry.`;

    return `You are a supply chain research assistant. Identify the following company and provide structured information.

Company name: "${companyName}"${context}

Respond with ONLY a valid JSON object with these fields. Use null if unknown for a specific field, but "unknown: true" if you completely don't know the company.
{
  "canonical_name": "The official/legal company name",
  "country": "ISO 3166-1 alpha-2 country code of headquarters",
  "industry": "Primary industry/sector",
  "parent_company": "Parent company name if known, otherwise null",
  "known_products": ["List of major products/components they manufacture or supply"],
  "description": "One-sentence description of what this company does"
}`;
}

/**
 * Parse Groq API response to PRD Entity Object.
 */
function parseGroqResponse(response, companyName, countryHint) {
    try {
        const text = response?.choices?.[0]?.message?.content || '';

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.unknown || !parsed.canonical_name) {
            console.log(`[LLM] Could not identify "${companyName}"`);
            return null;
        }

        return {
            node_id: `llm_${companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            name: parsed.canonical_name || companyName,
            country: parsed.country || countryHint || '',
            node_type: 'COMPANY',
            lat: null,
            lng: null,
            confidence: 'INFERRED',
            source: 'llm',
            extra: {
                industry: parsed.industry || '',
                parent_company: parsed.parent_company || '',
                known_products: parsed.known_products || [],
                description: parsed.description || '',
                inference_model: 'llama3-70b-8192',
            },
        };
    } catch (err) {
        console.error(`[LLM] Failed to parse response for "${companyName}": ${err.message}`);
        return null;
    }
}

module.exports = { resolveEntity };
