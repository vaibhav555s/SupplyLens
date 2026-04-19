const http = require('http');

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                else resolve(JSON.parse(data));
            });
        }).on('error', reject);
    });
}

async function testExpansion() {
    try {
        console.log('Testing graph build for Tesla [8501.53]...');
        const data = await get('http://localhost:3000/api/graph/build?company=Tesla&hsn=850153');
        
        const nodes = data.nodes || [];
        const edges = data.edges || [];
        
        console.log(`\nResults:`);
        console.log(`- Total Nodes: ${nodes.length}`);
        console.log(`- Total Edges: ${edges.length}`);
        
        const tier1 = nodes.filter(n => n.tier === 1);
        console.log(`- Tier 1 Suppliers: ${tier1.length}`);
        tier1.forEach(n => console.log(`  - ${n.label} (${n.productName})`));
        
        const deepTier = nodes.filter(n => n.tier >= 3);
        console.log(`- Deep Tier Nodes (T3+): ${deepTier.length}`);
        
        const sanctioned = nodes.filter(n => n.sanctions_flag);
        console.log(`- Sanctioned/Risk Nodes: ${sanctioned.length}`);

    } catch (err) {
        console.error('Test failed:', err.message);
    }
}

testExpansion();
