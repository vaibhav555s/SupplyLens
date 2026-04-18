const { httpPost } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Uses Groq to generate a contextual, supply-chain-aware summary of a company.
 * Instead of generic "what does X do", it explains WHY this company matters
 * in the context of the specific supply chain being analyzed.
 */
async function generateCompanySummary(companyName, countryCode, context = {}) {
    if (!config.groqApiKey) {
        return "AI insights unavailable (Missing API Key).";
    }

    const { rootCompany, tier, hsnCodes, sector, confidence } = context;

    // Include context in cache key for specificity
    const ctxKey = rootCompany ? `${rootCompany}-${tier}` : 'generic';
    const key = cacheKey('summary_v2', companyName, countryCode || 'unknown', ctxKey);
    const cached = await cacheGet(key);
    if (cached) {
        return cached;
    }

    console.log(`[LLM] Generating contextual summary for "${companyName}" in ${rootCompany || 'unknown'} supply chain...`);

    // Build a rich, contextual prompt
    const contextParts = [];
    if (rootCompany) contextParts.push(`We are analyzing the supply chain of "${rootCompany}".`);
    if (tier !== undefined) contextParts.push(`"${companyName}" sits at Tier ${tier} in this supply chain.`);
    if (hsnCodes && hsnCodes.length > 0) contextParts.push(`The traced commodity codes are: ${hsnCodes.join(', ')}.`);
    if (sector) contextParts.push(`This company operates in the "${sector}" sector.`);
    if (confidence) contextParts.push(`Its link to the supply chain is ${confidence === 'VERIFIED' ? 'verified through trade records (Bill of Lading)' : 'inferred via AI analysis'}.`);
    if (countryCode) contextParts.push(`It is based in ${countryCode}.`);

    const contextBlock = contextParts.length > 0 
        ? `Context:\n${contextParts.join('\n')}\n\n` 
        : '';

    const prompt = `${contextBlock}In 2-3 sentences, explain "${companyName}"'s specific role and strategic importance within ${rootCompany ? `"${rootCompany}"'s` : 'the'} supply chain. Focus on:
- What critical components, materials, or services it provides
- Why it matters for supply chain resilience (e.g. single-source risk, geopolitical exposure, market dominance)
- Any relevant supply chain risk factors (concentration, sanctions exposure, geographic vulnerability)

Be specific and analytical. Do not use generic descriptions. Do not use markdown formatting or bullet points. Write in a concise, intelligence-briefing style.`;

    try {
        const response = await httpPost(GROQ_API_URL, {
            model: 'llama-3.3-70b-versatile',
            max_tokens: 200,
            temperature: 0.3,
            messages: [
                {
                    role: 'system',
                    content: 'You are a senior supply chain risk analyst providing intelligence briefings. Your summaries are concise, contextual, and focus on strategic dependencies and risk factors. Never use bullet points, bold text, or markdown.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
        }, {
            headers: {
                'Authorization': `Bearer ${config.groqApiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 12000,
            source: 'groq_ondemand' 
        });

        const text = response?.choices?.[0]?.message?.content || 'No summary available.';
        
        // Cache for 3 days (contextual summaries may need refresh more often)
        await cacheSet(key, text.trim(), 259200);
        
        return text.trim();
    } catch (err) {
        console.error(`[LLM] Error generating summary for "${companyName}": ${err.message}`);
        return "Could not generate AI summary at this time.";
    }
}

module.exports = { generateCompanySummary };
