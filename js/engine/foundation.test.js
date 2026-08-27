/**
 * Tester för grundläggning på mark: en byggnad på fast mark ska stå emot
 * sidolast (vind) utan att glida/välta, medan lös/blöt lera inte grundläggs
 * (kräver pålning).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsEngine } from './physics.js';
import { EnvironmentEngine } from './environment.js';
import { TerrainEngine, buildAnchorNodes } from './terrain.js';
import { LEVELS } from '../game/levels.js';

function setupLevel(idx) {
    const lvl = LEVELS[idx];
    const physics = new PhysicsEngine();
    const environment = new EnvironmentEngine();
    const terrain = new TerrainEngine(lvl.ground);
    physics.terrain = terrain;
    environment.terrain = terrain;
    for (const n of buildAnchorNodes(terrain, lvl.ground)) {
        const node = physics.addNode(n.x, n.y, n.fixed, n.soil);
        node.isBedrockPinned = n.isBedrock || false;
        node.initialBedrockPinned = node.isBedrockPinned;
        node.isGroundAnchor = true;
    }
    return { lvl, physics, environment, terrain };
}

test('bärande basnod på fast mark grundläggs (blir fast) vid lastfas', () => {
    const { physics, terrain } = setupLevel(0); // Villa Solbacken, morän/grus
    const surf = terrain.surfaceY(0);
    const base = physics.addNode(0, surf, false);
    const top = physics.addNode(0, surf + 3, false);
    physics.addMember(base, top, 'wood');

    assert.equal(base.fixed, false, 'basnoden är fri i byggläge');
    physics.foundGroundContactNodes();
    assert.equal(base.fixed, true, 'basnoden grundläggs på fast mark inför lasten');
});

test('lös/blöt lera i bärzonen grundläggs INTE (kräver pålning)', () => {
    const { physics, terrain } = setupLevel(4); // Skyline Spire, blöt/lös lera
    const surf = terrain.surfaceY(0);
    const base = physics.addNode(0, surf, false);
    const top = physics.addNode(0, surf + 3, false);
    physics.addMember(base, top, 'wood');

    physics.foundGroundContactNodes();
    assert.equal(base.fixed, false, 'lera ska kräva pålning – ingen automatisk grundläggning');
});

test('grundlagd, strävad villa på fast mark står emot vindlast utan att glida', () => {
    const { lvl, physics, environment, terrain } = setupLevel(0);
    const y1 = 3.2, y2 = 6.4;
    const mk = (x, y) => physics.addNode(x, y, false);
    const b0 = mk(-3, terrain.surfaceY(-3)), b1 = mk(0, terrain.surfaceY(0)), b2 = mk(3, terrain.surfaceY(3));
    const l1 = [mk(-3, b0.y + y1), mk(0, b1.y + y1), mk(3, b2.y + y1)];
    const l2 = [mk(-3, b0.y + y2), mk(0, b1.y + y2), mk(3, b2.y + y2)];
    const add = (a, b, m) => physics.addMember(a, b, m);
    add(b0, l1[0], 'column_wood'); add(l1[0], l2[0], 'column_wood');
    add(b1, l1[1], 'column_wood'); add(l1[1], l2[1], 'column_wood');
    add(b2, l1[2], 'column_wood'); add(l1[2], l2[2], 'column_wood');
    add(l1[0], l1[1], 'wood'); add(l1[1], l1[2], 'wood');
    add(l2[0], l2[1], 'wood'); add(l2[1], l2[2], 'wood');
    add(b0, l1[1], 'strut_wood'); add(b1, l1[2], 'strut_wood');
    add(l1[0], l2[1], 'strut_wood'); add(l1[1], l2[2], 'strut_wood');

    physics.resetToBlueprint();
    physics.foundGroundContactNodes();
    const sc = lvl.testScenario;
    environment.setDisasterLevels({ wind: sc.wind, rain: sc.rain, earthquake: sc.earthquake, landslide: sc.landslide });

    let t = 0; const dt = 1 / 60;
    while (t < sc.duration) { physics.step(dt, environment); environment.update(dt); t += dt; }

    const baseSlide = Math.max(...[b0, b1, b2].map(n => Math.abs(n.x - n.initialX)));
    assert.ok(baseSlide < 0.5, `basen ska inte glida iväg (gled ${baseSlide.toFixed(2)} m)`);
    assert.equal(physics.stats.brokenMembersCount, 0, 'inga element ska brista');
    assert.ok(physics.stats.buildingHeight >= lvl.targetHeight - 0.5,
        `höjden ska hållas (blev ${physics.stats.buildingHeight} m)`);
});
