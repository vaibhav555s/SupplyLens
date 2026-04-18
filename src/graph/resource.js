const { httpPost } = require('../utils/http');
const config = require('../config');
const { extractJson } = require('./builder');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Uses LLM to instantly "pivot" and generate a safe alternative supplier for a disrupted node.
 * 
 * @param {string} nodeId - The ID of the disrupted node
 * @param {string} hsn - The commodity HSN code supplied by the disrupted node
 * @param {number} tier - The tier level of the targeted node
 * @param {string} parentId - The ID of the parent node this new supplier should attach to
 * @returns {Promise<object>} { nodes: [...], edges: [...] }
 */
async function generateAlternativeSupplier(nodeId, hsn, tier, parentId) {
    if (!config.groqApiKey) {
        throw new Error('Groq API Key is required for generating alternatives');
    }

    console.log(`[LLM] Resolving safe alternative for node ${nodeId} (Tier ${tier}, HSN ${hsn}) connecting to ${parentId}...`);

    const schema = `
{
  "nodes": [
    { 
      "id": "new_safe_supplier_1", 
      "label": "VinFast Battery Group", 
      "productName": "Lithium Ion Batteries",
      "type": "manufacturer", 
      "country": "VN", 
      "tier": 2, 
      "country_risk_score": 38,
      "gpr_score": 25,
      "sanctions_flag": false,
      "data_source": "AI Recon Engine",
      "data_source_detail": "High-confidence safe jurisdiction pivot",
      "lat": 14.05, 
      "lng": 108.27 
    }
  ],
  "edges": [
    { "id": "e_pivot_1", "source": "new_safe_supplier_1", "target": "root", "type": "supplies", "hsn": "8507.60", "confidence": "HIGH" }
  ]
}`;

    const prompt = `You are an AI Sourcing Agent. A disruption has occurred in a supply chain node.
Your job is to generate a replacement supplier that provides HSN/Commodity: ${hsn || 'Component'}.
The new supplier MUST connect to the parent node with ID: "${parentId}".
The new supplier MUST sit at Tier level: ${tier}.
CRITICAL: The new supplier MUST be located in a safe, non-sanctioned, friendly jurisdiction (e.g. VN, TH, MX, IN, MY).
DO NOT use CN, RU, IR, or KP for the country. Provide realistic coordinates for the country chosen.

Return ONLY a strictly valid JSON object matching this schema: ${schema}. Do not include any HTML, markdown, or explanations.`;

    const models = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-8b-8192'];
    let lastError;

    for (const model of models) {
        try {
            const response = await httpPost(GROQ_API_URL, {
                model: model,
                max_tokens: 1500,
                temperature: 0.5,
                response_format: { type: "json_object" },
                messages: [
                    { role: 'system', content: 'Output ONLY valid JSON representing the new alternative supplier path.' },
                    { role: 'user', content: prompt }
                ],
            }, {
                headers: {
                    'Authorization': `Bearer ${config.groqApiKey}`
                },
                timeout: 30000,
            });

            const text = response?.choices?.[0]?.message?.content || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
                throw new Error("Invalid output format: JSON not found");
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Guarantee topology 
            if (parsed.edges && parsed.edges.length > 0) {
                parsed.edges[0].target = parentId;
            }

            return parsed;
        } catch (err) {
            lastError = err;
            console.warn(`[LLM] Model ${model} failed for AI Pivot: ${err.message}. Trying next...`);
        }
    }
    
    throw lastError;
}

module.exports = { generateAlternativeSupplier };
