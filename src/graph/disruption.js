/**
 * BFS Disruption Simulator v2 — Supply Chain X-Ray
 *
 * Simulates the cascading effect of a single-node disruption across the supply chain.
 *
 * Model:
 *   - Edges are "supplier → consumer" (source supplies to target).
 *   - When a node is disrupted, all nodes that DEPEND on it (directly or transitively)
 *     through the supply chain are affected.
 *   - BFS traversal follows edges in REVERSE direction: from disrupted node UP toward root.
 *     i.e., if T3 is disrupted → affects T2 nodes it feeds → affects T1 → affects root.
 *
 * Output per affected node:
 *   - cascade_depth:     how many hops from the disruption point
 *   - impact_score:      0-100 (risk × country_risk × sanctions × depth decay)
 *   - recovery_days_est: estimated days to find alternative supplier
 *   - disruption_reason: human-readable explanation
 *
 * Recovery Model (based on tier + country risk):
 *   - Tier 1 direct supplier: 30-90 days (approved vendor qualification)
 *   - Tier 2 country-level:   60-180 days (sourcing + qualification)
 *   - Tier 3+ deep tier:      90-270 days (full requalification)
 *   - Multiplied by country risk factor (high-risk = longer lead times)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Base recovery time in days per tier of the DISRUPTED node */
const RECOVERY_BASE_DAYS = {
    0: 0,    // Root company — not a supplier
    1: 45,   // Direct Tier-1 supplier
    2: 90,   // Country-level Tier-2 cluster
    3: 120,  // Tier-3 deep supplier
    4: 150,
    5: 180,
    6: 210,
};

/** Impact decay factor per hop from disruption source (BFS depth) */
const DEPTH_DECAY = [1.0, 0.85, 0.65, 0.45, 0.30, 0.20];

// ─────────────────────────────────────────────────────────────────────────────
// Graph Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a reverse adjacency list from the graph edges.
 * edges: source → target (supplier → consumer)
 * Reverse: target → [sources] (consumer → [its suppliers])
 * We need: for each node, who depends on it?
 *   If A supplies B (A → B), then disrupting A affects B.
 *   So "dependents of A" = nodes where edge.source = A, following target.
 *
 * Actually we need FORWARD traversal from disrupted node:
 *   disrupted node's CONSUMERS = edges where source = disrupted node, target = consumer
 *   But edges go source(supplier) → target(consumer toward root), so:
 *   To find who depends on the disrupted node (who it supplies to):
 *   Find all edges where edge.source = disruptedNodeId → edge.target is affected
 */
function buildForwardAdjacency(edges) {
    // adjacency[nodeId] = [list of node IDs that this node directly supplies to]
    const adj = {};
    for (const edge of edges) {
        if (!adj[edge.source]) adj[edge.source] = [];
        adj[edge.source].push(edge.target);
    }
    return adj;
}

/**
 * Build a node lookup map for fast access.
 */
