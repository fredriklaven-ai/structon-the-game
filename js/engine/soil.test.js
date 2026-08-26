/**
 * Tester för varierande jordlager, mäktighet, progression och skredrisk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TerrainEngine } from './terrain.js';
import { SOIL_TYPES, getSoil, resolveSoilId, isLandslideProneSoil } from './materials.js';
import { EnvironmentEngine } from './environment.js';
import { LEVELS, SANDBOX_LEVEL } from '../game/levels.js';

test('jordarter inkluderar grus, sand, morän, lös/fast lera och blöt lös lera', () => {
    for (const id of ['gravel', 'sand', 'moraine', 'stiff_clay', 'soft_clay', 'wet_soft_clay']) {
        assert.ok(SOIL_TYPES[id], `saknar jordart ${id}`);
        assert.ok(SOIL_TYPES[id].stiffness > 0);
        assert.ok(SOIL_TYPES[id].landslideRisk >= 0);
    }
    assert.equal(resolveSoilId('stiff_soil'), 'moraine');
    assert.equal(getSoil('stiff_soil').id, 'moraine');
    assert.equal(isLandslideProneSoil('wet_soft_clay'), true);
    assert.equal(isLandslideProneSoil('gravel'), false);
    assert.equal(getSoil('wet_soft_clay').requiresPiling, true);
    assert.equal(getSoil('soft_clay').requiresPiling, true);
    assert.equal(getSoil('moraine').requiresPiling, false);
});

test('soilColumnAt ger flera lager som fyller yta→berg', () => {
    const t = new TerrainEngine(LEVELS[0].ground);
    const col = t.soilColumnAt(0);
    assert.ok(col.length >= 2, `förväntade minst 2 lager, fick ${col.length}`);
    const types = new Set(col.map(l => l.type));
    assert.ok(types.has('moraine') || types.has('gravel') || types.has('sand'));
    const surf = t.surfaceY(0);
    const rock = t.bedrockY(0);
    assert.ok(Math.abs(col[0].topY - surf) < 0.05);
    assert.ok(Math.abs(col[col.length - 1].bottomY - rock) < 0.05);
    const sumTh = col.reduce((s, l) => s + l.thickness, 0);
    assert.ok(Math.abs(sumTh - (surf - rock)) < 0.15);
});

test('jordlager varierar i x-led', () => {
    const t = new TerrainEngine(LEVELS[4].ground);
    const a = t.layerSharesAt(-18);
    const b = t.layerSharesAt(18);
    const aSoft = a.filter(l => l.type.includes('clay')).reduce((s, l) => s + l.share, 0);
    const bSoft = b.filter(l => l.type.includes('clay')).reduce((s, l) => s + l.share, 0);
    // Närmare vatten (höger) ska ha mer lera
    assert.ok(bSoft > aSoft * 0.85 || bSoft > 0.4, `förväntade mer lera mot vatten: a=${aSoft.toFixed(2)} b=${bSoft.toFixed(2)}`);
    const soilLeft = t.surfaceSoilId(-20);
    const soilRight = t.surfaceSoilId(18);
    assert.ok(soilLeft);
    assert.ok(soilRight);
});

test('soilAt returnerar rätt lager på djup', () => {
    const t = new TerrainEngine({
        seed: 1,
        surfaceY: 0,
        bedrockY: -6,
        surfaceAmp: 0.05,
        bedrockAmp: 0.05,
        soilType: 'moraine',
        soilLayers: [
            { type: 'gravel', share: 0.25 },
            { type: 'sand', share: 0.25 },
            { type: 'moraine', share: 0.50 }
        ]
    });
    const col = t.soilColumnAt(0);
    const midGravel = (col[0].topY + col[0].bottomY) / 2;
    assert.equal(t.soilAt(0, midGravel).id, 'gravel');
    const midMoraine = (col[col.length - 1].topY + col[col.length - 1].bottomY) / 2;
    assert.equal(t.soilAt(0, midMoraine).id, 'moraine');
    assert.equal(t.soilAt(0, t.bedrockY(0) - 1).id, 'bedrock');
});

test('senare nivåer har större jordmäktighet', () => {
    const early = new TerrainEngine(LEVELS[0].ground);
    const late = new TerrainEngine(LEVELS[4].ground);
    const thEarly = early.soilThickness(0);
    const thLate = late.soilThickness(0);
    assert.ok(thLate > thEarly + 2, `nivå 5 ska vara tjockare (${thLate.toFixed(1)} vs ${thEarly.toFixed(1)})`);
    const mega = new TerrainEngine(LEVELS[5].ground);
    assert.ok(mega.soilThickness(0) > thEarly + 2);
});

test('blöt lös lera och skredrisk ökar mot vatten i brant lutning', () => {
    const t = new TerrainEngine(LEVELS[4].ground);
    const hazardFlat = t.landslideHazardAt(-22);
    const hazardNearWater = t.landslideHazardAt(18);
    assert.ok(hazardNearWater > hazardFlat, `skredrisk mot vatten ${hazardNearWater.toFixed(2)} > flat ${hazardFlat.toFixed(2)}`);
    assert.ok(t.maxLandslideHazard(-30, 30, 2) > 0.35);
    // Blöt lera ska förekomma nära vatten
    let foundWet = false;
    for (let x = 10; x <= 28; x += 2) {
        const col = t.soilColumnAt(x);
        if (col.some(l => l.type === 'wet_soft_clay' || l.type === 'soft_clay')) foundWet = true;
    }
    assert.ok(foundWet, 'förväntade lös/blöt lera nära vatten');
});

test('skred påverkar leranoder utan bergpåle', () => {
    const terrain = new TerrainEngine(LEVELS[4].ground);
    const env = new EnvironmentEngine();
    env.terrain = terrain;
    env.setDisasterLevels({ wind: 0, rain: 0.95, earthquake: 0, landslide: true });
    for (let i = 0; i < 80; i++) env.update(0.05);
    assert.ok(env.landslideProgress > 0.3);

    const clayNode = {
        x: 16, y: terrain.surfaceY(16), initialX: 16, initialY: terrain.surfaceY(16),
        soilType: 'wet_soft_clay', fixed: true, isBedrockPinned: false, isGroundAnchor: true,
        fx: 0, fy: 0
    };
    const piled = {
        x: 16, y: terrain.surfaceY(16), initialX: 16, initialY: terrain.surfaceY(16),
        soilType: 'wet_soft_clay', fixed: true, isBedrockPinned: true, isGroundAnchor: true,
        fx: 0, fy: 0
    };
    env.applyForces([clayNode, piled], [], 0.05);
    assert.ok(Math.abs(clayNode.x - clayNode.initialX) > 0.2 || clayNode.y < clayNode.initialY - 0.1,
        'leranod ska glida vid skred');
    assert.equal(piled.x, piled.initialX);
    assert.equal(piled.y, piled.initialY);
});

test('sampleProfile inkluderar lager och skredfara', () => {
    const t = new TerrainEngine(SANDBOX_LEVEL.ground);
    const profile = t.sampleProfile(-10, 10, 1);
    assert.ok(profile.length > 5);
    assert.ok(Array.isArray(profile[0].layers));
    assert.ok(profile[0].layers.length >= 2);
    assert.equal(typeof profile[0].landslideHazard, 'number');
    assert.ok(profile[0].surfaceSoil);
});

test('kampanjprogression: tidiga nivåer utan blöt lera, sena med pålkrav', () => {
    const earlyTypes = new Set();
    for (const layer of LEVELS[0].ground.soilLayers) earlyTypes.add(layer.type);
    assert.equal(earlyTypes.has('wet_soft_clay'), false);
    assert.ok(LEVELS[4].ground.soilLayers.some(l => l.type === 'wet_soft_clay'));
    assert.ok(LEVELS[4].allowedMaterials.includes('pile'));
    assert.equal(LEVELS[4].testScenario.landslide, true);
    assert.ok(LEVELS[3].allowedMaterials.includes('pile'));
});
