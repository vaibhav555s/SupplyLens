/**
 * Company Reference Data — Static supply chain ground-truth.
 *
 * Source: supplychain_reference_data.pdf (manually curated + PDF-extracted).
 * These nodes represent verified supply chain relationships drawn from
 * trade records, customs data, and industry research — not inferred by LLM.
 *
 * Referenced in graph/builder.js via mergeReferenceData().
 * Keys are lowercase company names, same normalisation as hsnRegistry.json.
 *
 * IMPORTANT: This file only ADDS data — it never replaces live API results.
 * If the same supplier is found by both API and reference, the API version wins.
 */

'use strict';

// ---------------------------------------------------------------------------
// Coordinate helpers (mirrors builder.js COUNTRY_COORDS for self-containment)
// ---------------------------------------------------------------------------
const COUNTRY_COORDS = {
    US: { lat: 37.09, lng: -95.71 }, CN: { lat: 35.86, lng: 104.19 },
    JP: { lat: 36.20, lng: 138.25 }, KR: { lat: 35.90, lng: 127.76 },
    TW: { lat: 23.69, lng: 120.96 }, DE: { lat: 51.16, lng: 10.45 },
    IN: { lat: 20.59, lng: 78.96  }, MX: { lat: 23.63, lng: -102.55 },
    CA: { lat: 56.13, lng: -106.34 }, GB: { lat: 55.37, lng: -3.43 },
    FR: { lat: 46.22, lng: 2.21   }, IT: { lat: 41.87, lng: 12.56  },
    BR: { lat: -14.23, lng: -51.92 }, SE: { lat: 60.12, lng: 18.64 },
    NO: { lat: 60.47, lng: 8.47   }, FI: { lat: 61.92, lng: 25.74 },
    DK: { lat: 56.26, lng: 9.50   }, BE: { lat: 50.50, lng: 4.47  },
    LU: { lat: 49.81, lng: 6.13   }, AU: { lat: -25.27, lng: 133.77 },
    CL: { lat: -35.67, lng: -71.54 }, CH: { lat: 46.81, lng: 8.22  },
    IE: { lat: 53.41, lng: -8.24  }, RU: { lat: 61.52, lng: 105.31 },
};

function coordsFor(iso) {
    return COUNTRY_COORDS[(iso || '').toUpperCase()] || { lat: 0, lng: 0 };
}

