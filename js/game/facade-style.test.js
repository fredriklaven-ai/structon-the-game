/**
 * Tester för fasadstil per nivå: fasaden ska moderniseras med höjden
 * (röd trästuga → tegel → glasfasad för höga hus).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, facadeStyleForLevel } from './levels.js';

const styleFor = (id) => facadeStyleForLevel(LEVELS.find(l => l.id === id));

test('villan (nivå 1) får klassisk röd trästuga (wood)', () => {
    assert.equal(styleFor('level_1'), 'wood');
});

test('stadskvarteret (nivå 2) får tegelfasad', () => {
    assert.equal(styleFor('level_2'), 'brick');
});

test('höga hus får modern glasfasad (curtain)', () => {
    assert.equal(styleFor('level_3'), 'curtain'); // 33 m kontorstorn
    assert.equal(styleFor('level_4'), 'curtain'); // 68 m skyskrapa
    assert.equal(styleFor('level_6'), 'curtain'); // 105 m megaskyskrapa
});

test('flygplatsterminalen får ljus glashall (glass)', () => {
    assert.equal(styleFor('level_5'), 'glass');
});

test('fasaden blir modernare med höjden', () => {
    const rank = { wood: 0, brick: 1, glass: 2, curtain: 2 };
    // Villa (låg) ska vara mindre modern än höghusen.
    assert.ok(rank[styleFor('level_1')] < rank[styleFor('level_3')]);
    assert.ok(rank[styleFor('level_2')] <= rank[styleFor('level_4')]);
});

test('okänd/tom nivå faller tillbaka på glas utan att krascha', () => {
    assert.equal(facadeStyleForLevel(null), 'glass');
    assert.equal(facadeStyleForLevel({ targetHeight: 40, allowedMaterials: [] }), 'curtain');
});
