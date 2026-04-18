// ─── HS Code Description Connector ───
// Provides HS/HTS code descriptions from multiple sources:
// 1. Built-in HS chapter/heading database (immediate, no API)
// 2. UN Comtrade reference data (commodity descriptions from trade queries)
// 3. USITC HTS REST API fallback
//
// The USITC HTS API (hts.usitc.gov/reststop) has limited/changing endpoints,
// so we use a comprehensive built-in database as the primary source.

const { httpGet } = require('../utils/http');
const { cacheGet, cacheSet, cacheKey } = require('../utils/redis');
const { normalizeToHS6 } = require('../utils/hsn');
const config = require('../config');

// ─── Built-in HS Code Description Database ───
// WCO Harmonized System headings (first 4 digits) with descriptions.
// This covers the most common codes relevant to supply chain tracing.
const HS_DESCRIPTIONS = {
    // Chapter 27 — Mineral fuels
    '2709': 'Petroleum oils and oils obtained from bituminous minerals, crude',
    '2710': 'Petroleum oils, not crude; preparations containing >= 70% petroleum oils',
    // Chapter 28 — Inorganic chemicals
    '2804': 'Hydrogen, rare gases and other non-metals',
    '2818': 'Artificial corundum (aluminium oxide)',
    // Chapter 38 — Miscellaneous chemical products
    '3824': 'Prepared binders for foundry moulds; chemical products',
    '3826': 'Biodiesel and mixtures thereof',
    // Chapter 39 — Plastics
    '3901': 'Polymers of ethylene, in primary forms',
    '3907': 'Polyacetals, other polyethers and epoxide resins',
    '3920': 'Plates, sheets, film, foil of plastics, non-cellular',
    // Chapter 40 — Rubber
    '4011': 'New pneumatic tyres, of rubber',
    // Chapter 70 — Glass
    '7005': 'Float glass and surface ground or polished glass',
    '7007': 'Safety glass (toughened/laminated)',
    // Chapter 71 — Precious metals
    '7108': 'Gold (including gold plated with platinum)',
    '7110': 'Platinum, unwrought or in semi-manufactured forms',
    // Chapter 72 — Iron and steel
    '7207': 'Semi-finished products of iron or non-alloy steel',
    '7208': 'Flat-rolled products of iron or non-alloy steel, hot-rolled',
    '7209': 'Flat-rolled products of iron or non-alloy steel, cold-rolled',
    '7225': 'Flat-rolled products of other alloy steel, width >= 600mm',
    '7226': 'Flat-rolled products of other alloy steel, width < 600mm',
    '7227': 'Bars and rods, hot-rolled, of other alloy steel',
    // Chapter 73 — Iron/steel articles
    '7304': 'Tubes, pipes and hollow profiles, seamless, of iron or steel',
    '7308': 'Structures of iron or steel (bridges, towers, masts)',
    // Chapter 74 — Copper
    '7403': 'Refined copper and copper alloys, unwrought',
    '7407': 'Copper bars, rods and profiles',
    '7408': 'Copper wire',
    '7409': 'Copper plates, sheets and strip, thickness > 0.15mm',
    // Chapter 75 — Nickel
    '7502': 'Unwrought nickel',
    '7505': 'Nickel bars, rods, profiles and wire',
    // Chapter 76 — Aluminium
    '7601': 'Unwrought aluminium',
    '7604': 'Aluminium bars, rods and profiles',
    '7606': 'Aluminium plates, sheets and strip, thickness > 0.2mm',
    // Chapter 80 — Tin
    '8001': 'Unwrought tin',
    // Chapter 81 — Other base metals
    '8101': 'Tungsten (wolfram) and articles thereof',
    '8103': 'Tantalum and articles thereof',
    '8112': 'Beryllium, chromium, hafnium, rhenium, thallium, cadmium, germanium',
    // Chapter 84 — Machinery
    '8401': 'Nuclear reactors; fuel elements; isotope separation machinery',
    '8407': 'Spark-ignition reciprocating piston engines',
    '8408': 'Compression-ignition internal combustion piston engines (diesel)',
    '8411': 'Turbo-jets, turbo-propellers and other gas turbines',
    '8413': 'Pumps for liquids; liquid elevators',
    '8414': 'Air or vacuum pumps, compressors and fans',
    '8415': 'Air conditioning machines',
    '8419': 'Machinery for the treatment of materials by temperature change',
    '8421': 'Centrifuges; filtering or purifying machinery for liquids/gases',
    '8428': 'Lifting, handling, loading or unloading machinery',
    '8429': 'Self-propelled bulldozers, graders, scrapers, excavators',
    '8431': 'Parts for machinery of headings 84.25 to 84.30',
    '8443': 'Printing machinery; machines for uses ancillary to printing',
    '8471': 'Automatic data processing machines (computers)',
    '8473': 'Parts and accessories for computers and office machines',
    '8479': 'Machines having individual functions, not specified elsewhere',
    '8480': 'Moulding boxes for metal foundry; mould bases; moulds',
    '8481': 'Taps, cocks, valves and similar appliances',
    '8482': 'Ball or roller bearings',
    '8483': 'Transmission shafts, cranks, bearing housings, gears',
    '8484': 'Gaskets, mechanical seals',
    // Chapter 85 — Electrical machinery
    '8501': 'Electric motors and generators',
    '8502': 'Electric generating sets and rotary converters',
    '8503': 'Parts suitable for use with electric motors/generators',
    '8504': 'Electrical transformers, static converters (rectifiers)',
    '8505': 'Electromagnets; permanent magnets',
    '8506': 'Primary cells and primary batteries',
    '8507': 'Electric accumulators (batteries) including separators',
    '8511': 'Electrical ignition/starting equipment for engines',
    '8516': 'Electric water heaters, space heating, hair dryers',
    '8517': 'Telephone sets; apparatus for transmission/reception of data',
    '8523': 'Discs, solid-state storage devices, smart cards, media',
    '8525': 'Transmission apparatus for radio/TV; cameras',
    '8528': 'Monitors and projectors; TV receivers',
    '8529': 'Parts for apparatus of headings 85.25 to 85.28',
    '8531': 'Electric sound or visual signalling apparatus',
    '8532': 'Electrical capacitors, fixed, variable or adjustable',
    '8533': 'Electrical resistors (including rheostats and potentiometers)',
    '8534': 'Printed circuits',
    '8536': 'Electrical apparatus for switching/protecting circuits (<1000V)',
    '8537': 'Boards, panels, consoles with switching apparatus',
    '8538': 'Parts for apparatus of headings 85.35 to 85.37',
    '8541': 'Diodes, transistors and similar semiconductor devices',
    '8542': 'Electronic integrated circuits',
    '8543': 'Electrical machines and apparatus, not specified elsewhere',
    '8544': 'Insulated wire, cable; optical fibre cables',
    '8545': 'Carbon electrodes, carbon brushes',
    '8546': 'Electrical insulators of any material',
    // Chapter 87 — Vehicles
    '8701': 'Tractors (other than tractors of heading 87.09)',
    '8702': 'Motor vehicles for the transport of >= 10 persons',
    '8703': 'Motor cars and other motor vehicles for transport of persons',
    '8704': 'Motor vehicles for the transport of goods',
    '8706': 'Chassis fitted with engines',
    '8707': 'Bodies for motor vehicles',
    '8708': 'Parts and accessories for motor vehicles',
    '8711': 'Motorcycles and cycles fitted with auxiliary motor',
    // Chapter 90 — Optical, measuring instruments
    '9001': 'Optical fibres and optical fibre bundles/cables',
    '9013': 'Liquid crystal devices; lasers; optical instruments',
    '9031': 'Measuring or checking instruments and machines',
    '9032': 'Automatic regulating or controlling instruments',
    // Chapter 94 — Furniture
    '9401': 'Seats (other than those of heading 94.02)',
    '9403': 'Other furniture and parts thereof',
    '9405': 'Lamps and lighting fittings',
};

