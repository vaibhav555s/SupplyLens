// ─── Supply Chain X-Ray API Server ───
// Express server exposing REST endpoints for Module 1 & 2.

const express = require('express');
const config = require('./config');
const connectors = require('./connectors');
const entity = require('./entity');

const app = express();
app.use(express.json());

// ─── Health Check ───
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        modules: { m1_connectors: true, m2_entity: true },
        timestamp: new Date().toISOString(),
    });
});

// ═══════════════════════════════════════════════
// MODULE 1 — Data Connector Endpoints
// ═══════════════════════════════════════════════

// ImportYeti: search company shipments
app.get('/api/connectors/importyeti', async (req, res) => {
    try {
        const { company } = req.query;
        if (!company) return res.status(400).json({ error: 'Missing ?company= parameter' });

        const records = await connectors.importyeti.searchCompany(company);
        res.json({
            source: 'importyeti',
            company,
            count: records.length,
            records,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Zauba: search Indian trade data
app.get('/api/connectors/zauba', async (req, res) => {
    try {
        const { company, type } = req.query;
        if (!company) return res.status(400).json({ error: 'Missing ?company= parameter' });

        const records = await connectors.zauba.searchCompany(company, type || 'import');
        res.json({
            source: 'zauba',
            company,
            trade_type: type || 'import',
            count: records.length,
            records,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UN Comtrade: country-to-country trade flows
app.get('/api/connectors/comtrade', async (req, res) => {
    try {
        const { reporter, hs_code, period, flow } = req.query;
        if (!reporter || !hs_code) {
            return res.status(400).json({ error: 'Missing ?reporter= and ?hs_code= parameters' });
        }

        const records = await connectors.comtrade.queryTradeFlows(reporter, hs_code, {
            period: period || '2023',
            flowCode: flow || 'M',
        });

        res.json({
            source: 'comtrade',
            reporter,
            hs_code,
            count: records.length,
            records,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// USITC: HS code description lookup
app.get('/api/connectors/usitc', async (req, res) => {
    try {
        const { hs_code, keyword } = req.query;

        if (keyword) {
            const results = await connectors.usitc.searchByKeyword(keyword);
            return res.json({ source: 'usitc', keyword, count: results.length, results });
        }

        if (!hs_code) {
            return res.status(400).json({ error: 'Missing ?hs_code= or ?keyword= parameter' });
        }

        const result = await connectors.usitc.lookupHSCode(hs_code);
        res.json({ source: 'usitc', result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════
// MODULE 2 — Entity Resolution Endpoints
// ═══════════════════════════════════════════════

// Full entity resolution (orchestrator)
app.get('/api/entity/resolve', async (req, res) => {
    try {
        const { name, country, skipLLM } = req.query;
        if (!name) return res.status(400).json({ error: 'Missing ?name= parameter' });

        const result = await entity.resolver.resolveEntity(
            name,
            country || null,
            { skipLLM: skipLLM === 'true' }
        );

        if (!result) {
            return res.status(404).json({ error: `Could not resolve entity: ${name}` });
        }

        res.json({ source: 'resolver', entity: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dynamically infer HSN codes for a company
app.get('/api/entity/hsn-infer', async (req, res) => {
    try {
        const { company } = req.query;
        if (!company) return res.status(400).json({ error: 'Missing company parameter' });

        const { inferCompanyHSNCodes } = require('./entity/hsn_infer');
        const codes = await inferCompanyHSNCodes(company);
        res.json({ company, hsnCodes: codes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dynamically construct supply chain graph (Module 3)
app.get('/api/graph/build', async (req, res) => {
    try {
        const { company, country, hsnKeys } = req.query;
        if (!company) return res.status(400).json({ error: 'Missing company parameter' });

        const hsnCodes = hsnKeys ? hsnKeys.split(',') : [];
        const { buildSupplyChainGraph } = require('./graph/builder');

        const graphData = await buildSupplyChainGraph(company, country || 'US', hsnCodes);
        res.json(graphData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// OpenCorporates only
app.get('/api/entity/opencorporates', async (req, res) => {
    try {
        const { name, country } = req.query;
        if (!name) return res.status(400).json({ error: 'Missing ?name= parameter' });

        const result = await entity.opencorporates.searchCompany(name, country);
        res.json({ source: 'opencorporates', entity: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Wikidata only
app.get('/api/entity/wikidata', async (req, res) => {
    try {
        const { name, country } = req.query;
        if (!name) return res.status(400).json({ error: 'Missing ?name= parameter' });

        const result = await entity.wikidata.searchCompany(name, country);
        res.json({ source: 'wikidata', entity: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Nominatim geocoding
app.get('/api/entity/geocode', async (req, res) => {
    try {
        const { query, country } = req.query;
        if (!query && !country) {
            return res.status(400).json({ error: 'Missing ?query= or ?country= parameter' });
        }

        let result;
        if (country && !query) {
            result = await entity.nominatim.geocodeCountry(country);
        } else {
            result = await entity.nominatim.geocode(query);
        }

        res.json({ source: 'nominatim', result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Batch entity resolution
app.post('/api/entity/batch', async (req, res) => {
    try {
        const { companies } = req.body;
        if (!companies || !Array.isArray(companies)) {
            return res.status(400).json({ error: 'Body must contain { companies: [{name, country?}] }' });
        }

        const results = await entity.resolver.batchResolve(companies);
        res.json({
            source: 'resolver',
            requested: companies.length,
            resolved: Object.keys(results).length,
            entities: results,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// On-demand AI Company Summary
app.get('/api/entity/summary', async (req, res) => {
    try {
        const { company, country } = req.query;
        if (!company) return res.status(400).json({ error: 'Missing company parameter' });

        const summaryText = await entity.summary.generateCompanySummary(company, country);
        res.json({ source: 'llm', company, summary: summaryText });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════
// HSN Utilities
// ═══════════════════════════════════════════════
const hsn = require('./utils/hsn');

app.get('/api/utils/normalize-hs', (req, res) => {
    const { code, country } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing ?code= parameter' });

    res.json({
        input: code,
        hs6: hsn.normalizeToHS6(code),
        chapter: hsn.getChapter(code),
        is_raw_material: hsn.isRawMaterial(code),
        dotted: hsn.formatDotted(code),
        national: country ? hsn.expandToNational(code, country) : undefined,
    });
});

// ─── Start Server ───
app.listen(config.port, () => {
    console.log(`
  ⬡ Supply Chain X-Ray API Server
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Port:     ${config.port}
  Env:      ${config.nodeEnv}

  Module 1 — Data Connectors:
    GET /api/connectors/importyeti?company=Tesla
    GET /api/connectors/zauba?company=Tesla
    GET /api/connectors/comtrade?reporter=US&hs_code=850153
    GET /api/connectors/usitc?hs_code=850153

  Module 2 — Entity Resolution:
    GET /api/entity/resolve?name=Tesla&country=US
    GET /api/entity/opencorporates?name=Tesla
    GET /api/entity/wikidata?name=Samsung
    GET /api/entity/geocode?query=Tokyo,Japan
    POST /api/entity/batch

  Utilities:
    GET /api/utils/normalize-hs?code=8501.53.4000
    GET /api/health
  `);
});

module.exports = app;
