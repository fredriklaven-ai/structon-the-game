/**
 * STRUCTON THE GAME - Kampanjnivåer & Speluppdrag
 * Definierar markförhållanden, budget, mål, tillåtna material och besiktningstester.
 * Terrängen är kuperad berg- och jordyta som fortsätter utan avbrott åt sidorna.
 * Jordlager (grus, sand, morän, lös/fast lera) varierar i mäktighet; senare nivåer
 * har tjockare och svårare material (blöt lös lera kräver pålning, skredrisk mot vatten).
 */

export const LEVELS = [
    // 1. VILLA SOLBACKEN – tunn morän med grus/sand
    {
        id: 'level_1',
        name: 'Nivå 1: Villa Solbacken',
        subtitle: 'Småhusbyggnation & Grundläggning',
        category: 'residential',
        description: 'Välkommen till Structon! Ditt första uppdrag är att gjuta en betongplatta i den kuperade moränen och resa en stabil 2-plansvilla i trä. Marken består av tunt grus och sand över morän – glöm inte snedsträvor i väggarna så att huset inte trycks snett när höstvindarna viner.',
        budget: 320000,
        targetHeight: 6.5,   // meter
        minFloors: 2,
        allowedMaterials: ['concrete_cast', 'wood', 'strut_wood'],
        ground: {
            seed: 11,
            leftX: -12,
            rightX: 12,
            surfaceY: 0,
            bedrockY: -2.8,
            surfaceAmp: 1.85,
            bedrockAmp: 2.4,
            soilType: 'moraine',
            soilLayers: [
                { type: 'gravel', share: 0.18 },
                { type: 'sand', share: 0.22 },
                { type: 'moraine', share: 0.60 }
            ],
            slopeAngle: 1.2,
            ravines: [
                { x: -22, width: 12, depth: 5.4, steepness: 1.45, cutsRock: true, water: true, waterLevel: -1.6 }
            ],
            anchorNodes: [
                { x: -7, y: 0, fixed: true, soil: 'moraine' },
                { x: -3.5, y: 0, fixed: true, soil: 'moraine' },
                { x: 0, y: 0, fixed: true, soil: 'moraine' },
                { x: 3.5, y: 0, fixed: true, soil: 'moraine' },
                { x: 7, y: 0, fixed: true, soil: 'moraine' }
            ]
        },
        testScenario: {
            duration: 8.0,
            wind: 14,
            rain: 0.3,
            earthquake: 0,
            landslide: false,
            name: 'Höststorm & Regn'
        },
        starThresholds: {
            stars3_budget: 120000,
            stars2_budget: 40000,
            maxStressAllowed: 0.85
        }
    },

    // 2. KVARTERET TEGLET – sand + morän, tjockare
    {
        id: 'level_2',
        name: 'Nivå 2: Kvarteret Teglet',
        subtitle: 'Stadskvarter i Tegel & Betong',
        category: 'commercial',
        description: 'Konstruera ett 4-vånings flerbostadshus med butiker i bottenplan. Under kvarteret finns en bergsspricka – lägg inte hela stommen på den svaga zonen. Marken är sand över morän med växlande mäktighet. Tegel tål tryck bra men spricker vid dragkrafter, så kombinera med armerad betong och strävor!',
        budget: 950000,
        targetHeight: 13.5,
        minFloors: 4,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'brick', 'wood', 'strut_wood', 'strut_steel'],
        ground: {
            seed: 22,
            leftX: -16,
            rightX: 16,
            surfaceY: 0,
            bedrockY: -4.4,
            surfaceAmp: 1.55,
            bedrockAmp: 2.5,
            soilType: 'sand',
            soilLayers: [
                { type: 'sand', share: 0.35 },
                { type: 'gravel', share: 0.15 },
                { type: 'moraine', share: 0.50 }
            ],
            slopeAngle: 0.4,
            cracks: [
                { x: 8.5, width: 1.1, depth: 7.5, openAtSurface: false }
            ],
            ravines: [
                { x: 36, width: 14, depth: 5.5, steepness: 1.35, cutsRock: true, water: true, waterLevel: -1.8 }
            ],
            anchorNodes: [
                { x: -10, y: 0, fixed: true, soil: 'sand' },
                { x: -5, y: 0, fixed: true, soil: 'sand' },
                { x: 0, y: 0, fixed: true, soil: 'moraine' },
                { x: 5, y: 0, fixed: true, soil: 'sand' },
                { x: 10, y: 0, fixed: true, soil: 'moraine' }
            ]
        },
        testScenario: {
            duration: 10.0,
            wind: 22,
            rain: 0.5,
            earthquake: 2.2,
            landslide: false,
            name: 'Kulingbyar & Mikroskalv'
        },
        starThresholds: {
            stars3_budget: 280000,
            stars2_budget: 100000,
            maxStressAllowed: 0.88
        }
    },

    // 3. NORDIC TECH TOWER – fast lera-linser, djupare
    {
        id: 'level_3',
        name: 'Nivå 3: Nordic Tech Tower',
        subtitle: 'Kontorshöghus i Stål & Hisskärna',
        category: 'highrise',
        description: 'Bygg ett modernt 10-våningars kontorstorn på kuperat urberg. Till vänster skär en djup bergklyfta tomten – spänn inte pelare i luften över klyftan. Jordprofilen växlar mellan grus, morän och fast lera. På denna höjd ökar vindlasterna snabbt, så använd stålramar och strävor mot svaj.',
        budget: 2900000,
        targetHeight: 33.0,
        minFloors: 9,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood'],
        ground: {
            seed: 33,
            leftX: -18,
            rightX: 18,
            surfaceY: 0,
            bedrockY: -5.8,
            surfaceAmp: 2.1,
            bedrockAmp: 3.0,
            soilType: 'stiff_clay',
            soilLayers: [
                { type: 'gravel', share: 0.10 },
                { type: 'sand', share: 0.18 },
                { type: 'stiff_clay', share: 0.32 },
                { type: 'moraine', share: 0.40 }
            ],
            slopeAngle: -0.8,
            ravines: [
                { x: -18, width: 8, depth: 7.2, steepness: 1.75, cutsRock: true, water: false }
            ],
            cracks: [
                { x: -18, width: 0.8, depth: 11, openAtSurface: true }
            ],
            anchorNodes: [
                { x: -12, y: 0, fixed: true, soil: 'moraine' },
                { x: -8, y: 0, fixed: true, soil: 'stiff_clay' },
                { x: -4, y: 0, fixed: true, soil: 'moraine' },
                { x: 0, y: 0, fixed: true, soil: 'stiff_clay' },
                { x: 4, y: 0, fixed: true, soil: 'moraine' },
                { x: 8, y: 0, fixed: true, soil: 'stiff_clay' },
                { x: 12, y: 0, fixed: true, soil: 'moraine' }
            ]
        },
        testScenario: {
            duration: 12.0,
            wind: 28,
            rain: 0.6,
            earthquake: 4.0,
            landslide: false,
            name: 'Stark Storm & Seismiskt Prov'
        },
        starThresholds: {
            stars3_budget: 750000,
            stars2_budget: 300000,
            maxStressAllowed: 0.90
        }
    },

    // 4. SKYLINE SPIRE – lös lera mot vatten, pålar upplåsta
    {
        id: 'level_4',
        name: 'Nivå 4: Skyline Spire',
        subtitle: 'Skyskrapa i Orkanstyrka',
        category: 'skyscraper',
        description: 'Bygg stadens nya landmärke – en skyskrapa över 65 meter. Under tomten går en bergtunnel. Mot den vattenfyllda klyftan till höger tjocknar lös lera – överväg pålar till berg. Är bergtäckningen över tunneln för tunn måste du grunda mot fast berg vid sidan.',
        budget: 8200000,
        targetHeight: 68.0,
        minFloors: 18,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood', 'brick', 'pile'],
        ground: {
            seed: 44,
            leftX: -22,
            rightX: 22,
            surfaceY: 0,
            bedrockY: -7.2,
            surfaceAmp: 2.0,
            bedrockAmp: 3.1,
            soilType: 'soft_clay',
            hasClayLayer: true,
            soilLayers: [
                { type: 'sand', share: 0.10 },
                { type: 'soft_clay', share: 0.28 },
                { type: 'stiff_clay', share: 0.22 },
                { type: 'moraine', share: 0.40 }
            ],
            clayNearWater: {
                maxDist: 26,
                wetType: 'wet_soft_clay',
                softType: 'soft_clay',
                strength: 0.75
            },
            slopeAngle: 0.6,
            tunnels: [
                { x: -7, width: 9.5, height: 4.6, cover: 2.15, name: 'Servicetunnel' }
            ],
            cracks: [
                { x: 11, width: 1.3, depth: 9, openAtSurface: true }
            ],
            ravines: [
                { x: 24, width: 14, depth: 8.5, steepness: 1.4, cutsRock: true, water: true, waterLevel: -2.0 }
            ],
            anchorNodes: [
                { x: -15, y: 0, fixed: true, soil: 'moraine' },
                { x: -10, y: 0, fixed: true, soil: 'stiff_clay' },
                { x: -5, y: 0, fixed: true, soil: 'moraine' },
                { x: 0, y: 0, fixed: true, soil: 'soft_clay' },
                { x: 5, y: 0, fixed: true, soil: 'soft_clay' },
                { x: 10, y: 0, fixed: true, soil: 'soft_clay' },
                { x: 15, y: 0, fixed: true, soil: 'soft_clay' }
            ]
        },
        testScenario: {
            duration: 14.0,
            wind: 35,
            rain: 0.7,
            earthquake: 5.5,
            landslide: false,
            name: 'Orkanbyar (35 m/s) & Magnitud 5.5'
        },
        starThresholds: {
            stars3_budget: 2000000,
            stars2_budget: 800000,
            maxStressAllowed: 0.92
        }
    },

    // 5. GRAND SKYPORT – blöt lös lera, brant mot vatten, skred
    {
        id: 'level_5',
        name: 'Nivå 5: Grand Skyport Terminal',
        subtitle: 'Flygplats & Skredkänslig Mark',
        category: 'airport',
        description: 'Terminalbyggnaden kräver en minst 36 meter bred öppen hall utan bärande pelare i mitten, på en brant lerstrand mot en vattenfylld klyfta. Här är mäktig blöt lös lera – slå betongpålar ner till fast berg. Vid skyfall kan leran skreda i sluttningen ned mot vattnet.',
        budget: 12500000,
        targetHeight: 18.0,
        targetSpan: 36.0,
        minFloors: 3,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood', 'pile'],
        ground: {
            seed: 55,
            leftX: -28,
            rightX: 28,
            surfaceY: 0,
            bedrockY: -11.5,
            surfaceAmp: 1.7,
            bedrockAmp: 2.6,
            soilType: 'wet_soft_clay',
            hasClayLayer: true,
            soilLayers: [
                { type: 'sand', share: 0.05 },
                { type: 'wet_soft_clay', share: 0.42 },
                { type: 'soft_clay', share: 0.28 },
                { type: 'stiff_clay', share: 0.15 },
                { type: 'moraine', share: 0.10 }
            ],
            clayNearWater: {
                maxDist: 30,
                wetType: 'wet_soft_clay',
                softType: 'soft_clay',
                strength: 0.95
            },
            slopeAngle: -4,
            tunnels: [
                { x: 6, width: 8, height: 4.2, cover: 2.6, name: 'Strandtunnel' }
            ],
            ravines: [
                { x: 22, width: 16, depth: 7.2, steepness: 1.3, cutsRock: true, water: true, waterLevel: -3.2 }
            ],
            waterBodies: [
                { x: 34, width: 22, surfaceY: -3.4 }
            ],
            anchorNodes: [
                { x: -24, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: -16, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: -8, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: 0, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: 8, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: 16, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: 24, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: -20, y: 1.2, fixed: false, soil: 'soft_clay' },
                { x: -12, y: 0.6, fixed: false, soil: 'soft_clay' },
                { x: -4, y: 0.0, fixed: false, soil: 'wet_soft_clay' },
                { x: 4, y: -0.6, fixed: false, soil: 'wet_soft_clay' },
                { x: 12, y: -1.2, fixed: false, soil: 'wet_soft_clay' },
                { x: 20, y: -1.8, fixed: false, soil: 'wet_soft_clay' }
            ]
        },
        testScenario: {
            duration: 15.0,
            wind: 26,
            rain: 0.95,
            earthquake: 3.8,
            landslide: true,
            name: 'Jordskredsrisk, Skyfall & Taklaster'
        },
        starThresholds: {
            stars3_budget: 3200000,
            stars2_budget: 1200000,
            maxStressAllowed: 0.92
        }
    },

    // 6. BURJ STRUCTON – tjock blandad profil, lerzon vid klyfta
    {
        id: 'level_6',
        name: 'Nivå 6: Burj Structon',
        subtitle: 'Megaskyskrapa & Naturkrafternas Raseri',
        category: 'megastructure',
        description: 'Det ultimata mästarprovet! Bygg en över 100 meter hög megaskyskrapa. Under vänstra delen löper en bergtunnel. Mot den djupa vattenklyftan till vänster ligger mäktig blöt lös lera med skredrisk – påla till berg. Grunda i fast berg med tillräcklig volym vid sidan av tunneln.',
        budget: 30000000,
        targetHeight: 105.0,
        minFloors: 28,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood', 'brick', 'pile'],
        ground: {
            seed: 66,
            leftX: -32,
            rightX: 32,
            surfaceY: 0,
            bedrockY: -12.5,
            surfaceAmp: 2.4,
            bedrockAmp: 3.4,
            soilType: 'soft_clay',
            hasClayLayer: true,
            soilLayers: [
                { type: 'gravel', share: 0.08 },
                { type: 'sand', share: 0.12 },
                { type: 'soft_clay', share: 0.30 },
                { type: 'stiff_clay', share: 0.20 },
                { type: 'moraine', share: 0.30 }
            ],
            clayNearWater: {
                maxDist: 28,
                wetType: 'wet_soft_clay',
                softType: 'soft_clay',
                strength: 0.85
            },
            slopeAngle: 0.3,
            tunnels: [
                { x: -10, width: 14, height: 6.2, cover: 1.85, name: 'Huvudtunnel' }
            ],
            cracks: [
                { x: -22, width: 1.0, depth: 12, openAtSurface: false },
                { x: 14, width: 1.4, depth: 10, openAtSurface: true }
            ],
            ravines: [
                { x: -30, width: 16, depth: 12, steepness: 1.6, cutsRock: true, water: true, waterLevel: -4.8 }
            ],
            anchorNodes: [
                { x: -22, y: 0, fixed: true, soil: 'wet_soft_clay' },
                { x: -15, y: 0, fixed: true, soil: 'soft_clay' },
                { x: -8, y: 0, fixed: true, soil: 'stiff_clay' },
                { x: 0, y: 0, fixed: true, soil: 'moraine' },
                { x: 8, y: 0, fixed: true, soil: 'moraine' },
                { x: 15, y: 0, fixed: true, soil: 'sand' },
                { x: 22, y: 0, fixed: true, soil: 'gravel' }
            ]
        },
        testScenario: {
            duration: 18.0,
            wind: 45,
            rain: 0.9,
            earthquake: 7.2,
            landslide: true,
            name: 'Kategori 5 Orkan, Skred & Jordbävning 7.2'
        },
        starThresholds: {
            stars3_budget: 7000000,
            stars2_budget: 2500000,
            maxStressAllowed: 0.94
        }
    }
];

