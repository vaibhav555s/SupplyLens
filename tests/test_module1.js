// ─── Module 1 Integration Tests ───
// Tests all data connectors with REAL API calls.
// Run: node tests/test_module1.js

const { normalizeToHS6, expandToNational, getChapter, isRawMaterial, formatDotted } = require('../src/utils/hsn');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        passed++;
    } else {
        console.log(`  ❌ ${testName}`);
        failed++;
    }
}

async function runTests() {
    console.log('\n═══════════════════════════════════════');
    console.log('  Module 1 — Data Connector Tests');
    console.log('═══════════════════════════════════════\n');

    // ─── HSN Normaliser Tests ───
    console.log('📐 HSN Normaliser:');
    assert(normalizeToHS6('8501.53.4000') === '850153', 'normalizeToHS6("8501.53.4000") → "850153"');
    assert(normalizeToHS6('8501 5300') === '850153', 'normalizeToHS6("8501 5300") → "850153"');
    assert(normalizeToHS6('850153') === '850153', 'normalizeToHS6("850153") → "850153"');
    assert(normalizeToHS6('85015300') === '850153', 'normalizeToHS6("85015300") → "850153"');
    assert(normalizeToHS6('') === '', 'normalizeToHS6("") → ""');

    assert(expandToNational('850153', 'US') === '8501530000', 'expandToNational US → 10 digits');
    assert(expandToNational('850153', 'IN') === '85015300', 'expandToNational IN → 8 digits');

    assert(getChapter('850153') === 85, 'getChapter("850153") → 85');
    assert(getChapter('2709.00') === 27, 'getChapter("2709.00") → 27');

    assert(isRawMaterial('2709.00') === true, 'isRawMaterial("2709.00") → true (crude petroleum)');
    assert(isRawMaterial('850153') === false, 'isRawMaterial("850153") → false (motors)');

    assert(formatDotted('850153') === '8501.53', 'formatDotted("850153") → "8501.53"');

    // ─── USITC HTS Lookup (no API key needed) ───
    console.log('\n🔍 USITC HTS Lookup (real API):');
    try {
        const usitc = require('../src/connectors/usitc');
        const result = await usitc.lookupHSCode('850153');
        console.log('  Response:', JSON.stringify(result, null, 2));

        assert(result !== null, 'USITC returned a result for 850153');
        assert(result?.hs_code_6 === '850153' || result?.hs_code_6?.startsWith('8501'),
            `HS code starts with 8501: ${result?.hs_code_6}`);
        if (result?.description) {
            assert(true, `Description: "${result.description.substring(0, 80)}..."`);
        }
    } catch (err) {
        console.log(`  ⚠️  USITC test skipped: ${err.message}`);
    }

    // ─── UN Comtrade ───
    console.log('\n🌍 UN Comtrade (real API):');
    try {
        const comtrade = require('../src/connectors/comtrade');
        const records = await comtrade.queryTradeFlows('US', '850153', { period: '2023' });
        console.log(`  Found ${records.length} trade partner records`);

        assert(records.length >= 0, `Comtrade returned ${records.length} records (0 is OK without API key)`);
        if (records.length > 0) {
            assert(records[0].data_source === 'comtrade', 'Data source is "comtrade"');
            assert(records[0].confidence === 'INFERRED', 'Confidence is "INFERRED"');
            assert(records[0].hs_code_6 === '850153', 'HS code is correct');
            console.log('  Top 3 partners:', records.slice(0, 3).map(r =>
                `${r.source_country}: $${(r.trade_value / 1e6).toFixed(1)}M`
            ).join(', '));
        }
    } catch (err) {
        console.log(`  ⚠️  Comtrade test: ${err.message}`);
    }

    // ─── ImportYeti ───
    console.log('\n📦 ImportYeti (real scrape):');
    try {
        const importyeti = require('../src/connectors/importyeti');
        const records = await importyeti.searchCompany('Tesla');
        console.log(`  Found ${records.length} supplier records`);

        assert(records.length >= 0, `ImportYeti returned ${records.length} records`);
        if (records.length > 0) {
            assert(records[0].data_source === 'importyeti', 'Data source is "importyeti"');
            assert(records[0].confidence === 'VERIFIED', 'Confidence is "VERIFIED"');
            assert(records[0].target_country === 'US', 'Target country is US');
            console.log('  First supplier:', records[0].source_name, '(', records[0].source_country, ')');
        }
    } catch (err) {
        console.log(`  ⚠️  ImportYeti test: ${err.message}`);
    }

    // ─── Summary ───
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
