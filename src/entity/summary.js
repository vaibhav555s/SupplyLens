const { httpPost } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Uses Groq to generate a short, real-time summary of a company's role
 * in the supply chain. Used for on-demand tooltips to save API tokens
 * and avoid rate limits.
 */
async function generateCompanySummary(companyName, countryCode) {
    if (!config.groqApiKey) {
        return "AI insights unavailable (Missing API Key).";
    }

    const key = cacheKey('summary', companyName, countryCode || 'unknown');
    const cached = await cacheGet(key);
    if (cached) {
        return cached;
    }

    console.log(`[LLM] Generating on-demand summary for "${companyName}"...`);

    const prompt = `Provide a concise, 2 or 3 sentence summary of what the company "${companyName}" ${countryCode ? `(located in ${countryCode})` : ''} produces or its role in the global supply chain. Do not use formatting like bolding. Be objective and factual.`;

    try {
        const response = await httpPost(GROQ_API_URL, {
            model: 'llama-3.3-70b-versatile',
            max_tokens: 150,
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content: 'You are a global supply chain intelligence assistant.'
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
            timeout: 10000, // 10 seconds max for fast UI response
            source: 'groq_ondemand' 
        });

        const text = response?.choices?.[0]?.message?.content || 'No summary available.';
        
        // Cache for 7 days since company summaries rarely change
        await cacheSet(key, text.trim(), 604800);
        
        return text.trim();
    } catch (err) {
        console.error(`[LLM] Error generating summary for "${companyName}": ${err.message}`);
        return "Could not generate AI summary at this time.";
    }
}

module.exports = { generateCompanySummary };
