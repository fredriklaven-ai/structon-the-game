/**
 * STRUCTON THE GAME - Kampanjnivåer & Speluppdrag
 * Definierar markförhållanden, budget, mål, tillåtna material och besiktningstester.
 */

export const LEVELS = [
    // 1. VILLA SOLBACKEN
    {
        id: 'level_1',
        name: 'Nivå 1: Villa Solbacken',
        subtitle: 'Småhusbyggnation & Grundläggning',
        category: 'residential',
        description: 'Välkommen till Structon! Ditt första uppdrag är att gjuta en betongplatta i marken och resa en stabil 2-plansvilla i trä. Glöm inte snedsträvor i väggarna så att huset inte trycks snett när höstvindarna viner.',
        budget: 320000,
        targetHeight: 6.5,   // meter
        minFloors: 2,
        allowedMaterials: ['concrete_cast', 'wood', 'strut_wood'],
        ground: {
            leftX: -12,
            rightX: 12,
            surfaceY: 0,
            bedrockY: -3,
            soilType: 'stiff_soil',
            slopeAngle: 0,
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
        description: 'Konstruera ett 4-vånings flerbostadshus med butiker i bottenplan. Tegel är vackert och tål tryck bra men spricker lätt vid dragkrafter – kombinera med armerad betong och strävor!',
        budget: 950000,
        targetHeight: 13.5,
        minFloors: 4,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'brick', 'wood', 'strut_wood', 'strut_steel'],
        ground: {
            leftX: -16,
            rightX: 16,
            surfaceY: 0,
            bedrockY: -4,
            soilType: 'stiff_soil',
            slopeAngle: 0,
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
        description: 'Bygg ett modernt 10-våningars kontorstorn. På denna höjd ökar vindlasterna exponentiellt. Använd stålramar och en styv stomme med stålsträvor för att stoppa svajet.',
        budget: 2900000,
        targetHeight: 33.0,
        minFloors: 9,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood'],
        ground: {
            leftX: -18,
            rightX: 18,
            surfaceY: 0,
            bedrockY: -5,
            soilType: 'stiff_soil',
            slopeAngle: 0,
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
        description: 'Bygg stadens nya landmärke – en ståtlig skyskrapa över 65 meter hög! Pelarna i de nedre våningarna utsätts för enorma tryckkrafter och knäckrisk.',
        budget: 8200000,
        targetHeight: 68.0,
        minFloors: 18,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood', 'brick', 'pile'],
        ground: {
            leftX: -22,
            rightX: 22,
            surfaceY: 0,
            bedrockY: -6,
            soilType: 'stiff_soil',
            slopeAngle: 0,
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
        description: 'Terminalbyggnaden kräver en minst 36 meter bred öppen hall utan bärande pelare i mitten, på en sluttande lerstrand. Slå betongpålar ner till fast berg för att hindra att marken skrider vid ösregn!',
        budget: 12500000,
        targetHeight: 18.0,
        targetSpan: 36.0,
        minFloors: 3,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood', 'pile'],
        ground: {
            leftX: -28,
            rightX: 28,
            surfaceY: 0,
            bedrockY: -9,
            soilType: 'soft_clay',
            hasClayLayer: true,
            slopeAngle: -4, // Sluttning mot höger
            anchorNodes: [
                // Bergförankring djupt nere
                { x: -24, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: -16, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: -8, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: 0, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: 8, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: 16, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },
                { x: 24, y: -8, fixed: true, soil: 'bedrock', isBedrock: true },

                // Ytnoder i mjuk lera (kan skriva/glida om ej pålade)
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
        description: 'Det ultimata mästarprovet! Bygg en över 100 meter hög megaskyskrapa som klarar orkan, kraftig jordbävning och ösregn samtidigt. Använd avancerad fackverksteknik och massiva betongkärnor.',
        budget: 30000000,
        targetHeight: 105.0,
        minFloors: 28,
        allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood', 'brick', 'pile'],
        ground: {
            leftX: -32,
            rightX: 32,
            surfaceY: 0,
            bedrockY: -10,
            soilType: 'stiff_soil',
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
    description: 'Obegränsad budget, alla material upplåsta och fria kontroller över väder- och katastrofreglage.',
    budget: 999999999,
    targetHeight: 0,
    minFloors: 0,
    allowedMaterials: ['concrete_cast', 'concrete_reinforced', 'steel', 'strut_steel', 'wood', 'strut_wood', 'brick', 'pile'],
    ground: {
        leftX: -40,
        rightX: 40,
        surfaceY: 0,
        bedrockY: -8,
        soilType: 'stiff_soil',
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
