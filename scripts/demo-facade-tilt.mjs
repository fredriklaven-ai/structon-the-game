/**
 * Headless demo: 2.5D tilt + transparent façade + stress colors.
 * Usage: node scripts/demo-facade-tilt.mjs
 */
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const OUT = '/opt/cursor/artifacts';
const URL = 'http://localhost:3000/';

const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,800']
});

try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction(() => window.structon?.physics, { timeout: 15000 });

    // --- A: cladding mid-mount (2D, opaque) ---
    const info = await page.evaluate(() => {
        const g = window.structon;
        g.isPaused = true;
        g.startLevel(0);
        const p = g.physics;
        const y0 = p.terrain ? p.terrain.surfaceY(0) : 0;
        const a0 = p.addNode(-3, y0, true, 'stiff_soil'); a0.isGroundAnchor = true;
        const b0 = p.addNode(3, y0, true, 'stiff_soil'); b0.isGroundAnchor = true;
        const a1 = p.addNode(-3, y0 + 3.2, false);
        const b1 = p.addNode(3, y0 + 3.2, false);
        const a2 = p.addNode(-3, y0 + 6.5, false);
        const b2 = p.addNode(3, y0 + 6.5, false);
        const mat = 'concrete_reinforced';
        p.addMember(a0, a1, mat);
        p.addMember(b0, b1, mat);
        p.addMember(a0, b0, mat);
        p.addMember(a1, b1, mat);
        p.addMember(a1, a2, mat);
        p.addMember(b1, b2, mat);
        p.addMember(a2, b2, mat);
        p.addMember(a0, b1, 'strut_steel');
        p.addMember(a1, b0, 'strut_steel');

        const style = g.resolveFacadeStyle();
        g.claddingRooms = p.getFacadeBays(style).map(r => ({ ...r, style }));
        g.facadeProgress = 0.85;
        g.gameState = 'cladding';
        g.viewTilt = 0;
        g.viewTiltTarget = 0;
        g.ui.fitOverview();
        return { bays: g.claddingRooms.length, rooms: p.detectRooms().length };
    });

    await page.evaluate(async () => {
        for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r));
    });
    await page.screenshot({ path: `${OUT}/facade_tilt_01_cladding_2d.png`, type: 'png' });

    // --- B: load phase with full tilt + transparent façades + stress colors ---
    const meta = await page.evaluate(async () => {
        const g = window.structon;
        const p = g.physics;
        g.isPaused = true; // frys fysik så stommen inte flyger iväg
        g.facadeProgress = 1;
        g.gameState = 'test';
        g.viewTilt = 1;
        g.viewTiltTarget = 1;
        g.testTimer = 1;
        g.testDuration = 999;
        // Statisk spänningsvisualisering (grön→röd) utan att köra dynamik
        const n = p.members.length;
        p.members.forEach((m, i) => {
            const t = i / Math.max(1, n - 1);
            m.stressRatio = 0.08 + t * 0.95; // spridning över skalan
            if (m.material?.isStrut) m.stressRatio = Math.max(m.stressRatio, 0.7);
        });
        p.stats.maxStressRatio = Math.max(...p.members.map(m => m.stressRatio));
        g.ui.fitOverview();
        for (let i = 0; i < 12; i++) {
            g.viewTilt = 1;
            g.viewTiltTarget = 1;
            g.gameState = 'test';
            g.isPaused = true;
            p.members.forEach((m, idx) => {
                const t = idx / Math.max(1, p.members.length - 1);
                m.stressRatio = 0.08 + t * 0.95;
                if (m.material?.isStrut) m.stressRatio = Math.max(m.stressRatio, 0.72);
            });
            p.stats.maxStressRatio = Math.max(...p.members.map(m => m.stressRatio));
            await new Promise(r => requestAnimationFrame(r));
        }
        return {
            tilt: g.viewTilt,
            state: g.gameState,
            bays: g.claddingRooms.length,
            maxStress: p.stats.maxStressRatio,
            memberStress: p.members.map(m => Number(m.stressRatio.toFixed(2))),
            pivot: g.ui.getBuildingPivot()
        };
    });

    await page.screenshot({ path: `${OUT}/facade_tilt_02_load_3d_stress.png`, type: 'png' });
    const canvasShot = await page.$('#game-canvas');
    if (canvasShot) {
        await canvasShot.screenshot({ path: `${OUT}/facade_tilt_03_canvas_only.png`, type: 'png' });
    }

    fs.writeFileSync(`${OUT}/facade_tilt_demo_meta.json`, JSON.stringify({ info, meta }, null, 2));
    console.log(JSON.stringify({ info, meta }, null, 2));
} finally {
    await browser.close();
}