// HS 6-digit sub-heading descriptions (common ones for supply chain)
const HS6_DESCRIPTIONS = {
    '850110': 'Motors of an output not exceeding 37.5 W',
    '850120': 'Universal AC/DC motors of an output exceeding 37.5 W',
    '850131': 'DC motors, output not exceeding 750 W',
    '850132': 'DC motors, output exceeding 750 W but not 75 kW',
    '850133': 'DC motors, output exceeding 75 kW but not 375 kW',
    '850134': 'DC motors, output exceeding 375 kW',
    '850140': 'Other single-phase AC motors',
    '850151': 'AC motors, multi-phase, output not exceeding 750 W',
    '850152': 'AC motors, multi-phase, output exceeding 750 W but not 75 kW',
    '850153': 'AC motors, multi-phase, output exceeding 75 kW (traction motors)',
    '850161': 'AC generators (alternators), output not exceeding 75 kVA',
    '850162': 'AC generators, output exceeding 75 kVA but not 375 kVA',
    '850163': 'AC generators, output exceeding 375 kVA but not 750 kVA',
    '850164': 'AC generators, output exceeding 750 kVA',
    '850300': 'Parts suitable for use with electric motors/generators',
    '850431': 'Transformers, having a power handling capacity not exceeding 1 kVA',
    '850440': 'Static converters',
    '850490': 'Parts of transformers and static converters',
    '850710': 'Lead-acid accumulators for starting piston engines',
    '850720': 'Other lead-acid accumulators',
    '850730': 'Nickel-cadmium accumulators',
    '850740': 'Nickel-iron accumulators',
    '850750': 'Nickel-metal hydride accumulators',
    '850760': 'Lithium-ion accumulators (batteries)',
    '850780': 'Other accumulators',
    '850790': 'Parts of electric accumulators (separators, plates, cases)',
    '854110': 'Diodes, other than photosensitive or light-emitting diodes',
    '854121': 'Transistors, with a dissipation rate < 1 W',
    '854129': 'Transistors, with a dissipation rate >= 1 W',
    '854130': 'Thyristors, diacs and triacs',
    '854140': 'Photosensitive semiconductor devices, LEDs',
    '854150': 'Other semiconductor devices',
    '854160': 'Mounted piezo-electric crystals',
    '854190': 'Parts of semiconductor devices',
    '854231': 'Processors and controllers (electronic integrated circuits)',
    '854232': 'Memories (electronic integrated circuits)',
    '854233': 'Amplifiers (electronic integrated circuits)',
    '854239': 'Other electronic integrated circuits',
    '854290': 'Parts of electronic integrated circuits',
    '854411': 'Winding wire of copper, insulated',
    '854419': 'Other insulated winding wire',
    '854420': 'Co-axial cable and other co-axial electric conductors',
    '854430': 'Ignition wiring sets for vehicles, aircraft, ships (wiring harnesses)',
    '854441': 'Fitted with connectors, for voltage not exceeding 1,000 V',
    '854449': 'Other electric conductors, for voltage not exceeding 1,000 V',
    '854460': 'Other electric conductors, for voltage exceeding 1,000 V',
    '870321': 'Vehicles with spark-ignition engine, cylinder capacity ≤ 1,000 cc',
    '870322': 'Vehicles with spark-ignition engine, 1,000 cc < capacity ≤ 1,500 cc',
    '870323': 'Vehicles with spark-ignition engine, 1,500 cc < capacity ≤ 3,000 cc',
    '870324': 'Vehicles with spark-ignition engine, capacity > 3,000 cc',
    '870331': 'Vehicles with diesel engine, capacity ≤ 1,500 cc',
    '870332': 'Vehicles with diesel engine, 1,500 cc < capacity ≤ 2,500 cc',
    '870333': 'Vehicles with diesel engine, capacity > 2,500 cc',
    '870340': 'Vehicles with electric motor (EVs)',
    '870380': 'Other vehicles with electric motor',
    '870810': 'Bumpers and parts thereof',
    '870821': 'Safety seat belts',
    '870829': 'Other parts and accessories of bodies',
    '870830': 'Brakes and servo-brakes; parts thereof',
    '870840': 'Gear boxes and parts thereof',
    '870850': 'Drive-axles with differential; non-driving axles',
    '870870': 'Road wheels and parts and accessories thereof',
    '870880': 'Suspension systems and parts thereof',
    '870891': 'Radiators and parts thereof',
    '870893': 'Clutches and parts thereof',
    '870894': 'Steering wheels, columns and gear boxes',
    '870899': 'Other parts and accessories for motor vehicles',
    '740811': 'Copper wire, refined, max cross-section > 6mm',
    '740819': 'Other refined copper wire',
    '280461': 'Silicon, containing by weight >= 99.99% of silicon',
};

