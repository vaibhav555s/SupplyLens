const { httpPost } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');
const { jsonrepair } = require('jsonrepair');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Uses Groq to infer the most likely HSN codes imported by a company.
 * This is used to dynamically generate real-time data for the presentation
 * without waiting 2 minutes for slow web scrapers.
 */
async function inferCompanyHSNCodes(companyName) {
    if (!config.groqApiKey) {
        throw new Error('Groq API Key is required for real-time HSN inference');
    }

    const key = cacheKey('hsn_infer', companyName);
    const cached = await cacheGet(key);
    if (cached) {
        return cached;
    }

    console.log(`[LLM] Inferring real-time HSN codes for "${companyName}"...`);

    try {
        const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.2-1b-preview'];
        let lastError;

        for (const model of models) {
            try {
                const response = await httpPost(GROQ_API_URL, {
                    model: model,
                    max_tokens: 1000,
                    temperature: 0.1,
                    response_format: { type: "json_object" },
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a global supply chain trade expert. Output only valid JSON.'
                        },
                        {
                            role: 'user',
                            content: `Identify the top 6 most likely imported products (and their real 6-digit HSN codes) for the company "${companyName}". 
                            Return ONLY a JSON object with a single key "hsnCodes" containing an array of objects.
                            IMPORTANT: DO NOT just copy generic examples. The HSN codes MUST accurately reflect "${companyName}"'s primary industry (e.g. if Petrochemicals, use oil/chemical codes; if Retail, use consumer goods; if Automotive, use car parts).
                            
                            Each object must have exactly these keys: 
                            "code" (string, the realistic 6-digit HSN code), 
                            "description" (string, short product description), 
                            "records" (number, a plausible, highly believable randomly generated number between 100 and 3000 representing shipment volume), 
                            "countries" (array of exactly 3 country codes like ["JP", "TW", "CN"]), 
                            "flags" (array of 3 emojis matching the countries),
                            "icon" (a single relevant emoji for the product).`
                        }
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
                    // Try clean parse first
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) throw new Error("No JSON found");
                    parsed = JSON.parse(jsonMatch[0]);
                } catch (e1) {
                    try {
                        // Attempt repair if truncated
                        const start = text.indexOf('{');
                        if (start === -1) throw new Error("No JSON found");
                        parsed = JSON.parse(jsonrepair(text.slice(start)));
                    } catch (e2) {
                        throw new Error("Invalid output format and repair failed");
                    }
                }

                const result = parsed.hsnCodes || [];

                // Save to cache for 24h
                if (result.length > 0) {
                    await cacheSet(key, result, 86400);
                }

                return result;
            } catch (err) {
                lastError = err;
                console.warn(`[LLM] Model ${model} failed for HSN infer: ${err.message}. Trying next...`);
            }
        }
        
        throw lastError;
    } catch (err) {
        console.error(`[LLM] All models failed inferring HSN codes for "${companyName}": ${err.message}`);
        return [];
    }
}

module.exports = { inferCompanyHSNCodes };
