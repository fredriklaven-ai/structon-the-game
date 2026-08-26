/**
 * Tester för pelare, dragband, spännkabel och påltyper.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsEngine } from './physics.js';
import { TerrainEngine } from './terrain.js';
import { MATERIALS } from './materials.js';

test('pelare avvisas vid för stor lutning', () => {
    const physics = new PhysicsEngine();
    const a = physics.addNode(0, 0, true);
    const b = physics.addNode(3, 3, false); // 45° från lod
    const result = physics.addMember(a, b, 'column_rc');
    assert.equal(result.error, 'column_slope');
    assert.equal(physics.members.length, 0);
});

test('pelare tillåts nära lodlinjen', () => {
    const physics = new PhysicsEngine();
    const a = physics.addNode(0, 0, true);
    const b = physics.addNode(0.4, 4, false); // ~5.7°
    const member = physics.addMember(a, b, 'column_wood');
    assert.ok(member && !member.error);
    assert.equal(member.material.isColumn, true);
});

test('dragband tar ingen tryckkraft (slack)', () => {
    const physics = new PhysicsEngine();
    const a = physics.addNode(0, 2, true);
    const b = physics.addNode(4, 2, true);
    const m = physics.addMember(a, b, 'tension_rod');
    // Tryck ihop: kortare än restLength
    b.x = 3.5;
    physics.step(0.02, null);
    assert.ok(m.force >= -1e-6, `dragband ska inte bära tryck, force=${m.force}`);
});

test('spännkabel har förkortad vilolängd (förspänning)', () => {
    const physics = new PhysicsEngine();
    const a = physics.addNode(0, 3, true);
    const b = physics.addNode(6, 3, true);
    const geom = 6;
    const m = physics.addMember(a, b, 'pretension_cable');
    assert.ok(m.prestressForce > 0);
    assert.ok(m.restLength < geom, 'förspänning ska korta vilolängden');
    assert.equal(m.material.isPretension, true);
});

test('friktionspåle får mantellast utan bergförankring', () => {
    const terrain = new TerrainEngine({
        seed: 3, surfaceY: 0, bedrockY: -8, surfaceAmp: 0.05, bedrockAmp: 0.05
    });
    const physics = new PhysicsEngine();
    physics.terrain = terrain;
    const head = physics.addNode(2, terrain.surfaceY(2), false);
    const tip = physics.addNode(2, -3.5, false); // i jord, inte berg
    const m = physics.addMember(head, tip, 'pile_friction');
    assert.equal(tip.isBedrockPinned, false);
    assert.ok(m.shaftCapacity > 0, `förväntade mantellast, fick ${m.shaftCapacity}`);
    assert.ok((tip.frictionPileBoost || 0) > 1);
});

test('slagen spetsbärande påle förankras vid bergyta', () => {
    const terrain = new TerrainEngine({
        seed: 4, surfaceY: 0, bedrockY: -5, surfaceAmp: 0.05, bedrockAmp: 0.05
    });
    const physics = new PhysicsEngine();
    physics.terrain = terrain;
    const x = 10;
    const head = physics.addNode(x, terrain.surfaceY(x), false);
    const tip = physics.addNode(x, terrain.bedrockY(x) - 0.3, false);
    physics.addMember(head, tip, 'pile_driven');
    assert.equal(tip.isBedrockPinned, true);
    assert.equal(tip.fixed, true);
});

test('borrad spetsbärande påle kräver tipp ned i berg', () => {
    const terrain = new TerrainEngine({
        seed: 5, surfaceY: 0, bedrockY: -5, surfaceAmp: 0.05, bedrockAmp: 0.05
    });
    const physics = new PhysicsEngine();
    physics.terrain = terrain;
    const x = 12;
    const head = physics.addNode(x, terrain.surfaceY(x), false);
    // Tip strax ovanför berg – ska inte räcka för borrad
    const shallow = physics.addNode(x, terrain.bedrockY(x) + 0.1, false);
    physics.addMember(head, shallow, 'pile_bored');
    assert.equal(shallow.isBedrockPinned, false);

    const deep = physics.addNode(x + 1, terrain.bedrockY(x + 1) - 0.6, false);
    const head2 = physics.addNode(x + 1, terrain.surfaceY(x + 1), false);
    physics.addMember(head2, deep, 'pile_bored');
    assert.equal(deep.isBedrockPinned, true);
});

test('materialflaggor finns för alla nya bärverkstyper', () => {
    assert.equal(MATERIALS.column_rc.isColumn, true);
    assert.equal(MATERIALS.tension_rod.isTensionOnly, true);
    assert.equal(MATERIALS.pretension_cable.isPretension, true);
    assert.equal(MATERIALS.pile_friction.isFrictionPile, true);
    assert.equal(MATERIALS.pile_driven.pileMethod, 'driven');
    assert.equal(MATERIALS.pile_bored.pileMethod, 'bored');
});