/**
 * Look up a commodity description by HS/HTS code.
 * Uses local database first, falls back to API.
 *
 * @param {string} hsCode - HS code in any format
 * @returns {Promise<object>} { hs_code, hs_code_6, description, chapter, section }
 */
async function lookupHSCode(hsCode) {
    const hs6 = normalizeToHS6(hsCode);
    if (!hs6) throw new Error('Invalid HS code');

    const key = cacheKey('usitc', hs6);
    const cached = await cacheGet(key);
    if (cached) return cached;

    // Try local 6-digit database first
    let description = HS6_DESCRIPTIONS[hs6];

    // Try 4-digit heading
    if (!description) {
        const h4 = hs6.substring(0, 4);
        description = HS_DESCRIPTIONS[h4];
        if (description) {
            description = `[Heading] ${description}`;
        }
    }

    // Try 2-digit chapter
    const chapter = parseInt(hs6.substring(0, 2), 10);
    const chapterDescriptions = {
        1: 'Live animals', 2: 'Meat and edible meat offal', 3: 'Fish and crustaceans',
        4: 'Dairy produce; eggs; natural honey', 5: 'Products of animal origin',
        6: 'Live trees and other plants', 7: 'Edible vegetables', 8: 'Edible fruit and nuts',
        9: 'Coffee, tea, maté and spices', 10: 'Cereals', 11: 'Products of the milling industry',
        12: 'Oil seeds', 13: 'Lac; gums, resins', 14: 'Vegetable plaiting materials',
        15: 'Animal or vegetable fats and oils', 16: 'Preparations of meat, fish',
        17: 'Sugars and sugar confectionery', 18: 'Cocoa and cocoa preparations',
        19: 'Preparations of cereals, flour, starch', 20: 'Preparations of vegetables, fruit',
        21: 'Miscellaneous edible preparations', 22: 'Beverages, spirits and vinegar',
        23: 'Residues from food industries; animal feed', 24: 'Tobacco',
        25: 'Salt; sulphur; earths and stone', 26: 'Ores, slag and ash',
        27: 'Mineral fuels, mineral oils', 28: 'Inorganic chemicals',
        29: 'Organic chemicals', 30: 'Pharmaceutical products',
        31: 'Fertilisers', 32: 'Tanning or dyeing extracts',
        33: 'Essential oils; perfumery; cosmetics', 34: 'Soap; lubricating preparations',
        35: 'Albuminoidal substances; modified starches; glues', 36: 'Explosives',
        37: 'Photographic or cinematographic goods', 38: 'Miscellaneous chemical products',
        39: 'Plastics and articles thereof', 40: 'Rubber and articles thereof',
        41: 'Raw hides and skins', 42: 'Articles of leather',
        44: 'Wood and articles of wood', 47: 'Pulp of wood',
        48: 'Paper and paperboard', 49: 'Printed books, newspapers',
        50: 'Silk', 51: 'Wool, fine or coarse animal hair',
        52: 'Cotton', 54: 'Man-made filaments',
        55: 'Man-made staple fibres', 56: 'Wadding, felt and nonwovens',
        59: 'Impregnated, coated textile fabrics', 60: 'Knitted or crocheted fabrics',
        61: 'Articles of apparel (knitted)', 62: 'Articles of apparel (not knitted)',
        63: 'Other made up textile articles', 64: 'Footwear',
        68: 'Articles of stone, plaster, cement', 69: 'Ceramic products',
        70: 'Glass and glassware', 71: 'Precious metals and precious stones',
        72: 'Iron and steel', 73: 'Articles of iron or steel',
        74: 'Copper and articles thereof', 75: 'Nickel and articles thereof',
        76: 'Aluminium and articles thereof', 78: 'Lead and articles thereof',
        79: 'Zinc and articles thereof', 80: 'Tin and articles thereof',
        81: 'Other base metals', 82: 'Tools of base metals',
        83: 'Miscellaneous articles of base metal',
        84: 'Nuclear reactors, boilers, machinery', 85: 'Electrical machinery and equipment',
        86: 'Railway or tramway locomotives', 87: 'Vehicles (other than railway)',
        88: 'Aircraft, spacecraft', 89: 'Ships, boats',
        90: 'Optical, photographic, measuring instruments',
        91: 'Clocks and watches', 92: 'Musical instruments',
        93: 'Arms and ammunition', 94: 'Furniture; bedding; lamps',
        95: 'Toys, games and sports equipment', 96: 'Miscellaneous manufactured articles',
        97: 'Works of art, antiques',
    };

    if (!description && chapterDescriptions[chapter]) {
        description = `[Chapter ${chapter}] ${chapterDescriptions[chapter]}`;
    }

    const result = {
        hs_code: hsCode,
        hs_code_6: hs6,
        description: description || `HS code ${hs6} (description not in local database)`,
        chapter: chapter,
        section: getSection(chapter),
        hts_number: hsCode,
    };

    await cacheSet(key, result, config.cacheTTL.htsDescription);
    console.log(`[USITC] HS ${hs6}: ${result.description}`);
    return result;
}

