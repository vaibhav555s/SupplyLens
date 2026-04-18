/**
 * Search History — localStorage persistence for the Supplier Dashboard.
 * Saves/loads/deletes company search results so they appear on /dashboard.
 */

const STORAGE_KEY = 'scxray_search_history';

/**
 * Generate a simple unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Get all saved searches, sorted most-recent first.
 * @returns {Array<object>}
 */
export function getHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return parsed.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
        return [];
    }
}

/**
 * Save a new search entry (or update if same company already exists).
 * 
 * @param {object} params
 * @param {string} params.companyName
 * @param {string} params.country
 * @param {string} params.flag
 * @param {Array<string>} params.hsnCodes
 * @param {object} params.graphData  — the full { nodes, edges } from the builder
 */
export function saveSearch({ companyName, country, flag, hsnCodes, graphData }) {
    const history = getHistory();

    // Extract Tier-1 suppliers from graph data
    const tier1Suppliers = (graphData?.nodes || [])
        .filter(n => n.tier === 1)
        .map(n => ({
            label: n.label,
            country: n.country,
            type: n.type,
            risk_score: n.risk_score,
        }));

    // Compute risk flags
    const allNodes = graphData?.nodes || [];
    const sanctions = allNodes.filter(n => n.sanctions === true).length;
    const highRisk = allNodes.filter(n => !n.sanctions && (n.risk_score || 0) > 70).length;
    const clear = allNodes.filter(n => !n.sanctions && (n.risk_score || 0) <= 70).length;

    // Compute concentration risk (most common country among non-root nodes)
    const countryCounts = {};
    allNodes.filter(n => n.tier > 0).forEach(n => {
        if (n.country) countryCounts[n.country] = (countryCounts[n.country] || 0) + 1;
    });
    const totalSuppliers = allNodes.filter(n => n.tier > 0).length;
    let concentrationRisk = null;
    if (totalSuppliers > 0) {
        const topCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0];
        if (topCountry) {
            const pct = Math.round((topCountry[1] / totalSuppliers) * 100);
            if (pct > 25) {
                concentrationRisk = { country: topCountry[0], percentage: pct };
            }
        }
    }

    // Determine max tier
    const maxTier = Math.max(...allNodes.map(n => n.tier || 0), 0);

    const entry = {
        id: generateId(),
        companyName,
        country: country || 'US',
        flag: flag || '🏢',
        hsnCodes: hsnCodes || [],
        timestamp: Date.now(),
        tier1Suppliers,
        tier1Count: tier1Suppliers.length,
        totalNodes: allNodes.length,
        maxTier,
        riskFlags: { sanctions, highRisk, clear },
        concentrationRisk,
    };

    // Remove existing entry for same company (upsert behavior)
    const filtered = history.filter(
        h => h.companyName.toLowerCase() !== companyName.toLowerCase()
    );
    filtered.unshift(entry);

    // Keep max 20 entries
    const trimmed = filtered.slice(0, 20);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
        console.warn('[SearchHistory] Failed to save:', e);
    }

    return entry;
}

/**
 * Delete a specific search entry by ID.
 * @param {string} id
 */
export function deleteSearch(id) {
    const history = getHistory().filter(h => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/**
 * Clear all search history.
 */
export function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
}
