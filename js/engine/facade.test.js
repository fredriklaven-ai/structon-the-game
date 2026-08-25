/**
 * Tester för fasadmontage före lastpåföring vid invigning.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsEngine } from './physics.js';

function buildTwoStoreyBay(physics) {
    const a0 = physics.addNode(0, 0, true, 'stiff_soil');
    const b0 = physics.addNode(4, 0, true, 'stiff_soil');
    a0.isGroundAnchor = true;
    b0.isGroundAnchor = true;
    const a1 = physics.addNode(0, 3.2, false);
    const b1 = physics.addNode(4, 3.2, false);
    const a2 = physics.addNode(0, 6.4, false);
    const b2 = physics.addNode(4, 6.4, false);

    physics.addMember(a0, a1, 'wood');
    physics.addMember(b0, b1, 'wood');
    physics.addMember(a0, b0, 'wood');
    physics.addMember(a1, b1, 'wood');
    physics.addMember(a1, a2, 'wood');
    physics.addMember(b1, b2, 'wood');
    physics.addMember(a2, b2, 'wood');
    return physics;
}

test('slutna fack detekteras som fasadbås i montageordning', () => {
    const physics = buildTwoStoreyBay(new PhysicsEngine());
    const bays = physics.getFacadeBays('wood');
    assert.ok(bays.length >= 2, `förväntade minst 2 fasadbås, fick ${bays.length}`);
    assert.ok(bays[0].bottomY <= bays[1].bottomY, 'montage ska börja från nedersta våningen');
    assert.equal(bays[0].style, 'wood');
});

test('fasadbås saknas när stommen inte bildar slutna fack', () => {
    const physics = new PhysicsEngine();
    const a = physics.addNode(0, 0, true);
    const b = physics.addNode(0, 3, false);
    physics.addMember(a, b, 'wood');
    assert.equal(physics.getFacadeBays().length, 0);
});

test('invigningssekvens: fasadprogress före lasttillstånd', async () => {
    // Lättvikts-mock av spelets tillståndsmaskin utan DOM
    const physics = buildTwoStoreyBay(new PhysicsEngine());
    const state = {
        gameState: 'build',
        facadeProgress: 0,
        claddingDuration: 2,
        claddingRooms: physics.getFacadeBays('wood'),
        lastFacadeMountIndex: -1,
        loadsApplied: false
    };

    state.gameState = 'cladding';
    assert.equal(state.loadsApplied, false);
    assert.ok(state.claddingRooms.length >= 2);

    // Simulera montage utan laster
    const steps = 8;
    for (let i = 0; i < steps; i++) {
        state.facadeProgress = Math.min(1, state.facadeProgress + 1 / steps);
        assert.equal(state.loadsApplied, false, 'laster får inte påföras under fasadmontage');
    }
    assert.equal(state.facadeProgress, 1);
    state.gameState = 'test';
    state.loadsApplied = true;
    assert.equal(state.gameState, 'test');
    assert.equal(state.loadsApplied, true);
});

test('slutna fack detekteras även när bjälklag ritats åt motsatt håll', () => {
    const physics = new PhysicsEngine();
    const a0 = physics.addNode(0, 0, true, 'stiff_soil');
    const b0 = physics.addNode(4, 0, true, 'stiff_soil');
    a0.isGroundAnchor = true;
    b0.isGroundAnchor = true;
    const a1 = physics.addNode(0, 3.2, false);
    const b1 = physics.addNode(4, 3.2, false);
    // Rita bjälklag höger→vänster (nodeA = höger)
    physics.addMember(b0, a0, 'wood');
    physics.addMember(a0, a1, 'wood');
    physics.addMember(b0, b1, 'wood');
    physics.addMember(b1, a1, 'wood');
    assert.equal(physics.detectRooms().length, 1);
});

test('kuvertfasad används när stommen saknar perfekta fack', () => {
    const physics = new PhysicsEngine();
    const a0 = physics.addNode(0, 0, true);
    const b0 = physics.addNode(4, 0.3, true);
    const a1 = physics.addNode(0.2, 5.8, false);
    const b1 = physics.addNode(3.8, 6.1, false);
    // Ofullständig stomme: grund + pelare, inget övre bjälklag → inga slutna fack
    physics.addMember(a0, b0, 'wood');
    physics.addMember(a0, a1, 'wood');
    physics.addMember(b0, b1, 'wood');
    assert.equal(physics.detectRooms().length, 0);
    const bays = physics.getFacadeBays('wood');
    assert.ok(bays.length >= 1, `förväntade kuvertfasad, fick ${bays.length}`);
    assert.ok(bays.every(b => b.isEnvelope));
});
