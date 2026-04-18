const { httpPost } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Builds a dynamic 3-tier supply chain graph using Llama 3 based on 
 * the root company and selected HSN codes.
 * 
 * @param {string} companyName Root company name
 * @param {string} country Root company country (e.g. US)
 * @param {Array<string>} hsnCodes Array of 6-digit HSN codes selected by user
 * @returns {Promise<object>} { nodes, edges }
 */
async function buildSupplyChainGraph(companyName, country = 'US', hsnCodes = []) {
    if (!config.groqApiKey) {
        throw new Error('Groq API Key is required for Graph Building');
    }

    const hsnString = hsnCodes.join(',') || 'general components';
    const key = cacheKey('graph_build', companyName, hsnString);
    const cached = await cacheGet(key);
    if (cached) {
        return cached;
    }

    console.log(`[LLM] Building supply chain graph for "${companyName}" on HSN [${hsnString}]...`);

    const schema = `
{
  "nodes": [
    { 
      "id": "root", 
      "label": "Company Name", 
      "productName": "Electric Vehicles",
      "type": "root", 
      "country": "US", 
      "tier": 0, 
      "country_risk_score": 88,
      "gpr_score": 50,
      "sanctions_flag": false,
      "data_source": "ImportYeti (Bill of Lading)",
      "data_source_detail": "US Customs Import Records",
      "lat": 37.7749, 
      "lng": -122.4194 
    }
  ],
  "edges": [
    { "id": "e1", "source": "supplier_1", "target": "root", "type": "supplies", "hsn": "8501.53", "confidence": "INFERRED" },
    { "id": "e2", "source": "sub_supplier_1", "target": "supplier_1", "type": "supplies", "hsn": "8501.53", "confidence": "INFERRED" }
  ]
}`;

    const prompt = `You are an expert supply chain graph generator.
Construct a deeply realistic 6-tier supply chain map for the root company "${companyName}" (Country: ${country}).
The map must be driven by the importation of these specific commodities / HSN codes: ${hsnString}.

Requirements:
1. "nodes" array MUST include the root company (tier: 0, id: "root").
2. "nodes" array MUST adhere to exactly 6 upstream tiers:
   - Tier 1: 3-5 Direct Suppliers (assemblies)
   - Tier 2: 4-6 Foreign Shippers / Sub-Suppliers
   - Tier 3: 4-6 Component Material Producers
   - Tier 4: 3-5 Raw Material Producers
   - Tier 5: 3-5 Mining Inputs & Extraction Services
   - Tier 6: 2-4 Raw Inputs to Mining Operations (Terminal Tier)
3. "edges" array MUST connect nodes from Tier (N) to Tier (N-1). For example, Tier 6 connects to Tier 5, and Tier 1 connects to Tier 0 ("root").
4. All IDs must be unique strings, e.g., "supplier_1", "root", "sub_2".
5. Node types should be: "root", "manufacturer", "distributor", "assembler", "raw_material", "miner", "chemical".
6. Include "productName" describing the specific product/commodity the node produces or supplies.
7. Include specific risk scores and data source metadata: "country_risk_score" (1-100), "gpr_score" (number), "sanctions_flag" (boolean), "data_source" (string, e.g. 'ImportYeti' or 'LLM-inferred'), "data_source_detail" (string). Also include "country" (2-letter code) and geographical coordinates ("lat", "lng").
8. Each edge MUST have an "hsn" property describing what is being supplied, and "confidence" set to "INFERRED".

Return ONLY a strictly valid JSON object matching this schema: ${schema}. Do not include any markdown formatting or explanations.`;

    try {
        const models = ['llama-3.1-8b-instant', 'llama3-8b-8192', 'mixtral-8x7b-32768'];
        let lastError;

        for (const model of models) {
            try {
                const response = await httpPost(GROQ_API_URL, {
                    model: model,
                    max_tokens: 6000,
                    temperature: 0.3,
                    response_format: { type: "json_object" },
                    messages: [
                        { role: 'system', content: 'Output ONLY valid JSON representing the supply chain graph.' },
                        { role: 'user', content: prompt }
                    ],
                }, {
                    headers: {
                        'Authorization': `Bearer ${config.groqApiKey}`
                    },
                    timeout: 45000,
                });

                const text = response?.choices?.[0]?.message?.content || '';
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    console.error(`[LLM Debug] Raw text from ${model}:`, text);
                    throw new Error("Invalid output format");
                }

                let parsed;
                try {
                    parsed = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    console.error(`[LLM Debug] JSON parse error from ${model}:`, e.message, "\\nSnippet:", jsonMatch[0].slice(0, 200));
                    throw new Error("Invalid JSON format");
                }

                // Ensure root ID is consistent and expected by frontend
                const rootNode = parsed.nodes.find(n => n.tier === 0);
                if (rootNode && rootNode.id !== 'root') {
                    const oldId = rootNode.id;
                    rootNode.id = 'root';
                    
                    // Rewire any edges pointing to the old ID
                    if (parsed.edges && Array.isArray(parsed.edges)) {
                        parsed.edges.forEach(edge => {
                            if (edge.source === oldId) edge.source = 'root';
                            if (edge.target === oldId) edge.target = 'root';
                        });
                    }
                }

                // Cache for 24h
                if (parsed.nodes && parsed.edges) {
                    await cacheSet(key, parsed, 86400);
                }

                return parsed;
            } catch (err) {
                lastError = err;
                console.warn(`[LLM] Model ${model} failed for Graph Builder: ${err.message}. Trying next...`);
            }
        }
        
        throw lastError;
    } catch (err) {
        console.error(`[LLM] Error building graph for "${companyName}": ${err.message} `);
        // Return minimal safe graph
        return {
            nodes: [
                { id: 'root', label: companyName, type: 'root', country: country, tier: 0, risk_score: 10 }
            ],
            edges: []
        };
    }
}

module.exports = { buildSupplyChainGraph };
