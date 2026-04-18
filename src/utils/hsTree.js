/**
 * HS Tree Utilities - Deterministic HS Hierarchy Analysis
 * Implements heuristics to determine if a candidate HS code is a material input
 * for a parent HS code based on the WCO nomenclature hierarchy.
 */

const { getChapter, normalizeToHS6 } = require('./hsn');

/**
 * Returns the 4-digit Heading of an HS code.
 */
function getHeading(code) {
    const hs6 = normalizeToHS6(code);
    return hs6.substring(0, 4);
}

/**
 * Deterministically check if a candidate HS code is likely a structural input to a parent HS code.
 *
 * @param {string} parentHs - The parent commodity HS code
 * @param {string} candidateHs - The candidate input HS code
 * @returns {boolean|null} true if likely input, false if likely irrelevant, null if ambiguous (LLM should decide)
 */
function isStructuralInput(parentHs, candidateHs) {
    if (!parentHs || !candidateHs) return null;

    const pChap = getChapter(parentHs);
    const cChap = getChapter(candidateHs);
    const pHead = getHeading(parentHs);
    const cHead = getHeading(candidateHs);

    // 1. Raw Material Check (Chapters 01-27)
    // If the candidate is a raw material, it's almost always a valid "terminal" input
    // unless the parent is also a raw material of the same type.
    if (cChap >= 1 && cChap <= 27) {
        if (pChap === cChap && parseInt(pHead) <= parseInt(cHead)) {
            // Same chapter, but candidate is potentially more processed or the same
            return null; // Ambiguous
        }
        return true;
    }

    // 2. Packaging / Logistics / Office Supplies (Chapters 48, 49, 94)
    // 48: Paper, Cardboard (usually packaging/admin)
    // 49: Printed matter
    // 94: Furniture, Signs (usually office setup)
    const irrelevantChapters = [48, 49, 94];
    if (irrelevantChapters.includes(cChap)) {
        // Exception: if the parent product IS a paper product, then it's a valid input
        if (irrelevantChapters.includes(pChap)) return null;
        return false;
    }

    // 1. Heading check: If the headings don't match or aren't known material inputs, it might be irrelevant.
    if (pHead === cHead) return true;

    // 2. Parts check: In many machinery chapters (84, 85, 87, 90), certain headings are dedicated parts.
    // e.g., 8503 is parts for 8501.
    const machineryChapters = [84, 85, 87, 88, 90];
    if (machineryChapters.includes(pChap) && pChap === cChap) {
        return true;
    }

    // 3. Ambiguous check: Same Chapter but different heading.
    if (pChap === cChap) return null;

    // 4. Industry-Specific Heuristics
    
    // (A) Electronics (Chapter 85)
    if (pChap === 85) {
        // Valid inputs: Chemicals (28/29/38), Plastics (39), Base Metals (72-81), Machinery parts (84)
        const validElectronicsInputs = [28, 29, 38, 39, 72, 73, 74, 75, 76, 81, 84];
        if (validElectronicsInputs.includes(cChap)) return null; // Mark as ambiguous to let LLM refine specific pairs like (Motor -> Laptop)
        
        // Specific Heading: 8542 (Integrated Circuits)
        if (pHead === '8542') {
            if (cHead === '3818') return true; // Silicon wafers
        }
    }

    // (B) Automotive (Chapter 87)
    if (pChap === 87) {
        // Valid inputs: Rubber (40), Glass (70), Steel (72), Electronics (85), Parts (84)
        const validAutoInputs = [40, 70, 72, 84, 85];
        if (validAutoInputs.includes(cChap)) return true;
    }

    // 5. Hierarchy Heuristic
    // If the candidate chapter is much HIGHER than the parent, it's often a more complex assembly.
    // Usually, supply chains flow from lower chapters to higher chapters.
    // Note: This is a weak heuristic, so we use it as a "likely false" hint if it's very far off.
    if (cChap > pChap + 20) {
        // Example: Parent is Steel (72), Candidate is Furniture (94).
        return false;
    }

    // Fallback: If no deterministic rule hits, mark as ambiguous for LLM
    return null;
}

module.exports = {
    isStructuralInput,
    getHeading,
    getChapter
};
