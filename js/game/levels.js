/**
 * STRUCTON THE GAME - Kampanjnivåer & Speluppdrag
 * Definierar markförhållanden, budget, mål, tillåtna material och besiktningstester.
 * Terrängen är kuperad berg- och jordyta som fortsätter utan avbrott åt sidorna.
 * Vissa nivåer har klyftor, vatten, bergssprickor och tunnlar där bergtäckningen
 * måste bära husvikten.
 */

export const LEVELS = [
    // 1. VILLA SOLBACKEN
    {
        id: 'level_1',
        name: 'Nivå 1: Villa Solbacken',
        subtitle: 'Småhusbyggnation & Grundläggning',
        category: 'residential',
        description: 'Välkommen till Structon! Ditt första uppdrag är att gjuta en betongplatta i den kuperade moränen och resa en stabil 2-plansvilla i trä. Marken och berget är kuperade som riktig natur – glöm inte snedsträvor i väggarna så att huset inte trycks snett när höstvindarna viner.',
        budget: 320000,
        targetHeight: 6.5,   // meter
        minFloors: 2,
        allowedMaterials: ['concrete_cast', 'wood', 'strut_wood'],
        ground: {
            seed: 11,
            leftX: -12,
            rightX: 12,
            surfaceY: 0,
            bedrockY: -3.2,
            surfaceAmp: 0.85,
            bedrockAmp: 1.15,
            soilType: 'stiff_soil',
            slopeAngle: 1.2,
            ravines: [
                { x: -32, width: 11, depth: 4.2, steepness: 1.5, cutsRock: true, water: true, waterLevel: -1.4 }
            ],
            anchorNodes: [
                { x: -7, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: -3.5, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 0, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 3.5, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 7, y: 0, fixed: true, soil: 'stiff_soil' }
            ]
        },
        testScenario: {
            duration: 8.0,      // sekunder
            wind: 14,           // m/s
            rain: 0.3,
            earthquake: 0,
            landslide: false,
            name: 'Höststorm & Regn'
        },
        starThresholds: {
            stars3_budget: 120000, // kvarvarande budget för 3 stjärnor
            stars2_budget: 40000,
            maxStressAllowed: 0.85
        }
    },

    // 2. KVARTERET TEGLET
    {
        id: 'level_2',
        name: 'Nivå 2: Kvarteret Teglet',
        subtitle: 'Stadskvarter i Tegel & Betong',
        category: 'commercial',
        description: 'Konstruera ett 4-vånings flerbostadshus med butiker i bottenplan. Under kvarteret finns en bergsspricka – lägg inte hela stommen på den svaga zonen. Tegel tål tryck bra men spricker vid dragkrafter, så kombinera med armerad betong och strävor!',
        budget: 950000,
        targetHeight: 13.5,
        minFloors: 4,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'brick', 'wood', 'strut_wood', 'strut_steel'],
        ground: {
            seed: 22,
            leftX: -16,
            rightX: 16,
            surfaceY: 0,
            bedrockY: -4.1,
            surfaceAmp: 0.7,
            bedrockAmp: 1.4,
            soilType: 'stiff_soil',
            slopeAngle: 0.4,
            cracks: [
                { x: 8.5, width: 1.1, depth: 7.5, openAtSurface: false }
            ],
            ravines: [
                { x: 36, width: 14, depth: 5.5, steepness: 1.35, cutsRock: true, water: true, waterLevel: -1.8 }
            ],
            anchorNodes: [
                { x: -10, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: -5, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 0, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 5, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 10, y: 0, fixed: true, soil: 'stiff_soil' }
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

    // 3. NORDIC TECH TOWER
    {
        id: 'level_3',
        name: 'Nivå 3: Nordic Tech Tower',
        subtitle: 'Kontorshöghus i Stål & Hisskärna',
        category: 'highrise',
        description: 'Bygg ett modernt 10-våningars kontorstorn på kuperat urberg. Till vänster skär en djup bergklyfta tomten – spänn inte pelare i luften över klyftan. På denna höjd ökar vindlasterna snabbt, så använd stålramar och strävor mot svaj.',
        budget: 2900000,
        targetHeight: 33.0,
        minFloors: 9,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood'],
        ground: {
            seed: 33,
            leftX: -18,
            rightX: 18,
            surfaceY: 0,
            bedrockY: -5.2,
            surfaceAmp: 1.05,
            bedrockAmp: 1.9,
            soilType: 'stiff_soil',
            slopeAngle: -0.8,
            ravines: [
                { x: -20, width: 9, depth: 8.5, steepness: 1.8, cutsRock: true, water: false }
            ],
            cracks: [
                { x: -20, width: 0.8, depth: 11, openAtSurface: true }
            ],
            anchorNodes: [
                { x: -12, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: -8, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: -4, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 0, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 4, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 8, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 12, y: 0, fixed: true, soil: 'stiff_soil' }
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

    // 4. SKYLINE SPIRE
    {
        id: 'level_4',
        name: 'Nivå 4: Skyline Spire',
        subtitle: 'Skyskrapa i Orkanstyrka',
        category: 'skyscraper',
        description: 'Bygg stadens nya landmärke – en skyskrapa över 65 meter. Under tomten går en bergtunnel: bergvolymen ovanför måste bära husvikten. Är täckningen för tunn måste du grunda mot fast berg vid sidan av tunneln, inte mitt över hålrummet. Till höger finns en vattenfylld klyfta och en öppen bergsspricka.',
        budget: 8200000,
        targetHeight: 68.0,
        minFloors: 18,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood', 'brick', 'pile'],
        ground: {
            seed: 44,
            leftX: -22,
            rightX: 22,
            surfaceY: 0,
            bedrockY: -6.4,
            surfaceAmp: 1.1,
            bedrockAmp: 2.0,
            soilType: 'stiff_soil',
            slopeAngle: 0.6,
            tunnels: [
                { x: -7, width: 9.5, height: 4.6, cover: 2.15, name: 'Servicetunnel' }
            ],
            cracks: [
                { x: 11, width: 1.3, depth: 9, openAtSurface: true }
            ],
            ravines: [
                { x: 28, width: 16, depth: 9, steepness: 1.45, cutsRock: true, water: true, waterLevel: -2.2 }
            ],
            anchorNodes: [
                { x: -15, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: -10, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: -5, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 0, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 5, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 10, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 15, y: 0, fixed: true, soil: 'stiff_soil' }
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

    // 5. GRAND SKYPORT TERMINAL
    {
        id: 'level_5',
        name: 'Nivå 5: Grand Skyport Terminal',
        subtitle: 'Flygplats & Skredkänslig Mark',
        category: 'airport',
        description: 'Terminalbyggnaden kräver en minst 36 meter bred öppen hall utan bärande pelare i mitten, på en sluttande lerstrand mot en vattenfylld klyfta. Slå betongpålar genom leran ner till fast berg – och undvik att ställa hela lasten på det tunna berget över strandens servicetunnel.',
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
            bedrockY: -9.2,
            surfaceAmp: 0.95,
            bedrockAmp: 1.8,
            soilType: 'soft_clay',
            hasClayLayer: true,
            slopeAngle: -4,
            tunnels: [
                { x: 6, width: 8, height: 4.2, cover: 2.6, name: 'Strandtunnel' }
            ],
            ravines: [
                { x: 26, width: 18, depth: 7.5, steepness: 1.3, cutsRock: true, water: true, waterLevel: -3.4 }
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
                { x: -4, y: 0.0, fixed: false, soil: 'soft_clay' },
                { x: 4, y: -0.6, fixed: false, soil: 'soft_clay' },
                { x: 12, y: -1.2, fixed: false, soil: 'soft_clay' },
                { x: 20, y: -1.8, fixed: false, soil: 'soft_clay' }
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

    // 6. BURJ STRUCTON (MEGASTRUCTURE)
    {
        id: 'level_6',
        name: 'Nivå 6: Burj Structon',
        subtitle: 'Megaskyskrapa & Naturkrafternas Raseri',
        category: 'megastructure',
        description: 'Det ultimata mästarprovet! Bygg en över 100 meter hög megaskyskrapa. Under vänstra delen av tomten löper en stor bergtunnel – den tunna bergskivan ovanför klarar inte hela tornvikten. Grunda i fast berg med tillräcklig volym vid sidan av, eller genom, tunneln. Till vänster gapar en djup vattenklyfta och berget är genomsprucket.',
        budget: 30000000,
        targetHeight: 105.0,
        minFloors: 28,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood', 'brick', 'pile'],
        ground: {
            seed: 66,
            leftX: -32,
            rightX: 32,
            surfaceY: 0,
            bedrockY: -10.5,
            surfaceAmp: 1.35,
            bedrockAmp: 2.4,
            soilType: 'stiff_soil',
            slopeAngle: 0.3,
            tunnels: [
                { x: -10, width: 14, height: 6.2, cover: 1.85, name: 'Huvudtunnel' }
            ],
            cracks: [
                { x: -22, width: 1.0, depth: 12, openAtSurface: false },
                { x: 14, width: 1.4, depth: 10, openAtSurface: true }
            ],
            ravines: [
                { x: -38, width: 20, depth: 14, steepness: 1.65, cutsRock: true, water: true, waterLevel: -5.5 }
            ],
            anchorNodes: [
                { x: -22, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: -15, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: -8, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 0, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 8, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 15, y: 0, fixed: true, soil: 'stiff_soil' },
                { x: 22, y: 0, fixed: true, soil: 'stiff_soil' }
            ]
        },
        testScenario: {
            duration: 18.0,
            wind: 45,
            rain: 0.9,
            earthquake: 7.2,
            landslide: false,
            name: 'Kategori 5 Orkan & Jordbävning 7.2'
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
    description: 'Obegränsad budget, alla material upplåsta och fria kontroller över väder- och katastrofreglage. Terrängen har klyfta, vatten, bergsspricka och tunnel – prova hur bergtäckningen klarar huslasten.',
    budget: 999999999,
    targetHeight: 0,
    minFloors: 0,
    allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood', 'strut_wood', 'brick', 'pile'],
    ground: {
        seed: 77,
        leftX: -40,
        rightX: 40,
        surfaceY: 0,
        bedrockY: -8.5,
        surfaceAmp: 1.4,
        bedrockAmp: 2.2,
        soilType: 'stiff_soil',
        slopeAngle: 0.5,
        tunnels: [
            { x: 4, width: 11, height: 5.0, cover: 2.3, name: 'Labbtunnel' }
        ],
        cracks: [
            { x: -16, width: 1.2, depth: 9, openAtSurface: true }
        ],
        ravines: [
            { x: -30, width: 16, depth: 10, steepness: 1.5, cutsRock: true, water: true, waterLevel: -3.0 }
        ],
        anchorNodes: [
            { x: -28, y: 0, fixed: true, soil: 'stiff_soil' },
            { x: -20, y: 0, fixed: true, soil: 'stiff_soil' },
            { x: -12, y: 0, fixed: true, soil: 'stiff_soil' },
            { x: -4, y: 0, fixed: true, soil: 'stiff_soil' },
            { x: 4, y: 0, fixed: true, soil: 'stiff_soil' },
            { x: 12, y: 0, fixed: true, soil: 'stiff_soil' },
            { x: 20, y: 0, fixed: true, soil: 'stiff_soil' },
            { x: 28, y: 0, fixed: true, soil: 'stiff_soil' }
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
