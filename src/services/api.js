/**
 * Frontend API Service
 * Connects the React UI to the Module 1 & 2 Backend.
 */

const api = {
    /**
     * Resolve a company name to a canonical entity (Module 2)
     */
    async resolveCompany(name, country = '') {
        const response = await fetch(`/api/entity/resolve?name=${encodeURIComponent(name)}&country=${country}`);
        if (!response.ok) throw new Error('Resolution failed');
        return await response.json();
    },

    /**
     * Infer real-time dynamic HSN codes for presentation
     */
    async inferHSNCodes(name) {
        const response = await fetch(`/api/entity/hsn-infer?company=${encodeURIComponent(name)}`);
        if (!response.ok) throw new Error('HSN Inference failed');
        return await response.json();
    },

    /**
     * Build dynamic N-tier supply chain graph (Module 3)
     */
    async buildGraph(company, country = 'US', hsnCodes = []) {
        const hsnKeys = hsnCodes.join(',');
        const response = await fetch(`/api/graph/build?company=${encodeURIComponent(company)}&country=${country}&hsnKeys=${encodeURIComponent(hsnKeys)}`);
        if (!response.ok) throw new Error('Graph Build failed');
        return await response.json();
    },

    /**
     * Search for shipments (Module 1 - ImportYeti)
     */
    async getShipments(company) {
        const response = await fetch(`/api/connectors/importyeti?company=${encodeURIComponent(company)}`);
        if (!response.ok) throw new Error('Failed to fetch shipments');
        return await response.json();
    },

    /**
     * Lookup HS Code description (Module 1 - USITC/Comtrade)
     */
    async lookupHSCode(code) {
        const response = await fetch(`/api/utils/normalize-hs?code=${encodeURIComponent(code)}`);
        if (!response.ok) throw new Error('HS Lookup failed');
        return await response.json();
    }
};

export default api;
