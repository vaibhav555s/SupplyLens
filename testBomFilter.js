const { filterBOM } = require('./src/logic/bomFilter');
const { connectDB } = require('./src/db/connection'); // If needed, though bomFilter primarily uses Redis.
const config = require('./src/config');
require('dotenv').config();

async function runTest() {
    console.log("=== Testing BOM Filter ===");

    // We simulate candidate objects to see how bomFilter behaves.
    const parentHs = '8542.31'; // Integrated Circuits
    
    const candidates = [
        { hsn: '3818.00', shipment_count: 100 }, // Silicon Wafers (Should be YES/Kept via hsTree/bomTree)
        { hsn: '4819.10', shipment_count: 200 }, // Paperboard boxes (Should be NO/Pruned via hsTree)
        { hsn: '8504.40', shipment_count: 5 },   // Converters (Low volume, ambiguous -> likely pruned)
        { hsn: '3926.90', shipment_count: 200 }  // General plastics (Ambiguous, high volume -> LLM check)
    ];

    try {
        console.log(`Parent HS: ${parentHs}`);
        console.log(`Candidates: ${candidates.map(c => c.hsn).join(', ')}`);
        
        const result = await filterBOM(parentHs, candidates);
        
        console.log("\n[RESULT]");
        console.log("Kept:", result.kept);
        console.log("Pruned:");
        result.pruned.forEach(p => console.log(`  - ${p.hsn}: ${p.reason}`));
        
        console.log("\nFilter Method applied:", result.filterMethod);
        
        // Let's run it again to test Redis Cache hits
        console.log("\n=== Testing Cache Hit ===");
        const result2 = await filterBOM(parentHs, candidates);
        console.log("\n[RESULT 2]");
        console.log("Kept:", result2.kept);
        console.log("Pruned:");
        result2.pruned.forEach(p => console.log(`  - ${p.hsn}: ${p.reason}`));

    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        process.exit(0);
    }
}

runTest();
