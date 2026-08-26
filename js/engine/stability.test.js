/**
 * Regression: korrekt byggd stomme får inte rasa av numerisk instabilitet.
 * Explicit fjäderintegration med kSim≈2.8e7 kräver tillräckligt många subSteps.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsEngine } from './physics.js';
import { EnvironmentEngine } from './environment.js';

/** Enkel 2-plans trävilla med snedsträvor (L1-liknande). */
function buildBracedVilla(physics, { fixedFootings = true } = {}) {
    const xs = [-3.5, 0, 3.5];
    const ys = [0, 3.2, 6.4];
    const nodes = new Map();
    for (const x of xs) {
        for (const y of ys) {
            const fixed = fixedFootings && y === 0;
            nodes.set(`${x},${y}`, physics.addNode(x, y, fixed));
        }
    }
    const n = (x, y) => nodes.get(`${x},${y}`);

    for (const x of xs) {
        physics.addMember(n(x, 0), n(x, 3.2), 'column_wood');
        physics.addMember(n(x, 3.2), n(x, 6.4), 'column_wood');
    }
    for (const y of [3.2, 6.4]) {
        physics.addMember(n(-3.5, y), n(0, y), 'wood');
        physics.addMember(n(0, y), n(3.5, y), 'wood');
    }
    physics.addMember(n(-3.5, 0), n(0, 3.2), 'strut_wood');
    physics.addMember(n(3.5, 0), n(0, 3.2), 'strut_wood');
    physics.addMember(n(-3.5, 3.2), n(0, 6.4), 'strut_wood');
    physics.addMember(n(3.5, 3.2), n(0, 6.4), 'strut_wood');
    return nodes;
}

function simulate(physics, env, seconds, dt = 0.05) {
    for (let t = 0; t < seconds; t += dt) {
        physics.step(dt, env);
    }
}

test('subSteps är tillräckligt högt för styva fjädrar', () => {
    const physics = new PhysicsEngine();
    assert.ok(physics.subSteps >= 40, `subSteps=${physics.subSteps}, behöver ≥40`);
});

test('träpelare under egenvikt exploderar inte numeriskt', () => {
    const physics = new PhysicsEngine();
    const a = physics.addNode(0, 0, true);
    const b = physics.addNode(0, 3.2, false);
    const c = physics.addNode(0, 6.4, false);
    physics.addMember(a, b, 'column_wood');
    physics.addMember(b, c, 'column_wood');
    simulate(physics, null, 2);
    assert.equal(physics.stats.brokenMembersCount, 0);
    assert.ok(Math.abs(b.y - 3.2) < 0.15, `mellannod y=${b.y}`);
    assert.ok(Math.abs(c.y - 6.4) < 0.2, `toppnod y=${c.y}`);
    // Tryck under egenvikt, inte absurda dragkrafter
    assert.ok(physics.members[0].force < 0, 'pelare ska vara i tryck');
    assert.ok(Math.abs(physics.members[0].force) < 50000, `force=${physics.members[0].force}`);
});

test('avstyvad L1-villa klarar höststorm (14 m/s) utan brott', () => {
    const physics = new PhysicsEngine();
    const env = new EnvironmentEngine();
    env.setDisasterLevels({ wind: 14, rain: 0.3, earthquake: 0, landslide: false });
    buildBracedVilla(physics, { fixedFootings: true });
    simulate(physics, env, 8);
    assert.equal(physics.stats.brokenMembersCount, 0);
    assert.ok(
        physics.stats.maxStressRatio < 0.85,
        `maxStressRatio=${physics.stats.maxStressRatio}`
    );
});

test('lösa fotplåtar glider under vind – fasta upplag stannar kvar', () => {
    const loose = new PhysicsEngine();
    const fixed = new PhysicsEngine();
    const envLoose = new EnvironmentEngine();
    const envFixed = new EnvironmentEngine();
    envLoose.setDisasterLevels({ wind: 14, rain: 0, earthquake: 0, landslide: false });
    envFixed.setDisasterLevels({ wind: 14, rain: 0, earthquake: 0, landslide: false });

    buildBracedVilla(loose, { fixedFootings: false });
    buildBracedVilla(fixed, { fixedFootings: true });
    for (const n of loose.nodes) n._ix = n.x;
    for (const n of fixed.nodes) n._ix = n.x;

    simulate(loose, envLoose, 8);
    simulate(fixed, envFixed, 8);

    const footDrift = (engine) =>
        Math.max(
            ...engine.nodes.filter((n) => n.y < 1).map((n) => Math.abs(n.x - n._ix))
        );

    assert.ok(footDrift(loose) > 1.0, `lösa fötter borde glida, drift=${footDrift(loose)}`);
    assert.ok(footDrift(fixed) < 0.05, `fasta fötter ska stå still, drift=${footDrift(fixed)}`);
    assert.equal(fixed.stats.brokenMembersCount, 0);
});