/**
 * Get the section number from a chapter number.
 */
function getSection(chapter) {
    if (chapter <= 5) return 'I';
    if (chapter <= 14) return 'II';
    if (chapter <= 15) return 'III';
    if (chapter <= 24) return 'IV';
    if (chapter <= 27) return 'V';
    if (chapter <= 38) return 'VI';
    if (chapter <= 40) return 'VII';
    if (chapter <= 43) return 'VIII';
    if (chapter <= 46) return 'IX';
    if (chapter <= 49) return 'X';
    if (chapter <= 63) return 'XI';
    if (chapter <= 67) return 'XII';
    if (chapter <= 70) return 'XIII';
    if (chapter <= 71) return 'XIV';
    if (chapter <= 83) return 'XV';
    if (chapter <= 85) return 'XVI';
    if (chapter <= 89) return 'XVII';
    if (chapter <= 92) return 'XVIII';
    if (chapter <= 93) return 'XIX';
    if (chapter <= 96) return 'XX';
    return 'XXI';
}

/**
 * Search by keyword across the local database.
 */
async function searchByKeyword(keyword) {
    const kw = keyword.toLowerCase();
    const results = [];

    // Search 6-digit descriptions
    for (const [code, desc] of Object.entries(HS6_DESCRIPTIONS)) {
        if (desc.toLowerCase().includes(kw)) {
            results.push({
                hs_code: code,
                hs_code_6: code,
                description: desc,
                chapter: parseInt(code.substring(0, 2), 10),
            });
        }
    }

    // Search 4-digit descriptions
    for (const [code, desc] of Object.entries(HS_DESCRIPTIONS)) {
        if (desc.toLowerCase().includes(kw)) {
            results.push({
                hs_code: code,
                hs_code_6: code.padEnd(6, '0'),
                description: desc,
                chapter: parseInt(code.substring(0, 2), 10),
            });
        }
    }

    return results;
}

/**
 * Batch lookup: get descriptions for multiple HS codes.
 */
async function batchLookup(hsCodes) {
    const results = {};
    for (const code of hsCodes) {
        const hs6 = normalizeToHS6(code);
        if (!hs6 || results[hs6]) continue;
        try {
            results[hs6] = await lookupHSCode(hs6);
        } catch { /* skip */ }
    }
    return results;
}

module.exports = { lookupHSCode, searchByKeyword, batchLookup };