function buildNodeMap(nodes) {
    const map = {};
    for (const node of nodes) map[node.id] = node;
    return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Impact Score Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate an impact score (0-100) for an affected node at a given BFS depth.
 *
 * Factors:
 *   - Base impact from the disrupted node's own risk level
 *   - BFS depth decay (closer = more impacted)
 *   - Sanctions multiplier (sanctioned = harder to replace)
 *   - Country risk of the disrupted node (high-risk = less substitutable)
 *
 * @param {object} disruptedNode      - The node being disrupted
 * @param {object} affectedNode       - The downstream affected node
 * @param {number} depth              - BFS hop distance from disruption
 * @returns {number} 0-100
 */
function calculateImpactScore(disruptedNode, affectedNode, depth) {
    // Base: disrupted node's country risk (higher risk = harder to replace, more impact)
    const riskBase = (disruptedNode.country_risk_score || 50) / 100;

    // Sanctions multiplier: sanctioned suppliers are extremely hard to replace
    const sanctionsMultiplier = disruptedNode.sanctions_flag ? 1.4 : 1.0;

    // Depth decay
    const decayIdx = Math.min(depth, DEPTH_DECAY.length - 1);
    const decay = DEPTH_DECAY[decayIdx];

    // Raw score
    const raw = riskBase * sanctionsMultiplier * decay * 100;

    // Additional boost if the affected node is the root (entire company affected)
    const rootBoost = affectedNode.tier === 0 ? 1.2 : 1.0;

    return Math.min(100, Math.round(raw * rootBoost));
}

/**
 * Estimate recovery time in days for replacing the disrupted node.
 *
 * @param {object} disruptedNode
 * @returns {{ min: number, max: number, estimate: number }}
 */
function estimateRecoveryDays(disruptedNode) {
    const tier = disruptedNode.tier || 1;
    const baseDays = RECOVERY_BASE_DAYS[tier] || 90;
    const riskScore = disruptedNode.country_risk_score || 50;

    // Country risk multiplier: 0.7x (low risk) → 2.5x (very high risk)
    const riskMultiplier = 0.7 + (riskScore / 100) * 1.8;

    // Sanctions make it far harder — add 60-90 days for alternative qualification
    const sanctionsAdder = disruptedNode.sanctions_flag ? 75 : 0;

    const estimate = Math.round(baseDays * riskMultiplier + sanctionsAdder);
    const min = Math.round(estimate * 0.6);
    const max = Math.round(estimate * 1.5);

    return { min, max, estimate };
}

/**
 * Generate a human-friendly disruption reason string.
 */
function getDisruptionReason(disruptedNode) {
    const reasons = [];

    if (disruptedNode.sanctions_flag) {
        reasons.push(`Sanctioned entity (${disruptedNode.sanctions_detail || 'OFAC list'})`);
    }
    if (disruptedNode.risk_label === 'CRITICAL') {
        reasons.push(`Critical geopolitical risk in ${disruptedNode.country} (GPR: ${disruptedNode.gpr_score})`);
    } else if (disruptedNode.risk_label === 'HIGH') {
        reasons.push(`High country risk in ${disruptedNode.country} (score: ${disruptedNode.country_risk_score})`);
    }

    const tier = disruptedNode.tier || 1;
    if (tier === 1) reasons.push('Direct Tier-1 supplier — immediate production impact');
    else if (tier === 2) reasons.push(`Tier-2 country sourcing cluster (${disruptedNode.country})`);
    else reasons.push(`Tier-${tier} upstream supplier disruption`);

    return reasons.join('; ') || 'Supply disruption at this node';
}

// ─────────────────────────────────────────────────────────────────────────────
// BFS Traversal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run BFS from the disrupted node, following the "supplies to" direction.
 * Returns all affected nodes with their cascade depth and impact.
 *
 * @param {string} disruptedNodeId  - ID of the disrupted node
 * @param {Array}  nodes            - All graph nodes
 * @param {Array}  edges            - All graph edges
 * @returns {Array<object>}         - Affected node records (sorted by impact)
 */
function bfsDisruption(disruptedNodeId, nodes, edges) {
    const nodeMap = buildNodeMap(nodes);
    const forwardAdj = buildForwardAdjacency(edges);

    const disruptedNode = nodeMap[disruptedNodeId];
    if (!disruptedNode) {
        return { error: `Node "${disruptedNodeId}" not found in graph` };
    }

    const visited = new Set([disruptedNodeId]);
    const queue = [{ id: disruptedNodeId, depth: 0 }];
    const affected = [];

    while (queue.length > 0) {
        const { id: currentId, depth } = queue.shift();
        const currentNode = nodeMap[currentId];
        if (!currentNode) continue;

        // Skip the disrupted node itself — we report it separately
        if (currentId !== disruptedNodeId) {
            const impactScore = calculateImpactScore(disruptedNode, currentNode, depth);
            affected.push({
                node_id: currentId,
                label: currentNode.label,
                tier: currentNode.tier,
                country: currentNode.country,
                cascade_depth: depth,
                impact_score: impactScore,
                impact_level: impactScore >= 70 ? 'CRITICAL' : impactScore >= 40 ? 'HIGH' : impactScore >= 20 ? 'MEDIUM' : 'LOW',
                is_root: currentNode.tier === 0,
            });
        }

        // Follow edges: find all nodes this current node supplies to
        const consumers = forwardAdj[currentId] || [];
        for (const nextId of consumers) {
            if (!visited.has(nextId)) {
                visited.add(nextId);
                queue.push({ id: nextId, depth: depth + 1 });
            }
        }
    }

    return affected.sort((a, b) => b.impact_score - a.impact_score);
}

// ─────────────────────────────────────────────────────────────────────────────
// Concentration Risk Analysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identify single-point-of-failure nodes — nodes that represent the only
 * supplier of their type in a tier/country combination.
 *
 * @param {Array} nodes
 * @param {Array} edges
 * @returns {Array<{ node_id, label, tier, country, spof_reason }>}
 */
function findSinglePointsOfFailure(nodes, edges) {
    const forwardAdj = buildForwardAdjacency(edges);
    const spofs = [];

    // Find nodes where removing them disconnects the root from upstream supply
    for (const node of nodes) {
        if (node.tier === 0) continue; // Skip root

        const consumers = forwardAdj[node.id] || [];
        const isOnlySupplierOfType =
            // Only supplier in its country at its tier
            nodes.filter(n => n.tier === node.tier && n.country === node.country).length === 1
            // OR sole supplier to root (Tier-1 only)
            || (node.tier === 1 && consumers.includes('root') && consumers.length === 1);

        // Single country concentration — if > 50% of Tier-2 nodes are in same country AS this one
        const tierNodes = nodes.filter(n => n.tier === node.tier);
        const countryShare = tierNodes.filter(n => n.country === node.country).length / tierNodes.length;
        const highConcentration = countryShare > 0.5 && tierNodes.length > 1;

        if (isOnlySupplierOfType || (node.sanctions_flag && consumers.length > 0) || node.risk_label === 'CRITICAL') {
            spofs.push({
                node_id: node.id,
                label: node.label,
                tier: node.tier,
                country: node.country,
                sanctions_flag: node.sanctions_flag,
                risk_label: node.risk_label || 'UNKNOWN',
                country_concentration: Math.round(countryShare * 100),
                spof_reason: node.sanctions_flag
                    ? `Sanctioned supplier with ${consumers.length} downstream dependent(s)`
                    : node.risk_label === 'CRITICAL'
                        ? `Critical-risk country (${node.country}) supplier`
                        : highConcentration
                            ? `${Math.round(countryShare * 100)}% of Tier-${node.tier} sourced from ${node.country}`
                            : `Sole ${node.country} supplier at Tier-${node.tier}`,
            });
        }
    }

    return spofs.sort((a, b) => {
        const rankOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
        return (rankOrder[a.risk_label] || 4) - (rankOrder[b.risk_label] || 4);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a full disruption simulation for a given node.
 *
 * @param {string} disruptedNodeId   - Node to disrupt
 * @param {Array}  nodes             - All graph nodes (enriched)
 * @param {Array}  edges             - All graph edges
 * @returns {object} Disruption simulation result
 */
function simulateDisruption(disruptedNodeId, nodes, edges) {
    const nodeMap = buildNodeMap(nodes);
    const disruptedNode = nodeMap[disruptedNodeId];

    if (!disruptedNode) {
        return { error: `Node "${disruptedNodeId}" not found in graph`, affected: [], summary: {} };
    }

    // BFS to find all affected downstream nodes
    const affected = bfsDisruption(disruptedNodeId, nodes, edges);

    // Recovery estimate for the disrupted node itself
    const recovery = estimateRecoveryDays(disruptedNode);

    // Is root (final assembly) in the affected set?
    const rootAffected = affected.some(n => n.is_root);

    // Overall supply disruption severity
    const supplierCount = nodes.filter(n => n.tier > 0).length;
    const affectedFraction = supplierCount > 0 ? affected.length / supplierCount : 0;

    let severity;
    if (rootAffected && disruptedNode.sanctions_flag) severity = 'CRITICAL';
    else if (rootAffected || affectedFraction > 0.4) severity = 'HIGH';
    else if (affectedFraction > 0.2) severity = 'MEDIUM';
    else severity = 'LOW';

    // Build the disruption reason
    const reason = getDisruptionReason(disruptedNode);

    const summary = {
        disrupted_node: {
            id: disruptedNodeId,
            label: disruptedNode.label,
            tier: disruptedNode.tier,
            country: disruptedNode.country,
            country_risk_score: disruptedNode.country_risk_score,
            gpr_score: disruptedNode.gpr_score,
            sanctions_flag: disruptedNode.sanctions_flag,
            risk_label: disruptedNode.risk_label,
        },
        severity,
        affected_count: affected.length,
        affected_tiers: [...new Set(affected.map(n => n.tier))].sort(),
        production_halt: rootAffected,
        disruption_reason: reason,
        recovery_days: recovery,
        supply_chain_coverage: Math.round(affectedFraction * 100), // % of supply chain affected
    };

    return { summary, affected };
}

/**
 * Run disruption simulations for ALL high-risk nodes automatically.
 * Useful for a "vulnerability scan" of the entire graph.
 *
 * @param {Array} nodes
 * @param {Array} edges
 * @returns {Array<object>} Top disruption scenarios sorted by severity
 */
function autoScanVulnerabilities(nodes, edges) {
    // Candidate nodes: sanctioned, HIGH or CRITICAL risk, or Tier-1 direct
    const candidates = nodes.filter(n =>
        n.tier > 0 && (
            n.sanctions_flag ||
            n.risk_label === 'CRITICAL' ||
            n.risk_label === 'HIGH' ||
            n.tier === 1
        )
    );

    const results = candidates.map(node => {
        const sim = simulateDisruption(node.id, nodes, edges);
        return { node_id: node.id, label: node.label, tier: node.tier, ...sim.summary };
    });

    // Sort: CRITICAL > HIGH > MEDIUM > LOW, then by affected_count
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return results.sort((a, b) => {
        const sA = severityOrder[a.severity] ?? 4;
        const sB = severityOrder[b.severity] ?? 4;
        if (sA !== sB) return sA - sB;
        return (b.affected_count || 0) - (a.affected_count || 0);
    });
}

module.exports = {
    simulateDisruption,
    autoScanVulnerabilities,
    findSinglePointsOfFailure,
    bfsDisruption,
    estimateRecoveryDays,
};
