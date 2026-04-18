// Quick test for USITC + Comtrade + Module 2
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
    console.log('=== USITC Test ===');
    const usitc = require('../src/connectors/usitc');
    const r1 = await usitc.lookupHSCode('850153');
    console.log(JSON.stringify(r1, null, 2));

    const r2 = await usitc.searchByKeyword('motor');
    console.log('Keyword search "motor": found', r2.length, 'results');
    r2.slice(0, 3).forEach(r => console.log('  ' + r.hs_code + ': ' + r.description));

    console.log('\n=== Comtrade Test ===');
    const comtrade = require('../src/connectors/comtrade');
    const r3 = await comtrade.queryTradeFlows('US', '850153');
    console.log('Trade partners found:', r3.length);
    r3.slice(0, 5).forEach(r =>
        console.log('  ' + r.source_country + ': $' + (r.trade_value / 1e6).toFixed(1) + 'M - ' + r.commodity.substring(0, 60))
    );

    console.log('\n=== Nominatim Test ===');
    const nominatim = require('../src/entity/nominatim');
    const geo = await nominatim.geocode('Tokyo, Japan');
    console.log('Tokyo:', JSON.stringify(geo));

    console.log('\n=== Wikidata Test ===');
    const wikidata = require('../src/entity/wikidata');
    const wiki = await wikidata.searchCompany('Samsung Electronics');
    console.log('Samsung:', JSON.stringify(wiki?.name), wiki?.country, wiki?.node_id);

    console.log('\n=== Entity Resolver Test ===');
    const resolver = require('../src/entity/resolver');
    const entity = await resolver.resolveEntity('Foxconn', 'TW', { skipLLM: true });
    console.log('Foxconn:', JSON.stringify(entity?.name), entity?.country, 'path:', entity?.resolution_path?.join(' -> '));

    console.log('\nDone!');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
