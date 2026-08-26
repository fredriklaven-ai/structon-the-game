/**
 * STRUCTON THE GAME - Materialdatabas & Egenskaper
 * Innehåller hållfasthetsvärden (drag/tryck), E-modul, densitet, kostnad och visuella stilar.
 */

export const MATERIALS = {
    // 1. Platsgjuten betong (Cast-in-place concrete)
    concrete_cast: {
        id: 'concrete_cast',
        name: 'Platsgjuten Betong',
        shortName: 'Betong',
        category: 'foundation',
        description: 'Tung med extrem tryckhållfasthet, men spröd i drag. Perfekt för grundplattor, källare och tunga bärande väggar.',
        costPerMeter: 1200,      // kr/m
        density: 2400,           // kg/m³
        youngsModulus: 30e9,     // 30 GPa
        maxCompression: 40e6,    // 40 MPa
        maxTension: 3.5e6,       // 3.5 MPa (låg draghållfasthet utan armering)
        shearStrength: 5e6,      // 5 MPa
        thickness: 16,           // px bredd på canvas
        color: '#8A95A5',
        borderColor: '#5B6675',
        textureType: 'concrete',
        soundType: 'concrete',
        maxSpan: 6.0,            // max rekommenderad spännvidd (m)
        isFoundation: true
    },

    // 2. Armerad betong (Reinforced concrete)
    concrete_reinforced: {
        id: 'concrete_reinforced',
        name: 'Armerad Betong',
        shortName: 'Arm. Betong',
        category: 'core',
        description: 'Betong förstärkt med armeringsstål. Klarar både mycket högt tryck och hög dragbelastning. Utmärkt för pelare och kärnor.',
        costPerMeter: 2400,
        density: 2500,
        youngsModulus: 35e9,     // 35 GPa
        maxCompression: 55e6,    // 55 MPa
        maxTension: 28e6,        // 28 MPa (armeringen tar drag)
        shearStrength: 18e6,     // 18 MPa
        thickness: 14,
        color: '#707E94',
        borderColor: '#3D4856',
        accentColor: '#38BDF8',
        textureType: 'reinforced_concrete',
        soundType: 'concrete',
        maxSpan: 9.0
    },

    // 3. Konstruktionsstål (Structural Steel)
    steel: {
        id: 'steel',
        name: 'Konstruktionsstål (HEA/HEB)',
        shortName: 'Stål',
        category: 'frame',
        description: 'Extremt starkt i både drag och tryck, elastiskt och duktilt. Lättare än betong men dyrbart. Bästa valet för höga skyskrapor och långa spännvidder.',
        costPerMeter: 4500,
        density: 7850,
        youngsModulus: 210e9,    // 210 GPa (mycket styvt)
        maxCompression: 350e6,   // 350 MPa
        maxTension: 350e6,       // 350 MPa
        shearStrength: 200e6,    // 200 MPa
        thickness: 10,
        color: '#3B82F6',
        borderColor: '#1E3A8A',
        accentColor: '#93C5FD',
        textureType: 'steel_ibeam',
        soundType: 'steel',
        maxSpan: 18.0
    },

    // 4. Trä / Limträ (Timber / Glulam)
    wood: {
        id: 'wood',
        name: 'Trä / Limträ',
        shortName: 'Trä',
        category: 'frame',
        description: 'Lätt, flexibelt och prisvärt med lågt klimatavtryck. Perfekt för villor och lägre stommar, men svajar lättare i höga hus om det inte strävas.',
        costPerMeter: 800,
        density: 500,
        youngsModulus: 12e9,     // 12 GPa
        maxCompression: 24e6,    // 24 MPa
        maxTension: 18e6,        // 18 MPa
        shearStrength: 4e6,      // 4 MPa
        thickness: 12,
        color: '#D97706',
        borderColor: '#92400E',
        accentColor: '#FDE68A',
        textureType: 'wood_grain',
        soundType: 'wood',
        maxSpan: 7.0
    },

    // 5. Tegel / Murverk (Masonry / Brick)
    brick: {
        id: 'brick',
        name: 'Murat Tegel',
        shortName: 'Tegel',
        category: 'facade',
        description: 'Klassiskt byggnadsmaterial med god tryckhållfasthet och hög tyngd. Mycket känsligt för drag, skjuvning och jordbävningskrafter.',
        costPerMeter: 1500,
        density: 1900,
        youngsModulus: 15e9,     // 15 GPa
        maxCompression: 20e6,    // 20 MPa
        maxTension: 1.2e6,       // 1.2 MPa (spricker omedelbart vid drag)
        shearStrength: 2.0e6,    // 2 MPa
        thickness: 15,
        color: '#B91C1C',
        borderColor: '#7F1D1D',
        accentColor: '#FCA5A5',
        textureType: 'brick_pattern',
        soundType: 'brick',
        maxSpan: 5.0
    },

    // 6. Stålsträva / Kryssförband (Steel Cross-Bracing)
    strut_steel: {
        id: 'strut_steel',
        name: 'Stålsträva (Fackverk)',
        shortName: 'Stålsträva',
        category: 'bracing',
        description: 'Smal diagonal stagning i höghållfast stål. Tar upp horisontella vindkrafter och seismiska skjuvkrafter, hindrar byggnaden från att svaja eller vika sig.',
        costPerMeter: 2200,
        density: 7850,
        youngsModulus: 210e9,
        maxCompression: 180e6,   // Slank profil har lägre knäcklast i tryck
        maxTension: 380e6,       // Mycket stark i drag
        shearStrength: 150e6,
        thickness: 6,
        color: '#06B6D4',
        borderColor: '#0891B2',
        accentColor: '#67E8F9',
        textureType: 'cable_strut',
        soundType: 'steel',
        isStrut: true,
        maxSpan: 22.0
    },

    // 7. Trästräva (Wood Bracing)
    strut_wood: {
        id: 'strut_wood',
        name: 'Trästräva (Snedsträva)',
        shortName: 'Trästräva',
        category: 'bracing',
        description: 'Diagonal träförstärkning för villor och takstolar för att motverka vindskjuvning.',
        costPerMeter: 600,
        density: 500,
        youngsModulus: 12e9,
        maxCompression: 16e6,
        maxTension: 18e6,
        shearStrength: 3.5e6,
        thickness: 7,
        color: '#F59E0B',
        borderColor: '#B45309',
        textureType: 'wood_grain',
        soundType: 'wood',
        isStrut: true,
        maxSpan: 8.0
    },

    // 8. Betongpåle (Foundation Pile)
    pile: {
        id: 'pile',
        name: 'Slagen Betongpåle',
        shortName: 'Påle',
        category: 'foundation',
        description: 'Djupgrundläggning som slås genom lös lera ner till fast berg. Förhindrar sättningar och katastrofala jordskred vid storm och regn.',
        costPerMeter: 3200,
        density: 2600,
        youngsModulus: 40e9,
        maxCompression: 60e6,
        maxTension: 20e6,
        shearStrength: 25e6,
        thickness: 16,
        color: '#475569',
        borderColor: '#1E293B',
        accentColor: '#94A3B8',
        textureType: 'pile_pattern',
        soundType: 'concrete',
        isPile: true,
        maxSpan: 30.0
    }
};

