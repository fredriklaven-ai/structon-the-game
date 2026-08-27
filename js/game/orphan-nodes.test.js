/**
 * Regressionstester: lösa "vita punkter" (oanslutna noder) ska inte bli kvar
 * när ett byggdrag avbryts av en tvåfingerscroll eller en tapp utan balk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UIManager } from './ui.js';
import { PhysicsEngine } from '../engine/physics.js';

function stubDom() {
    globalThis.window = {
        devicePixelRatio: 1,
        addEventListener() {},
        removeEventListener() {},
        innerWidth: 800,
        innerHeight: 450
    };
    globalThis.document = {
        addEventListener() {},
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
}

function makeUi() {
    stubDom();
    const canvas = {
        style: {},
        width: 800, height: 450, clientWidth: 800, clientHeight: 450,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }),
        getContext: () => ({
            scale() {}, setTransform() {}, clearRect() {}, save() {}, restore() {},
            translate() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
            fill() {}, fillRect() {}, strokeRect() {}, arc() {}, fillText() {},
            createLinearGradient: () => ({ addColorStop() {} }),
            createRadialGradient: () => ({ addColorStop() {} })
        }),
        addEventListener() {}, setPointerCapture() {}, releasePointerCapture() {}
    };
    const physics = new PhysicsEngine(); // riktig motor: addNode/removeNode/cleanOrphanNodes
    const game = {
        gameState: 'build',
        physics,
        currentLevel: { ground: { soilType: 'stiff_soil' }, targetHeight: 6.5, allowedMaterials: ['wood'] },
        showToast() {},
        audio: { playPlaceNode() {}, playPlaceMember() {}, playDelete() {}, playClick() {} }
    };
    const ui = new UIManager(game, canvas);
    ui.displayWidth = 800; ui.displayHeight = 450;
    ui.panX = 400; ui.panY = 300; ui.zoom = 20;
    return ui;
}

const evt = (id, x, y, button = 0) => ({ pointerId: id, clientX: x, clientY: y, button });

test('tvåfingerscroll efter att första fingret skapat en nod lämnar inga lösa noder', () => {
    const ui = makeUi();
    // Finger 1 ned på tom yta i byggläge → skapar en startnod
    ui.handlePointerDown(evt(1, 300, 260));
    assert.equal(ui.game.physics.nodes.length, 1, 'en startnod skapades');

    // Finger 2 ned → tvåfingergest (scroll) ska städa bort den oanslutna noden
    ui.handlePointerDown(evt(2, 460, 260));
    assert.equal(ui.game.physics.nodes.length, 0, 'den oanslutna noden städas bort vid scroll');

    // Avsluta gesten
    ui.handlePointerUp(evt(2, 460, 260));
    ui.handlePointerUp(evt(1, 300, 260));
    assert.equal(ui.game.physics.nodes.length, 0, 'fortfarande inga lösa noder kvar');
});

test('tapp på tom yta utan att dra en balk lämnar ingen lös nod', () => {
    const ui = makeUi();
    ui.handlePointerDown(evt(1, 300, 260));
    assert.equal(ui.game.physics.nodes.length, 1);
    // Släpp på samma punkt utan att dra → ingen balk → noden ska städas bort
    ui.handlePointerUp(evt(1, 300, 260));
    assert.equal(ui.game.physics.nodes.length, 0, 'ingen lös "vit punkt" ska bli kvar');
});

test('ett fullständigt drag som kopplar en balk behåller noderna', () => {
    const ui = makeUi();
    ui.handlePointerDown(evt(1, 300, 300));
    // dra till en annan punkt och släpp → skapar balk mellan två noder
    ui.handlePointerMove(evt(1, 300, 240));
    ui.handlePointerUp(evt(1, 300, 240));
    assert.equal(ui.game.physics.members.length, 1, 'en balk skapades');
    assert.equal(ui.game.physics.nodes.length, 2, 'båda noderna behålls när de bär en balk');
});
