// ─── Module 2 — Entity Resolution Barrel Export ───

const opencorporates = require('./opencorporates');
const wikidata = require('./wikidata');
const nominatim = require('./nominatim');
const llmFallback = require('./llm_fallback');
const resolver = require('./resolver');
const summary = require('./summary');

module.exports = {
    opencorporates,
    wikidata,
    nominatim,
    llmFallback,
    resolver,
    summary,
};