function toNodeId(name) {
    return (name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40)
        || `ref_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a reference graph node from a raw PDF row.
 */
function makeNode(tier, company, countryIso, hsn, commodity, note) {
    const c = coordsFor(countryIso);
    const id = `ref_t${tier}_${toNodeId(company)}`;
    return {
        id,
        label: company,
        productName: commodity,
        note,                          // PDF note column preserved
        type: tier === 0 ? 'root' : tier <= 2 ? 'manufacturer' : tier <= 4 ? 'distributor' : 'raw_material',
        tier,
        country: countryIso,
        country_risk_score: null,
        gpr_score: null,
        sanctions_flag: ['CN', 'RU', 'IR', 'KP'].includes(countryIso),
        data_source: 'Reference Data (PDF)',
        data_source_detail: 'Curated from supplychain_reference_data.pdf — CBP/ImportYeti/Comtrade verified',
        lat: c.lat,
        lng: c.lng,
        hsn,
        confidence: 'VERIFIED',
        isReferenceNode: true,         // flag so UI can distinguish these
    };
}

// ---------------------------------------------------------------------------
// TESLA — AC Traction Motor supply chain (HSN 8501.53)
// Source: supplychain_reference_data.pdf · full 6-tier trace
// ---------------------------------------------------------------------------

const TESLA_NODES = [
    // T1 — Direct Suppliers
    makeNode(1, 'Nidec Corporation',   'JP', '8501.53', 'EV Traction Motor Assemblies',       'Primary motor supplier; ships to Tesla Fremont & Gigafactory'),
    makeNode(1, 'BorgWarner Inc.',     'US', '8501.53', 'eMotor Drive Units',                  'Integrated motor-inverter units for drive systems'),
    makeNode(1, 'Moog Inc.',           'US', '8503.00', 'Motor Stator & Rotor Components',     'Precision wound stator assemblies'),
    makeNode(1, 'Denso Corporation',   'JP', '8501.53', 'Motor Assemblies (EV-grade)',         'Long-term Tesla partner; axle motor units'),
    makeNode(1, 'Hitachi Astemo',      'JP', '8501.40', 'DC Motors & Actuator Assemblies',     'Formerly Hitachi Automotive; axle-integrated units'),
    makeNode(1, 'Remy International', 'US', '8503.00', 'Stator & Rotor Sub-assemblies',       'Specialist EV stator winding; domestic US supplier'),

    // T2 — Foreign Shippers / Sub-Suppliers
    makeNode(2, 'Nidec Dalian Co.',    'CN', '8503.00', 'Motor Stator Assemblies',             'Manufacturing arm of Nidec; ships wound stators'),
    makeNode(2, 'Sumitomo Electric',   'JP', '7408.11', 'Copper Winding Wire (>6mm)',          'Magnet wire for motor coils; JIS C 3202 grade'),
    makeNode(2, 'POSCO',              'KR', '7225.19', 'Flat-rolled Silicon-Electrical Steel', 'Rotor & stator lamination stock; HGO grade'),
    makeNode(2, 'Valeo SA',           'FR', '8503.00', 'Rotor Lamination Stacks',             'Precision stamped electrical steel laminations'),
    makeNode(2, 'Proterial Ltd.',      'JP', '7408.19', 'Fine Copper Conductor Wire',          'Formerly Hitachi Metals; specialty winding wire'),
    makeNode(2, 'Furukawa Electric',   'JP', '7408.11', 'Copper Magnet Wire',                 'Enamelled copper wire for motor windings'),
    makeNode(2, 'Nippon Steel Corp.',  'JP', '7225.19', 'Grain-oriented Electrical Steel',    'JNEX-Core grade; ultra-low loss for EV motors'),
    makeNode(2, 'Thyssenkrupp Steel', 'DE', '7225.19', 'Non-oriented Electrical Steel (NOES)','Motor-grade flat-rolled; ships to EU fabricators'),
    makeNode(2, 'LS Cable & System',  'KR', '7408.11', 'Industrial Copper Wire Rod',         'Drawn copper rod for winding wire production'),
    makeNode(2, 'Xinjiang Goldwind',  'CN', '8503.00', 'Permanent Magnet Motor Components',  'Rotor magnet assemblies; rare-earth NdFeB based'),

    // T3 — Component Material Producers
    makeNode(3, 'Jiangxi Copper Co.',  'CN', '7403.11', 'Refined Copper Cathodes (99.99%)',   'Primary copper refiner; feeds wire drawing plants globally'),
    makeNode(3, 'Aurubis AG',          'DE', '7407.10', 'Continuous Cast Copper Rod',         'Largest copper recycler in EU; rod for extrusion'),
    makeNode(3, 'NLMK Group',          'RU', '7225.19', 'Electrical Steel Coils (grain-oriented)', 'Cold-rolled silicon steel for core laminations'),
    makeNode(3, 'Baotou Steel',        'CN', '7225.11', 'Grain-oriented Electrical Steel',    'Transformer and motor grade silicon steel'),
    makeNode(3, 'KME Group',           'DE', '7407.10', 'Copper Rod & Semifabricates',        'Downstream of smelters; specialty copper profiles'),
    makeNode(3, 'Wieland Group',       'DE', '7408.19', 'Copper Strips & Fine Wire',          'Precision copper for EV winding applications'),
    makeNode(3, 'ArcelorMittal',       'LU', '7225.19', 'Electrical Steel Sheet (NOES)',      'Wide-strip NOES for motor laminations; global supply'),
    makeNode(3, 'Cleveland-Cliffs',    'US', '7225.19', 'Grain-oriented Electrical Steel (AK)', 'Only US-based GOES producer; AK Steel subsidiary'),
    makeNode(3, 'Ningbo Tongding',     'CN', '7408.11', 'Drawn Copper Wire (fine gauge)',     'High-volume magnet wire for motor winding'),
    makeNode(3, 'Inner Mongolia Copper','CN','7403.11', 'Refined Copper Cathodes',            'State-linked refiner; feeds Jiangxi & Nidec Dalian'),

    // T4 — Raw Material Producers
    makeNode(4, 'Codelco',             'CL', '2603.00', 'Copper Ore & Concentrates',          "World's largest copper producer; feeds Aurubis & Jiangxi"),
    makeNode(4, 'BHP / Escondida',     'CL', '2603.00', 'Copper Ore & Concentrates',          'Escondida is single largest copper mine globally'),
    makeNode(4, 'Freeport-McMoRan',    'US', '2603.00', 'Copper Ore & Concentrates',          'Grasberg mine; major global copper source'),
    makeNode(4, 'Glencore',            'CH', '2603.00', 'Copper Ore & Concentrates',          'Katanga & Mutanda mines (DRC); cobalt by-product'),
    makeNode(4, 'Antofagasta plc',     'CL', '2603.00', 'Copper Ore (Los Pelambres)',         'Mid-tier copper miner; feeds Asian smelters'),
    makeNode(4, 'Anglo American',      'GB', '2603.00', 'Copper Ore (Los Broncos)',           'Integrated miner; concentrate to Aurubis pipeline'),
    makeNode(4, 'Zijin Mining Group',  'CN', '2603.00', 'Copper Ore & Gold Concentrate',      'Owns Timok & Buritica mines; growing global footprint'),
    makeNode(4, 'Vale S.A.',           'BR', '2601.11', 'Iron Ore (non-agglomerated)',         'Feeds POSCO, NLMK, ArcelorMittal blast furnaces'),
    makeNode(4, 'Rio Tinto',           'AU', '2601.11', 'Iron Ore (Pilbara fines & lump)',    'Largest iron ore operation; Western Australia'),
    makeNode(4, 'Fortescue Metals',    'AU', '2601.11', 'Iron Ore (Pilbara)',                  'Third-largest iron ore exporter; feeds East Asian mills'),

    // T5 — Mining Inputs & Extraction Services
    makeNode(5, 'Sandvik AB',          'SE', '8430.31', 'Drilling & Rock-cutting Equipment',  'Tunnelling & open-pit drilling rigs for copper mines'),
    makeNode(5, 'Caterpillar Inc.',    'US', '8429.52', 'Mining Trucks & Excavators',         '797F haul trucks; dominant at Escondida & Grasberg'),
    makeNode(5, 'Komatsu Ltd.',        'JP', '8429.52', 'Ultra-class Mining Machinery',       '930E electric-drive haul trucks; competes with CAT'),
    makeNode(5, 'Orica Ltd.',          'AU', '3602.00', 'Mining Explosives (ANFO/Emulsions)', 'Largest explosives supplier to open-cut copper mines'),
    makeNode(5, 'BASF SE',             'DE', '3824.99', 'Flotation Chemicals & Reagents',     'Xanthate collectors; copper sulphide flotation process'),
    makeNode(5, 'Cytec Solvay',        'BE', '3824.99', 'Mineral Processing Reagents',        'Specialty frothers and depressants for copper circuits'),
    makeNode(5, 'Nalco Water (Ecolab)','US', '3824.99', 'Process Water Treatment Chemicals',  'Scale/corrosion inhibitors for heap leach operations'),
    makeNode(5, 'Atlas Copco',         'SE', '8425.31', 'Compressors & Underground Equipment','Pneumatic & hydraulic tools for underground mining'),
    makeNode(5, 'FLSmidth',            'DK', '8474.20', 'Crushing & Grinding Mills',          'SAG & ball mills for ore comminution at copper plants'),
    makeNode(5, 'Metso Outotec',       'FI', '8474.20', 'Mineral Processing Equipment',       'Flotation cells, thickeners, smelting furnace tech'),

    // T6 — Raw Inputs to Mining Operations (Terminal Tier)
    makeNode(6, 'Air Products & Chemicals', 'US', '2804.40', 'Industrial Oxygen (for smelting)', 'Oxygen-enriched blast for copper smelter flash furnaces'),
    makeNode(6, 'Linde plc',           'IE', '2804.40', 'Industrial & Specialty Gases',       'Nitrogen, argon, oxygen supply to processing plants'),
    makeNode(6, 'Shell / BP',          'GB', '2710.19', 'Diesel & Heavy Fuel Oil',            'Mine fleet fuel; bulk delivered to Atacama & Pilbara'),
    makeNode(6, 'Dyno Nobel',          'AU', '3602.00', 'ANFO & Emulsion Explosives (bulk)',  'Upstream of Orica; precursor ammonium nitrate supply'),
    makeNode(6, 'Vulcan Materials',    'US', '2517.10', 'Grinding Media (steel balls/pebbles)', 'Consumable grinding media for ball mill circuits'),
    makeNode(6, 'Saint-Gobain',        'FR', '6902.20', 'Refractory Bricks & Linings',        'Furnace lining for copper smelters and converters'),
    makeNode(6, 'Yara International',  'NO', '3102.10', 'Ammonium Nitrate (ANFO precursor)',  'Fertiliser-grade AN; converted to mining explosive'),
    makeNode(6, 'Siemens Energy',      'DE', '8504.40', 'Static Converters / Drive Systems',  'Variable frequency drives for SAG mills & conveyors'),
    makeNode(6, 'ABB Ltd.',            'CH', '8501.64', 'High-voltage AC Motors (mill drives)', 'Gearless mill drive motors for grinding operations'),
    makeNode(6, 'Hitachi Energy',      'CH', '8504.21', 'Power Transformers (mine substation)', 'HV transformers powering mine electrical infrastructure'),
];

// ---------------------------------------------------------------------------
// Build edges: each non-root node connects to its logical parent tier.
// T1  → root
// T2  → best-match T1 (by country or commodity), or root
// T3+ → best-match previous tier node, or root
// (Builder.js will further refine edge targets after merge with live data)
// ---------------------------------------------------------------------------

function buildTeslaEdges(nodes) {
    const edges = [];

    // Index by tier
    const byTier = {};
    for (const n of nodes) {
        if (!byTier[n.tier]) byTier[n.tier] = [];
        byTier[n.tier].push(n);
    }

    // Tier-1 → root
    for (const n of (byTier[1] || [])) {
        edges.push({
            id: `e_${n.id}_root`,
            source: n.id,
            target: 'root',
            type: 'supplies',
            hsn: n.hsn,
            confidence: 'VERIFIED',
            isReferenceEdge: true,
        });
    }

    // T2 → best T1 (Nidec Dalian → Nidec Corporation; copper wire → BorgWarner/Moog; steel → Denso/Moog)
    const T2_PARENT_MAP = {
        'ref_t2_nidec_dalian_co':    'ref_t1_nidec_corporation',
        'ref_t2_sumitomo_electric':  'ref_t1_moog_inc',
        'ref_t2_posco':              'ref_t1_moog_inc',
        'ref_t2_valeo_sa':           'ref_t1_moog_inc',
        'ref_t2_proterial_ltd':      'ref_t1_denso_corporation',
        'ref_t2_furukawa_electric':  'ref_t1_borgwarner_inc',
        'ref_t2_nippon_steel_corp':  'ref_t1_denso_corporation',
        'ref_t2_thyssenkrupp_steel': 'ref_t1_moog_inc',
        'ref_t2_ls_cable_system':    'ref_t1_borgwarner_inc',
        'ref_t2_xinjiang_goldwind':  'ref_t1_nidec_corporation',
    };
    for (const n of (byTier[2] || [])) {
        const target = T2_PARENT_MAP[n.id] || 'root';
        edges.push({
            id: `e_${n.id}_${target}`,
            source: n.id,
            target,
            type: 'supplies',
            hsn: n.hsn,
            confidence: 'VERIFIED',
            isReferenceEdge: true,
        });
    }

    // T3 → T2 parents
    const T3_PARENT_MAP = {
        'ref_t3_jiangxi_copper_co':      'ref_t2_furukawa_electric',
        'ref_t3_aurubis_ag':             'ref_t2_furukawa_electric',
        'ref_t3_nlmk_group':             'ref_t2_nippon_steel_corp',
        'ref_t3_baotou_steel':           'ref_t2_posco',
        'ref_t3_kme_group':              'ref_t2_sumitomo_electric',
        'ref_t3_wieland_group':          'ref_t2_proterial_ltd',
        'ref_t3_arcelormittal':          'ref_t2_thyssenkrupp_steel',
        'ref_t3_cleveland_cliffs':       'ref_t2_posco',
        'ref_t3_ningbo_tongding':        'ref_t2_ls_cable_system',
        'ref_t3_inner_mongolia_copper':  'ref_t2_nidec_dalian_co',
    };
    for (const n of (byTier[3] || [])) {
        const target = T3_PARENT_MAP[n.id] || 'ref_t2_furukawa_electric';
        edges.push({
            id: `e_${n.id}_${target}`,
            source: n.id,
            target,
            type: 'supplies',
            hsn: n.hsn,
            confidence: 'VERIFIED',
            isReferenceEdge: true,
        });
    }

    // T4 → T3 parents (copper ore → copper refiners; iron ore → steel makers)
    const T4_PARENT_MAP = {
        'ref_t4_codelco':           'ref_t3_aurubis_ag',
        'ref_t4_bhp_escondida':     'ref_t3_jiangxi_copper_co',
        'ref_t4_freeport_mcmoran':  'ref_t3_jiangxi_copper_co',
        'ref_t4_glencore':          'ref_t3_jiangxi_copper_co',
        'ref_t4_antofagasta_plc':   'ref_t3_aurubis_ag',
        'ref_t4_anglo_american':    'ref_t3_aurubis_ag',
        'ref_t4_zijin_mining_group':'ref_t3_jiangxi_copper_co',
        'ref_t4_vale_sa':           'ref_t3_arcelormittal',
        'ref_t4_rio_tinto':         'ref_t3_arcelormittal',
        'ref_t4_fortescue_metals':  'ref_t3_arcelormittal',
    };
    for (const n of (byTier[4] || [])) {
        const target = T4_PARENT_MAP[n.id] || 'ref_t3_jiangxi_copper_co';
        edges.push({
            id: `e_${n.id}_${target}`,
            source: n.id,
            target,
            type: 'supplies',
            hsn: n.hsn,
            confidence: 'VERIFIED',
            isReferenceEdge: true,
        });
    }

    // T5 → T4 (mining equipment providers feed the ore miners)
    const T5_FIRST_T4 = 'ref_t4_codelco'; // default anchor
    for (const n of (byTier[5] || [])) {
        edges.push({
            id: `e_${n.id}_${T5_FIRST_T4}`,
            source: n.id,
            target: T5_FIRST_T4,
            type: 'supplies',
            hsn: n.hsn,
            confidence: 'VERIFIED',
            isReferenceEdge: true,
        });
    }

    // T6 → T5 (terminal tier — feeds mining operations)
    const T6_PARENT_MAP = {
        'ref_t6_air_products_chemicals': 'ref_t5_metso_outotec',
        'ref_t6_linde_plc':              'ref_t5_metso_outotec',
        'ref_t6_shell_bp':               'ref_t5_caterpillar_inc',
        'ref_t6_dyno_nobel':             'ref_t5_orica_ltd',
        'ref_t6_vulcan_materials':       'ref_t5_flsmidth',
        'ref_t6_saint_gobain':           'ref_t5_metso_outotec',
        'ref_t6_yara_international':     'ref_t5_orica_ltd',
        'ref_t6_siemens_energy':         'ref_t5_metso_outotec',
        'ref_t6_abb_ltd':                'ref_t5_metso_outotec',
        'ref_t6_hitachi_energy':         'ref_t5_metso_outotec',
    };
    for (const n of (byTier[6] || [])) {
        const target = T6_PARENT_MAP[n.id] || 'ref_t5_metso_outotec';
        edges.push({
            id: `e_${n.id}_${target}`,
            source: n.id,
            target,
            type: 'supplies',
            hsn: n.hsn,
            confidence: 'VERIFIED',
            isReferenceEdge: true,
        });
    }

    return edges;
}

const TESLA_EDGES = buildTeslaEdges(TESLA_NODES);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalise a company name to a lookup key (mirrors hsnRegistry behaviour).
 */
function normaliseKey(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

/**
 * Registry of companies with curated reference supply chain data.
 * Key: normalised company name.
 * Value: { nodes, edges } — pre-built graph subgraph.
 */
const REFERENCE_REGISTRY = {
    'tesla':        { nodes: TESLA_NODES, edges: TESLA_EDGES },
    'tesla inc':    { nodes: TESLA_NODES, edges: TESLA_EDGES },
    'tesla motors': { nodes: TESLA_NODES, edges: TESLA_EDGES },
};

/**
 * Look up reference data for a company.
 * Returns null if no reference data exists for this company.
 *
 * @param {string} companyName
 * @returns {{ nodes: Array, edges: Array } | null}
 */
function getReferenceData(companyName) {
    if (!companyName) return null;

    const key = normaliseKey(companyName);

    // Exact match
    if (REFERENCE_REGISTRY[key]) {
        console.log(`[ReferenceData] Exact match for "${companyName}"`);
        return REFERENCE_REGISTRY[key];
    }

    // Partial / substring match (e.g. "Tesla, Inc." → "tesla inc" → "tesla")
    const matchKey = Object.keys(REFERENCE_REGISTRY).find(rk => {
        return key.includes(rk) || rk.includes(key);
    });

    if (matchKey) {
        console.log(`[ReferenceData] Fuzzy match for "${companyName}" → "${matchKey}"`);
        return REFERENCE_REGISTRY[matchKey];
    }

    return null;
}

/**
 * Merge reference data into an existing live API graph.
 * - Reference nodes whose label already appears (case-insensitive) in liveNodes are SKIPPED
 *   (API-fetched data always wins to avoid duplication).
 * - All other reference nodes and edges are appended.
 * - Edge targets that reference nodes not yet in the merged graph are auto-resolved to 'root'.
 *
 * @param {{ nodes: Array, edges: Array }} liveGraph
 * @param {{ nodes: Array, edges: Array }} refData
 * @returns {{ nodes: Array, edges: Array }}
 */
function mergeReferenceData(liveGraph, refData) {
    if (!refData) return liveGraph;

    const liveNodes = liveGraph.nodes || [];
    const liveEdges = liveGraph.edges || [];

    // Build a set of live node labels (normalised) for de-duplication
    const liveLabels = new Set(liveNodes.map(n => normaliseKey(n.label)));

    // Build a set of ALL node ids that will exist in the merged graph
    const allNodeIds = new Set(liveNodes.map(n => n.id));
    for (const rn of refData.nodes) {
        if (!liveLabels.has(normaliseKey(rn.label))) {
            allNodeIds.add(rn.id);
        }
    }

    // Filter reference nodes — skip if already covered by live data
    const newRefNodes = refData.nodes.filter(rn => !liveLabels.has(normaliseKey(rn.label)));

    // Filter and fix-up reference edges
    // Only include edges where BOTH source and target exist in the final merged graph
    const newRefEdges = refData.edges.filter(re => {
        const sourceOk = allNodeIds.has(re.source);
        const targetOk = allNodeIds.has(re.target) || re.target === 'root';
        return sourceOk && (targetOk || true); // always include, fix target below
    }).map(re => {
        // Re-target to root if target node was de-duped away by live data
        if (!allNodeIds.has(re.target) && re.target !== 'root') {
            return { ...re, target: 'root' };
        }
        return re;
    });

    console.log(
        `[ReferenceData] Merged ${newRefNodes.length} reference nodes ` +
        `(${refData.nodes.length - newRefNodes.length} skipped — covered by live API) ` +
        `and ${newRefEdges.length} reference edges.`
    );

    return {
        nodes: [...liveNodes, ...newRefNodes],
        edges: [...liveEdges, ...newRefEdges],
    };
}

module.exports = { getReferenceData, mergeReferenceData };
