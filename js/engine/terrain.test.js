/**
 * Tester för kuperad terräng, klyftor, vatten, sprickor och tunnelbärighet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TerrainEngine, buildAnchorNodes } from './terrain.js';
import { PhysicsEngine } from './physics.js';
import { LEVELS, SANDBOX_LEVEL } from '../game/levels.js';

function terrainFor(level) {
    return new TerrainEngine(level.ground);
}

test('markyta och berggrund varierar och är inte horisontella', () => {
    const t = terrainFor(LEVELS[0]);
    const xs = [-40, -20, -8, 0, 8, 20, 40, 80];
    const surfaces = xs.map(x => t.surfaceY(x));
    const rocks = xs.map(x => t.bedrockY(x));
    const surfSpan = Math.max(...surfaces) - Math.min(...surfaces);
    const rockSpan = Math.max(...rocks) - Math.min(...rocks);
    assert.ok(surfSpan > 1.2, `förväntade kuperad markyta, fick spann ${surfSpan.toFixed(2)} m`);
    assert.ok(rockSpan > 1.2, `förväntade kuperat berg, fick spann ${rockSpan.toFixed(2)} m`);
    for (let i = 0; i < xs.length; i++) {
        assert.ok(rocks[i] < surfaces[i] - 0.05, 'berget ska ligga under markytan');
    }
});

test('terrängen fortsätter långt ut åt sidorna utan att ta slut', () => {
    const t = terrainFor(LEVELS[5]);
    for (const x of [-220, -120, 120, 220]) {
        const s = t.surfaceY(x);
        const b = t.bedrockY(x);
        assert.equal(Number.isFinite(s), true);
        assert.equal(Number.isFinite(b), true);
        assert.ok(b < s);
    }
    const far = t.sampleProfile(-180, 180, 4);
    assert.ok(far.length > 80);
    assert.ok(Math.abs(far[0].x + 180) < 0.01);
    assert.ok(far[far.length - 1].x >= 176);
});

test('klyfta sänker markytan och kan fyllas med vatten', () => {
    const t = terrainFor(LEVELS[0]);
    const ravine = LEVELS[0].ground.ravines[0];
    const floor = t.surfaceY(ravine.x);
    const shoulder = t.surfaceY(ravine.x - ravine.width);
    assert.ok(shoulder - floor > 2.0, 'klyftan ska vara tydligt djupare än omgivningen');
    const water = t.waterSurfaceY(ravine.x);
    assert.ok(water != null, 'klyftan ska ha vatten');
    assert.ok(water > floor, 'vattenytan ska ligga ovanför klyftans botten');
    assert.equal(t.classify(ravine.x, (floor + water) / 2), 'water');
});

test('öppen bergsspricka skapar hålrum i berget', () => {
    const t = terrainFor(LEVELS[3]);
    const crack = LEVELS[3].ground.cracks[0];
    assert.equal(t.isInCrackVoid(crack.x, t.bedrockY(crack.x) - 2), true);
    assert.equal(t.classify(crack.x, t.bedrockY(crack.x) - 2), 'crack');
    assert.equal(t.isSolid(crack.x, t.bedrockY(crack.x) - 2), false);
});

test('tunnel ligger i berget med mätbar täckning och kapacitet', () => {
    const t = terrainFor(LEVELS[5]);
    const tunnel = t.tunnels[0];
    assert.ok(tunnel, 'nivå 6 ska ha tunnel');
    assert.equal(t.classify(tunnel.x, tunnel.y), 'tunnel');
    const cover = t.rockCoverAboveTunnel(tunnel);
    assert.ok(cover > 0.8, `täckning ska vara positiv, fick ${cover.toFixed(2)} m`);
    const cap = t.tunnelRoofCapacity(tunnel);
    assert.ok(cap.capacityN > 0);
    const empty = t.assessTunnelLoads([]);
    assert.ok(empty[0].buildingN === 0);
    assert.ok(empty[0].utilization < 0.05, 'tom tunnel ska stå utan huslast');
});

test('tjockare bergtäckning ger högre bärförmåga', () => {
    const thin = new TerrainEngine({
        seed: 1, surfaceY: 0, bedrockY: -4, surfaceAmp: 0.2, bedrockAmp: 0.2,
        tunnels: [{ x: 0, width: 10, height: 4, cover: 1.2, name: 'tunn' }]
    });
    const thick = new TerrainEngine({
        seed: 1, surfaceY: 0, bedrockY: -4, surfaceAmp: 0.2, bedrockAmp: 0.2,
        tunnels: [{ x: 0, width: 10, height: 4, cover: 4.5, name: 'tjock' }]
    });
    const cThin = thin.tunnelRoofCapacity(thin.tunnels[0]);
    const cThick = thick.tunnelRoofCapacity(thick.tunnels[0]);
    assert.ok(cThick.cover > cThin.cover);
    assert.ok(cThick.capacityN > cThin.capacityN * 2, 'kapacitet ska växa snabbt med täckningen');
});

test('huslast över tunn täckning får taket att rasa', () => {
    const terrain = new TerrainEngine({
        seed: 3, surfaceY: 0, bedrockY: -5, surfaceAmp: 0.15, bedrockAmp: 0.15,
        tunnels: [{ x: 0, width: 12, height: 5, cover: 1.1, name: 'svag' }]
    });
    const physics = new PhysicsEngine();
    physics.terrain = terrain;
    const y = terrain.surfaceY(0);
    for (let i = -4; i <= 4; i++) {
        const n = physics.addNode(i * 1.2, y, true, 'stiff_soil');
        n.mass = 180000;
        n.isGroundAnchor = true;
    }
    const before = terrain.assessTunnelLoads(physics.nodes)[0];
    assert.ok(before.utilization > 1.02, `förväntade överlast, fick ${before.utilization.toFixed(2)}`);
    physics.evaluateTunnelRoofLoads();
    assert.equal(terrain.collapsedTunnels.size, 1);
    assert.equal(physics.nodes.some(n => n.fixed === false), true);
});

test('påle som når fast berg förankras, påle i tunnel gör det inte', () => {
    const terrain = new TerrainEngine({
        seed: 8, surfaceY: 0, bedrockY: -5, surfaceAmp: 0.1, bedrockAmp: 0.1,
        tunnels: [{ x: 0, width: 8, height: 4, cover: 2.0, name: 'påltest' }]
    });
    const physics = new PhysicsEngine();
    physics.terrain = terrain;
    const tun = terrain.tunnels[0];
    const rockNode = physics.addNode(18, terrain.bedrockY(18) - 0.6, false, 'bedrock');
    physics.addMember(physics.addNode(18, terrain.surfaceY(18), false), rockNode, 'pile');
    assert.equal(rockNode.isBedrockPinned, true);
    assert.equal(rockNode.fixed, true);

    const airNode = physics.addNode(tun.x, tun.y, false);
    physics.addMember(physics.addNode(tun.x, terrain.surfaceY(tun.x), false), airNode, 'pile');
    assert.equal(airNode.isBedrockPinned, false);
    assert.equal(terrain.classify(tun.x, tun.y), 'tunnel');
});

test('ankarnoder följer den kuperade markytan', () => {
    const level = LEVELS[0];
    const terrain = terrainFor(level);
    const anchors = buildAnchorNodes(terrain, level.ground);
    assert.equal(anchors.length, level.ground.anchorNodes.length);
    for (const a of anchors) {
        assert.ok(Math.abs(a.y - terrain.surfaceY(a.x)) < 0.05);
        assert.equal(a.isGroundAnchor, true);
    }
});

test('bygghöjd mäts ovanför markytan, inte i världs-Y', () => {
    const terrain = terrainFor(LEVELS[0]);
    const physics = new PhysicsEngine();
    physics.terrain = terrain;
    const a = physics.addNode(0, terrain.surfaceY(0), true, 'stiff_soil');
    a.isGroundAnchor = true;
    const roof = physics.addNode(0, terrain.surfaceY(0) + 6.5, false);
    physics.addMember(a, roof, 'wood');
    physics.calculateStats();
    assert.ok(Math.abs(physics.stats.buildingHeight - 6.5) < 0.15, `fick ${physics.stats.buildingHeight}`);
});

test('översiktsgräns rymmer klyfta, spricka och tunnel', () => {
    const t = terrainFor(SANDBOX_LEVEL);
    const b = t.overviewBounds(6, 0);
    const ravine = SANDBOX_LEVEL.ground.ravines[0];
    const tunnel = t.tunnels[0];
    const crack = SANDBOX_LEVEL.ground.cracks[0];
    assert.ok(b.minX < ravine.x - ravine.width / 2);
    assert.ok(b.maxX > tunnel.x + tunnel.width / 2);
    assert.ok(b.minX < crack.x);
    assert.ok(b.minY < tunnel.y);
    assert.ok(b.maxX - b.minX > 40);
});

test('alla kampanjnivåer har sammanhängande terrängprofiler', () => {
    for (const level of [...LEVELS, SANDBOX_LEVEL]) {
        const t = terrainFor(level);
        const profile = t.sampleProfile(-60, 60, 2);
        assert.ok(profile.every(p => Number.isFinite(p.surfaceY) && Number.isFinite(p.bedrockY)));
        if (t.tunnels.length) {
            const a = t.assessTunnelLoads([])[0];
            assert.ok(a.cover > 0.5, `${level.id} tunnel ska ha bergtäckning`);
            assert.ok(a.utilization < 0.05, `${level.id} tom tunnel ska inte rasa av egenvikt`);
        }
    }
});
