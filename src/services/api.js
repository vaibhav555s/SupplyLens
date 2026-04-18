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
     * Use AI to generate a safe alternative supplier (AI Pivot)
     */
    async resourceSupplier(nodeId, hsn, tier, parentId) {
        const params = new URLSearchParams({ nodeId, hsn: hsn || '', tier: tier || 1, parentId: parentId || 'root' });
        const response = await fetch(`/api/graph/resource?${params.toString()}`);
        if (!response.ok) throw new Error('Resource failure');
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

    async lookupHSCode(code) {
        const response = await fetch(`/api/utils/normalize-hs?code=${encodeURIComponent(code)}`);
        if (!response.ok) throw new Error('HS Lookup failed');
        return await response.json();
    },

    /**
     * Get contextual AI summary of a company's role in the supply chain
     */
    async getCompanySummary(company, country = '', context = {}) {
        const params = new URLSearchParams({ company, country });
        if (context.rootCompany) params.set('rootCompany', context.rootCompany);
        if (context.tier !== undefined) params.set('tier', context.tier);
        if (context.hsnCodes?.length) params.set('hsnCodes', context.hsnCodes.join(','));
        if (context.sector) params.set('sector', context.sector);
        if (context.confidence) params.set('confidence', context.confidence);

        const response = await fetch(`/api/entity/summary?${params.toString()}`);
        if (!response.ok) throw new Error('Summary fetch failed');
        return await response.json();
    },

    // ── Authentication ──

    _token: null,

    setToken(token) {
        this._token = token;
    },

    getAuthHeaders() {
        if (!this._token) throw new Error('No auth token available');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this._token}`
        };
    },

    async login(credentials) {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Login failed');
        return data;
    },

    async register(userData) {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Registration failed');
        return data;
    },

    async getMe() {
        const response = await fetch('/api/auth/me', {
            headers: this.getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get user');
        return data;
    },

    // ── Dashboard Persistence (MongoDB) ──

    async getDashboardHistory() {
        const response = await fetch('/api/dashboard/history', {
            headers: this.getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch dashboard history');
        return data;
    },

    async saveDashboardEntry({ companyName, country, flag, hsnCodes, graphData }) {
        const response = await fetch('/api/dashboard/save', {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ companyName, country, flag, hsnCodes, graphData }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to save dashboard entry');
        return data;
    },

    async deleteDashboardEntry(id) {
        const response = await fetch(`/api/dashboard/${id}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete entry');
        return data;
    },

    async clearDashboard() {
        const response = await fetch('/api/dashboard/clear', {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to clear dashboard');
        return data;
    },
};

export default api;
