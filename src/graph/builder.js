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
    { "id": "company_hq", "label": "Company Name", "type": "root", "country": "US", "tier": 0, "risk_score": 10 }
  ],
  "edges": [
    { "id": "e1", "source": "supplier_1", "target": "company_hq", "type": "supplies", "hsn": "8501.53", "confidence": "INFERRED" }
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
3. "edges" array MUST connect nodes from Tier (N) to Tier (N-1). For example, Tier 6 connects to Tier 5.
4. All IDs must be unique strings, e.g., "supplier_1", "root", "sub_2".
5. Node types should be: "root", "manufacturer", "distributor", "assembler", "raw_material", "miner", "chemical".
6. Include "risk_score" (1-100) and "country" (2-letter code) for every node.
7. Each edge MUST have an "hsn" property describing what is being supplied, and "confidence" set to "INFERRED".

Return ONLY a strictly valid JSON object matching this schema: ${schema}. Do not include any markdown formatting or explanations.`;

    try {
        const response = await httpPost(GROQ_API_URL, {
            model: 'llama-3.3-70b-versatile',
            max_tokens: 6000,
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: [
                { role: 'system', content: 'Output ONLY valid JSON representing the supply chain graph.' },
                { role: 'user', content: prompt }
            ],
        }, {
            headers: {
                'Authorization': `Bearer ${config.groqApiKey} `
            },
            timeout: 30000,
        });

        const text = response?.choices?.[0]?.message?.content || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Invalid output format");

        const parsed = JSON.parse(jsonMatch[0]);

        // Ensure root ID is consistent and expected by frontend
        const rootNode = parsed.nodes.find(n => n.tier === 0);
        if (rootNode) rootNode.id = 'root';

        // Cache for 24h
        if (parsed.nodes && parsed.edges) {
            await cacheSet(key, parsed, 86400);
        }

        return parsed;
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