// SANDLÅDELÄGE (SANDBOX)
export const SANDBOX_LEVEL = {
    id: 'sandbox',
    name: 'Sandlådeläge (Katastroflabb)',
    subtitle: 'Fritt Bygge & Experiment',
    category: 'sandbox',
    description: 'Obegränsad budget, alla material upplåsta. Terrängen visar grus, sand, morän, fast och lös lera med blöt lerzon mot vattenklyftan – prova skred, pålning och bergtäckning över tunneln.',
    budget: 999999999,
    targetHeight: 0,
    minFloors: 0,
    allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood', 'strut_wood', 'brick', 'pile'],
    ground: {
        seed: 77,
        leftX: -40,
        rightX: 40,
        surfaceY: 0,
        bedrockY: -10.0,
        surfaceAmp: 2.3,
        bedrockAmp: 3.2,
        soilType: 'moraine',
        hasClayLayer: true,
        soilLayers: [
            { type: 'gravel', share: 0.12 },
            { type: 'sand', share: 0.18 },
            { type: 'soft_clay', share: 0.22 },
            { type: 'stiff_clay', share: 0.18 },
            { type: 'moraine', share: 0.30 }
        ],
        clayNearWater: {
            maxDist: 24,
            wetType: 'wet_soft_clay',
            softType: 'soft_clay',
            strength: 0.8
        },
        slopeAngle: 0.5,
        tunnels: [
            { x: 4, width: 11, height: 5.0, cover: 2.3, name: 'Labbtunnel' }
        ],
        cracks: [
            { x: -16, width: 1.2, depth: 9, openAtSurface: true }
        ],
        ravines: [
            { x: -24, width: 14, depth: 9, steepness: 1.45, cutsRock: true, water: true, waterLevel: -2.6 }
        ],
        anchorNodes: [
            { x: -28, y: 0, fixed: true, soil: 'wet_soft_clay' },
            { x: -20, y: 0, fixed: true, soil: 'soft_clay' },
            { x: -12, y: 0, fixed: true, soil: 'stiff_clay' },
            { x: -4, y: 0, fixed: true, soil: 'moraine' },
            { x: 4, y: 0, fixed: true, soil: 'sand' },
            { x: 12, y: 0, fixed: true, soil: 'gravel' },
            { x: 20, y: 0, fixed: true, soil: 'moraine' },
            { x: 28, y: 0, fixed: true, soil: 'sand' }
        ]
    },
    testScenario: {
        duration: 99999,
        wind: 0,
        rain: 0,
        earthquake: 0,
        landslide: false,
        name: 'Anpassad Katastrof'
    }
};
