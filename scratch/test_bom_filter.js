const { filterBOM } = require('../src/logic/bomFilter');

async function testFilter() {
    console.log("--- BOM Filter Logic Test ---");

    // Parent: Electric Motors (8501.53)
    const parentHS = "8501.53";
    const candidates = [
        "8503.00", // Parts for motors (Structural - Kept)
        "7208.27", // Flat-rolled iron (Raw material - Kept)
        "4819.10", // Cartons, boxes (Packaging - Pruned)
        "3926.90", // Other plastics (Ambiguous - LLM fallback)
        "8471.30", // Laptops (Office supply - Pruned)
    ];

    console.log(`Filtering candidates for Parent HS: ${parentHS}`);
    
    try {
        const result = await filterBOM(parentHS, candidates);
        console.log("\nResults:");
        console.log("KEPT:", result.kept);
        console.log("PRUNED:", result.pruned);
        
        // Verification assertions
        if (result.kept.includes("8503.00") && result.pruned.includes("4819.10") && result.pruned.includes("8471.30")) {
            console.log("\n✅ Deterministic filtering working as expected.");
        } else {
            console.log("\n❌ Deterministic filtering results unexpected.");
        }
    } catch (err) {
        console.error("Filter test failed:", err.message);
    }
}

testFilter();
