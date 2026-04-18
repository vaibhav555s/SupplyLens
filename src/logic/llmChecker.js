/**
 * LLM Checker - Binary HSN Relevance Analysis
 * Uses LLM to determine if a candidate HS code is a material input for a parent HS code.
 */

const { httpPost } = require('../utils/http');
const config = require('../config');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Checks if a candidate HS code is a material input for a parent HS code using LLM.
 *
 * @param {string} parentHs - The parent commodity HS code
 * @param {string} candidateHs - The candidate input HS code
 * @returns {Promise<{isInput: boolean, reasoning: string}>}
 */
async function checkRelevanceWithLLM(parentHs, candidateHs) {
    if (!config.groqApiKey) {
        return { isInput: true, reasoning: 'LLM check skipped: No API key' };
    }

    const systemMsg = `You are a Supply Chain Expert. Determine if the Candidate HS Code is a DIRECT MATERIAL INPUT or COMPONENT required to manufacture the Parent Commodity.

Parent HS Code: ${parentHs}
Candidate HS Code: ${candidateHs}

Rules:
1. YES if the candidate is a raw material, physical component, or sub-assembly of the parent.
2. NO if the candidate is an office supply, laptop, protective gear, packaging (unless specialized), or general logistics equipment.
3. Be strict. Only YES if it is part of the Bill of Materials (BOM).`

    const userMsg = `Parent: ${parentHs}
Candidate: ${candidateHs}

Is the candidate a material input or component for the parent?
Answer format: YES/NO | Reason`;

    try {
        const response = await httpPost(GROQ_API_URL, {
            model: 'llama-3.1-8b-instant', // Fast model for binary checks
            max_tokens: 100,
            temperature: 0.1, // High determinism
            messages: [
                { role: 'system', content: systemMsg },
                { role: 'user', content: userMsg },
            ],
        }, {
            headers: { 'Authorization': `Bearer ${config.groqApiKey}` },
            timeout: 10000,
        });

        const text = response?.choices?.[0]?.message?.content?.trim() || '';
        const isYes = text.toUpperCase().startsWith('YES');
        
        // Robust parsing for reasoning after many possible delimiters
        const delimiterMatch = text.match(/[|:-]/);
        let reasoning = 'No reasoning provided.';
        if (delimiterMatch) {
            reasoning = text.substring(text.indexOf(delimiterMatch[0]) + 1).trim();
        } else if (text.length > 5) {
            reasoning = text; // Just use the whole thing if it's long enough
        }

        return {
            isInput: isYes,
            reasoning: reasoning
        };
    } catch (err) {
        console.warn(`[BOM Filter/LLM] Check failed: ${err.message}`);
        return { isInput: true, reasoning: `Fallback: LLM failed (${err.message})` };
    }
}

/**
 * Batch version of relevance check.
 * Since we want to minimize latency, we could batch these but for now we'll do them in parallel
 * with a limit if needed.
 */
async function batchCheckRelevance(parentHs, candidateHscodes) {
    // For now, simple implementation
    return Promise.all(candidateHscodes.map(code => checkRelevanceWithLLM(parentHs, code)));
}

module.exports = {
    checkRelevanceWithLLM,
    batchCheckRelevance
};
