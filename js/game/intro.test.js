/**
 * Tester för cinematic intro (90s → ultrarealistisk reklam).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('intro-modul exporterar IntroCinematic och resetIntroSeen', async () => {
    const mod = await import('./intro.js');
    assert.equal(typeof mod.IntroCinematic, 'function');
    assert.equal(typeof mod.resetIntroSeen, 'function');
});

test('intro-källkod innehåller 90-tals- och reklamscener', () => {
    const src = readFileSync(join(root, 'js/game/intro.js'), 'utf8');
    assert.match(src, /intro-act-retro/);
    assert.match(src, /intro-act-cinema/);
    assert.match(src, /drawPixelEngineer/);
    assert.match(src, /startMusic/);
    assert.match(src, /STRUCTON/);
});

test('CSS har cinematic intro-stilar', () => {
    const css = readFileSync(join(root, 'style.css'), 'utf8');
    assert.match(css, /\.intro-cinematic/);
    assert.match(css, /\.crt-scanlines/);
    assert.match(css, /\.cinema-brand/);
});

test('spelet kopplar in introt', () => {
    const game = readFileSync(join(root, 'js/game/game.js'), 'utf8');
    assert.match(game, /IntroCinematic/);
    assert.match(game, /playIntroIfNeeded/);
    assert.match(game, /replayIntro/);
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert.match(html, /btn-replay-intro/);
});
