const resolver = require('../entity/resolver');
const { cacheSet } = require('../utils/redis');

async function testSpeed() {
    const companies = [
        { name: 'Tesla Inc', country: 'US' },
        { name: 'Samsung Electronics', country: 'KR' },
        { name: 'TSMC', country: 'TW' }
    ];

    console.time('Parallel Resolve');
    const results = await resolver.batchResolve(companies);
    console.timeEnd('Parallel Resolve');

    console.log(`Resolved ${Object.keys(results).length} companies.`);
    process.exit(0);
}

testSpeed();