/**
 * Marktyper för grundläggningsanalys.
 * Lager (grus, sand, morän, lös/fast lera) varierar i mäktighet och läge;
 * blöt lös lera kräver pålning och ger hög skredrisk i branta sluttningar mot vatten.
 */
export const SOIL_TYPES = {
    bedrock: {
        id: 'bedrock',
        name: 'Fast Urberg',
        shortName: 'Urberg',
        color: '#334155',
        fillColor: '#1B2434',
        bearingCapacity: Infinity,
        landslideRisk: 0.0,
        settlementRate: 0.0,
        stiffness: 1.0,
        density: 2700,
        requiresPiling: false,
        grassTint: '#15803D'
    },
    gravel: {
        id: 'gravel',
        name: 'Grus',
        shortName: 'Grus',
        color: '#A8A29E',
        fillColor: '#78716C',
        bearingCapacity: 500000,
        landslideRisk: 0.08,
        settlementRate: 0.03,
        stiffness: 0.92,
        density: 2000,
        requiresPiling: false,
        grassTint: '#4D7C0F'
    },
    sand: {
        id: 'sand',
        name: 'Sand',
        shortName: 'Sand',
        color: '#D6B56D',
        fillColor: '#B45309',
        bearingCapacity: 250000,
        landslideRisk: 0.22,
        settlementRate: 0.12,
        stiffness: 0.72,
        density: 1800,
        requiresPiling: false,
        grassTint: '#CA8A04'
    },
    moraine: {
        id: 'moraine',
        name: 'Morän',
        shortName: 'Morän',
        color: '#78350F',
        fillColor: '#3E2723',
        bearingCapacity: 350000,
        landslideRisk: 0.12,
        settlementRate: 0.05,
        stiffness: 0.85,
        density: 2100,
        requiresPiling: false,
        grassTint: '#15803D'
    },
    // Bakåtkompatibilitet: äldre nivåer använde stiff_soil = morän
    stiff_soil: {
        id: 'stiff_soil',
        name: 'Morän',
        shortName: 'Morän',
        color: '#78350F',
        fillColor: '#3E2723',
        bearingCapacity: 350000,
        landslideRisk: 0.12,
        settlementRate: 0.05,
        stiffness: 0.85,
        density: 2100,
        requiresPiling: false,
        grassTint: '#15803D',
        aliasOf: 'moraine'
    },
    stiff_clay: {
        id: 'stiff_clay',
        name: 'Fast lera',
        shortName: 'Fast lera',
        color: '#9A3412',
        fillColor: '#7C2D12',
        bearingCapacity: 180000,
        landslideRisk: 0.35,
        settlementRate: 0.18,
        stiffness: 0.58,
        density: 1900,
        requiresPiling: false,
        grassTint: '#A16207'
    },
    soft_clay: {
        id: 'soft_clay',
        name: 'Lös lera',
        shortName: 'Lös lera',
        color: '#92400E',
        fillColor: '#5A2A18',
        bearingCapacity: 90000,
        landslideRisk: 0.72,
        settlementRate: 0.4,
        stiffness: 0.38,
        density: 1700,
        requiresPiling: true,
        grassTint: '#854D0E'
    },
    wet_soft_clay: {
        id: 'wet_soft_clay',
        name: 'Blöt lös lera',
        shortName: 'Blöt lera',
        color: '#713F12',
        fillColor: '#3F1F12',
        bearingCapacity: 45000,
        landslideRisk: 0.92,
        settlementRate: 0.65,
        stiffness: 0.22,
        density: 1650,
        requiresPiling: true,
        grassTint: '#78350F'
    }
};

/** Normalisera jordart-id (stiff_soil → moraine). */
export function resolveSoilId(id) {
    if (!id) return 'moraine';
    if (id === 'stiff_soil') return 'moraine';
    return SOIL_TYPES[id] ? id : 'moraine';
}

export function getSoil(id) {
    const key = resolveSoilId(id);
    return SOIL_TYPES[key] || SOIL_TYPES.moraine;
}

/** Jordarter som kan glida vid skred (ej berg). */
export function isLandslideProneSoil(id) {
    const soil = getSoil(id);
    return soil.id !== 'bedrock' && soil.landslideRisk >= 0.4;
}
