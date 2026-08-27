/**
 * Tester för tvåfingrar-scroll (pan) och nyp-zoom.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UIManager } from './ui.js';

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
        width: 800,
        height: 450,
        clientWidth: 800,
        clientHeight: 450,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }),
        getContext: () => ({
            scale() {},
            setTransform() {},
            clearRect() {},
            save() {},
            restore() {},
            translate() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            stroke() {},
            fill() {},
            fillRect() {},
            strokeRect() {},
            arc() {},
            fillText() {},
            createLinearGradient: () => ({ addColorStop() {} }),
            createRadialGradient: () => ({ addColorStop() {} })
        }),
        addEventListener() {},
        setPointerCapture() {},
        releasePointerCapture() {}
    };
    const game = {
        gameState: 'build',
        physics: {
            nodes: [],
            members: [],
            terrain: null,
            findNearestNode: () => null,
            stats: { buildingHeight: 0, totalCost: 0, maxStressRatio: 0, brokenMembersCount: 0 }
        },
        currentLevel: { ground: { soilType: 'stiff_soil' }, targetHeight: 6.5 },
        showToast() {},
        audio: { playPlaceNode() {}, playPlaceMember() {}, playDelete() {}, playClick() {} }
    };
    const ui = new UIManager(game, canvas);
    ui.displayWidth = 800;
    ui.displayHeight = 450;
    ui.panX = 400;
    ui.panY = 300;
    ui.zoom = 20;
    return ui;
}

test('två fingrar som flyttas tillsammans scrollar vyn (pan)', () => {
    const ui = makeUi();
    ui.initialPinchDist = 100;
    ui.initialZoom = 20;
    ui.lastPinchMidpoint = { x: 400, y: 300 };

    // Samma fingeravstånd (100), mittpunkt flyttad +80,+40 → ren pan
    ui.applyTwoFingerGesture([
        { x: 430, y: 340 },
        { x: 530, y: 340 }
    ]);

    assert.ok(Math.abs(ui.panX - 480) < 1.5, `förväntade panX≈480, fick ${ui.panX}`);
    assert.ok(Math.abs(ui.panY - 340) < 1.5, `förväntade panY≈340, fick ${ui.panY}`);
    assert.equal(ui.zoom, 20, 'zoom ska vara oförändrad vid ren pan');
});

test('nyp-zoom behåller världspunkten under mittpunkten', () => {
    const ui = makeUi();
    ui.panX = 400;
    ui.panY = 300;
    ui.zoom = 20;
    ui.initialPinchDist = 100;
    ui.initialZoom = 20;
    ui.lastPinchMidpoint = { x: 400, y: 300 };

    const mid = { x: 400, y: 300 };
    const worldBefore = ui.screenToWorld(mid.x, mid.y);

    // Dubbla avståndet, samma mittpunkt → 2× zoom
    ui.applyTwoFingerGesture([
        { x: 300, y: 300 },
        { x: 500, y: 300 }
    ]);

    assert.equal(ui.zoom, 40);
    const worldAfter = ui.screenToWorld(mid.x, mid.y);
    assert.ok(Math.abs(worldAfter.x - worldBefore.x) < 0.01);
    assert.ok(Math.abs(worldAfter.y - worldBefore.y) < 0.01);
});

test('andra fingret avbryter pågående bygginteraktion', () => {
    const ui = makeUi();
    ui.isInteracting = true;
    ui.dragStartNode = { id: 'fake' };
    ui.touchPoints.set(1, { x: 100, y: 100 });

    ui.touchPoints.set(2, { x: 200, y: 180 });
    const pts = Array.from(ui.touchPoints.values());
    ui.initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    ui.initialZoom = ui.zoom;
    ui.lastPinchMidpoint = ui._touchMidpoint(pts);
    ui.isTwoFingerGesture = true;
    ui.isPanning = true;
    ui.isInteracting = false;
    ui.dragStartNode = null;

    assert.equal(ui.isInteracting, false);
    assert.equal(ui.dragStartNode, null);
    assert.equal(ui.isTwoFingerGesture, true);
});
