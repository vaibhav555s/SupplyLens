const { httpPost } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const config = require('../config');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Uses a deterministic rules engine to generate a contextual summary of a company.
 * Completely replaces all LLM logic to guarantee 0 rate limit errors and instant speed.
 */
async function generateCompanySummary(companyName, countryCode, context = {}) {
    const { rootCompany, tier, hsnCodes, sector, data_source } = context;

    // Fast deterministic text builder
    let text = `${companyName} acts as a critical link in the deep-tier supply chain${rootCompany ? ` for ${rootCompany}` : ''}. `;
    
    if (tier !== undefined && tier > 0) {
        text += `Positioned as a Tier ${tier} entity, it provides fundamental input components and bulk routing. `;
    }

    if (hsnCodes && hsnCodes.length > 0) {
        text += `Trade tracking indicates flow of commodities categorized under HS Code(s) [${hsnCodes.join(', ')}]. `;
    }

    if (data_source) {
        text += `This connection is mapped via structured global trade records (${data_source}), demonstrating active cross-border logistics. `;
    }
    
    if (countryCode && ['CN', 'RU', 'IR', 'KP'].includes(countryCode.toUpperCase())) {
        text += `Because it operates in a high-risk jurisdiction (${countryCode}), it introduces elevated geopolitical or sanctions risk to the extended supply network.`;
    } else if (countryCode) {
        text += `Based out of ${countryCode}, it supports regional market stability.`;
    }

    return text.trim();
}

module.exports = { generateCompanySummary };
