/**
 * STRUCTON THE GAME – Cinematic intro
 * Akt 1: 90-tals CRT / TV-spelsgrafik med konstruktörer och höghusritningar
 * Akt 2: Tuff övergång
 * Akt 3: Ultrarealistisk reklamfilm för Structon The Game
 * Musik: procedurlig chiptune + cinematic bass (Web Audio)
 */

const INTRO_SKIP_KEY = 'structon_intro_seen_v1';

export class IntroCinematic {
    /**
     * @param {object} opts
     * @param {() => void} opts.onComplete
     * @param {{ init: Function, resume: Function, isMuted: boolean }} opts.audio
     * @param {boolean} [opts.force]
     */
    constructor({ onComplete, audio, force = false }) {
        this.onComplete = onComplete;
        this.audio = audio;
        this.force = force;
        this.root = null;
        this.raf = 0;
        this.startedAt = 0;
        this.finished = false;
        this.music = null;
        this.duration = 26; // sekunder
    }

    shouldPlay() {
        if (this.force) return true;
        try {
            return localStorage.getItem(INTRO_SKIP_KEY) !== '1';
        } catch {
            return true;
        }
    }

    markSeen() {
        try {
            localStorage.setItem(INTRO_SKIP_KEY, '1');
        } catch { /* ignore */ }
    }

    async start() {
        if (!this.shouldPlay()) {
            this.onComplete?.();
            return;
        }

        this.mount();
        this.audio?.init?.();
        this.startedAt = performance.now();
        // Web Audio kräver gest — starta musik vid första pek, annars tyst intro
        this._musicStarted = false;
        const tryMusic = () => {
            if (this._musicStarted) return;
            this.audio?.init?.();
            this.audio?.resume?.();
            if (this.audio?.ctx) {
                this.startMusic();
                this._musicStarted = true;
            }
        };
        // Försök direkt (fungerar om spelet redan fått en gest)
        tryMusic();
        this.root?.addEventListener('pointerdown', tryMusic, { once: false });
        this.tick();
    }

    mount() {
        const el = document.createElement('div');
        el.id = 'intro-cinematic';
        el.className = 'intro-cinematic';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'Structon intro');
        el.innerHTML = `
            <div class="intro-letterbox">
                <div class="intro-stage" id="intro-stage">
                    <!-- ACT 1: 90s CRT -->
                    <section class="intro-act intro-act-retro" data-act="retro">
                        <div class="crt-bezel">
                            <div class="crt-screen">
                                <canvas class="intro-pixel-canvas" id="intro-pixel" width="320" height="180"></canvas>
                                <div class="crt-scanlines"></div>
                                <div class="crt-vignette"></div>
                                <div class="crt-glow"></div>
                                <div class="retro-hud">
                                    <span class="retro-blink">▶ PRESS START</span>
                                    <span>STRUCTON '94</span>
                                </div>
                                <div class="retro-caption" id="retro-caption">KONSTRUKTÖRERNA RITAR…</div>
                            </div>
                        </div>
                        <div class="retro-title-block">
                            <p class="retro-kicker">16-BIT ENGINEERING</p>
                            <h2 class="retro-logo">STRUCTON</h2>
                            <p class="retro-sub">BYGG · BELASTA · BESTÅ</p>
                        </div>
                    </section>

                    <!-- ACT 2: smash transition -->
                    <section class="intro-act intro-act-smash" data-act="smash">
                        <div class="smash-flash"></div>
                        <div class="smash-bars">
                            <span></span><span></span><span></span><span></span><span></span>
                        </div>
                        <p class="smash-word">LASTEN KOMMER</p>
                    </section>

                    <!-- ACT 3: ultra-realistic commercial -->
                    <section class="intro-act intro-act-cinema" data-act="cinema">
                        <div class="cinema-sky"></div>
                        <div class="cinema-city" aria-hidden="true">
                            <div class="tower t1"></div>
                            <div class="tower t2"></div>
                            <div class="tower t3"></div>
                            <div class="tower t4"></div>
                            <div class="tower t5"></div>
                            <div class="tower t6"></div>
                        </div>
                        <div class="cinema-glass"></div>
                        <div class="cinema-stress-lines" aria-hidden="true"></div>
                        <div class="cinema-copy">
                            <p class="cinema-eyebrow">DEN ULTRAREALISTISKA BYGGSIMULATORN</p>
                            <h1 class="cinema-brand">STRUCTON</h1>
                            <p class="cinema-tag">The Game</p>
                            <p class="cinema-line" id="cinema-line">Projektera höghus. Utmana fysiken. Invig — eller rasa.</p>
                        </div>
                        <div class="cinema-product">
                            <div class="product-frame">
                                <div class="product-skyline"></div>
                                <div class="product-frame-members"></div>
                                <div class="product-hud">
                                    <span>BYGGHÖJD 248 m</span>
                                    <span>MAX SPÄNNING 67%</span>
                                    <span class="pulse">INVIG PROJEKTET</span>
                                </div>
                            </div>
                        </div>
                        <div class="cinema-grain"></div>
                        <div class="cinema-letterbox-bars"></div>
                    </section>
                </div>
            </div>
            <button type="button" class="intro-skip" id="intro-skip">Hoppa över ✕</button>
            <button type="button" class="intro-start-btn" id="intro-start-btn" hidden>Börja bygga</button>
        `;
        document.body.appendChild(el);
        this.root = el;

        el.querySelector('#intro-skip')?.addEventListener('click', () => this.finish());
        el.querySelector('#intro-start-btn')?.addEventListener('click', () => this.finish());
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.finish();
            }
        });
        // Klick/tryck startar också (efter kort delay så man hinner se)
        this._tapHandler = () => {
            const t = (performance.now() - this.startedAt) / 1000;
            if (t > 1.2) this.finish();
        };
        el.addEventListener('pointerdown', this._tapHandler);

        this.pixelCanvas = el.querySelector('#intro-pixel');
        this.pixelCtx = this.pixelCanvas?.getContext('2d');
        this.drawRetroFrame(0);
    }

    /** Procedurlig 90-tals chiptune + tuff cinematic bass */
    startMusic() {
        if (!this.audio?.ctx || this.audio.isMuted) return;
        const ctx = this.audio.ctx;
        const master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(this.audio.masterGain || ctx.destination);

        const t0 = ctx.currentTime;
        this.music = { master, oscillators: [], stops: [] };

        // --- Chiptune lead (square) – 8-bit arpeggio ---
        const chipNotes = [
            // C-minor heroic climb (Hz)
            130.81, 155.56, 196.00, 261.63,
            196.00, 233.08, 311.13, 392.00,
            261.63, 311.13, 392.00, 523.25,
            392.00, 466.16, 622.25, 784.00
        ];
        const beat = 0.18;

        for (let i = 0; i < 48; i++) {
            const freq = chipNotes[i % chipNotes.length] * (i >= 32 ? 1.01 : 1);
            const start = t0 + 0.15 + i * beat;
            if (start - t0 > 12) break; // chiptune fades after act 1–2

            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = freq;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, start);
            g.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, start + beat * 0.92);
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 2200;
            osc.connect(filter);
            filter.connect(g);
            g.connect(master);
            osc.start(start);
            osc.stop(start + beat);
            this.music.oscillators.push(osc);
        }

        // --- Bass pulse (tough) under hela intros ---
        for (let i = 0; i < 52; i++) {
            const start = t0 + i * 0.42;
            if (start - t0 > 24) break;
            const osc = ctx.createOscillator();
            osc.type = i % 4 === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.value = i % 8 < 4 ? 55 : 41.2;
            const g = ctx.createGain();
            const punch = i > 28 ? 0.22 : 0.12; // tuffare i reklamdelen
            g.gain.setValueAtTime(0.0001, start);
            g.gain.exponentialRampToValueAtTime(punch, start + 0.03);
            g.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 180;
            osc.connect(lp);
            lp.connect(g);
            g.connect(master);
            osc.start(start);
            osc.stop(start + 0.35);
            this.music.oscillators.push(osc);
        }

        // --- Kick drums ---
        for (let i = 0; i < 40; i++) {
            const start = t0 + 0.05 + i * 0.42;
            if (start - t0 > 24) break;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, start);
            osc.frequency.exponentialRampToValueAtTime(38, start + 0.12);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.35, start);
            g.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
            osc.connect(g);
            g.connect(master);
            osc.start(start);
            osc.stop(start + 0.2);
            this.music.oscillators.push(osc);
        }

        // --- Cinematic riser into commercial ---
        const riserStart = t0 + 10.5;
        const riser = ctx.createOscillator();
        riser.type = 'sawtooth';
        riser.frequency.setValueAtTime(80, riserStart);
        riser.frequency.exponentialRampToValueAtTime(600, riserStart + 2.4);
        const rg = ctx.createGain();
        rg.gain.setValueAtTime(0.0001, riserStart);
        rg.gain.exponentialRampToValueAtTime(0.14, riserStart + 2.0);
        rg.gain.exponentialRampToValueAtTime(0.0001, riserStart + 2.6);
        const rf = ctx.createBiquadFilter();
        rf.type = 'bandpass';
        rf.frequency.setValueAtTime(200, riserStart);
        rf.frequency.exponentialRampToValueAtTime(2500, riserStart + 2.4);
        riser.connect(rf);
        rf.connect(rg);
        rg.connect(master);
        riser.start(riserStart);
        riser.stop(riserStart + 2.7);
        this.music.oscillators.push(riser);

        // --- Airy pad in commercial ---
        const padStart = t0 + 13;
        [220, 277.18, 329.63].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, padStart);
            g.gain.linearRampToValueAtTime(0.045, padStart + 1.5 + idx * 0.2);
            g.gain.linearRampToValueAtTime(0.0001, padStart + 11);
            osc.connect(g);
            g.connect(master);
            osc.start(padStart);
            osc.stop(padStart + 11.2);
            this.music.oscillators.push(osc);
        });

        // Fade out master near end
        master.gain.setValueAtTime(0.55, t0 + 22);
        master.gain.linearRampToValueAtTime(0.0001, t0 + 25.5);
    }

    stopMusic() {
        if (!this.music) return;
        try {
            const ctx = this.audio?.ctx;
            const now = ctx?.currentTime ?? 0;
            this.music.master.gain.cancelScheduledValues(now);
            this.music.master.gain.setValueAtTime(this.music.master.gain.value, now);
            this.music.master.gain.linearRampToValueAtTime(0.0001, now + 0.25);
            for (const osc of this.music.oscillators) {
                try { osc.stop(now + 0.3); } catch { /* already stopped */ }
            }
        } catch { /* ignore */ }
        this.music = null;
    }

    drawRetroFrame(t) {
        const ctx = this.pixelCtx;
        const c = this.pixelCanvas;
        if (!ctx || !c) return;
        const W = c.width;
        const H = c.height;

        // Night office bg
        ctx.fillStyle = '#0b1020';
        ctx.fillRect(0, 0, W, H);

        // Window city glow
        const grad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
        grad.addColorStop(0, '#1a2744');
        grad.addColorStop(1, '#0b1020');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H * 0.55);

        // Pixel skyline outside window
        ctx.fillStyle = '#152038';
        const buildings = [
            [8, 70, 18, 40], [30, 55, 22, 55], [56, 62, 16, 48],
            [78, 40, 28, 70], [112, 58, 20, 52], [138, 48, 24, 62],
            [168, 66, 18, 44], [192, 35, 30, 75], [228, 52, 22, 58],
            [256, 44, 26, 66], [288, 60, 20, 50]
        ];
        for (const [x, y, w, h] of buildings) {
            ctx.fillRect(x, y, w, h);
            // windows
            ctx.fillStyle = '#f0c040';
            for (let wy = y + 4; wy < y + h - 4; wy += 6) {
                for (let wx = x + 3; wx < x + w - 3; wx += 5) {
                    if (((wx + wy + Math.floor(t * 2)) % 7) !== 0) {
                        ctx.fillRect(wx, wy, 2, 2);
                    }
                }
            }
            ctx.fillStyle = '#152038';
        }

        // Desk
        ctx.fillStyle = '#3d2914';
        ctx.fillRect(0, 130, W, 50);
        ctx.fillStyle = '#5a3d1e';
        ctx.fillRect(0, 128, W, 4);

        // Blueprint paper
        ctx.fillStyle = '#1e4d7b';
        ctx.fillRect(90, 95, 140, 55);
        ctx.strokeStyle = '#7ec8ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(90, 95, 140, 55);
        // Skyscraper drawing on blueprint
        ctx.strokeStyle = '#b8e0ff';
        ctx.beginPath();
        ctx.moveTo(120, 145);
        ctx.lineTo(120, 105);
        ctx.lineTo(135, 100);
        ctx.lineTo(150, 105);
        ctx.lineTo(150, 145);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(155, 145);
        ctx.lineTo(155, 112);
        ctx.lineTo(175, 108);
        ctx.lineTo(195, 112);
        ctx.lineTo(195, 145);
        ctx.stroke();
        // Grid lines
        ctx.strokeStyle = 'rgba(126,200,255,0.35)';
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(95, 105 + i * 10);
            ctx.lineTo(225, 105 + i * 10);
            ctx.stroke();
        }

        // Engineer 1 (left) – pixel figure leaning over blueprint
        this.drawPixelEngineer(ctx, 50, 100, t, 1);
        // Engineer 2 (right)
        this.drawPixelEngineer(ctx, 240, 102, t + 0.7, -1);

        // Lamp
        ctx.fillStyle = '#222';
        ctx.fillRect(155, 70, 6, 28);
        ctx.fillStyle = '#f5d76e';
        ctx.beginPath();
        ctx.moveTo(145, 70);
        ctx.lineTo(171, 70);
        ctx.lineTo(163, 58);
        ctx.lineTo(153, 58);
        ctx.closePath();
        ctx.fill();
        // Light cone
        ctx.fillStyle = 'rgba(245,215,110,0.12)';
        ctx.beginPath();
        ctx.moveTo(150, 70);
        ctx.lineTo(100, 130);
        ctx.lineTo(220, 130);
        ctx.closePath();
        ctx.fill();

        // Floating blueprint tower rising (projection fantasy)
        const rise = Math.min(1, Math.max(0, (t - 2) / 4));
        if (rise > 0) {
            const th = 20 + rise * 70;
            ctx.fillStyle = `rgba(100, 200, 255, ${0.15 + rise * 0.35})`;
            ctx.fillRect(148, 120 - th, 24, th);
            ctx.fillStyle = `rgba(180, 230, 255, ${0.4 + rise * 0.4})`;
            for (let i = 0; i < th; i += 5) {
                ctx.fillRect(151, 120 - th + i + 1, 4, 2);
                ctx.fillRect(165, 120 - th + i + 1, 4, 2);
            }
        }
    }

    drawPixelEngineer(ctx, x, y, t, facing) {
        const bob = Math.sin(t * 3) * 1.5;
        const yy = y + bob;
        // body
        ctx.fillStyle = '#2a4a6e'; // shirt
        ctx.fillRect(x - 8, yy + 14, 16, 22);
        // head
        ctx.fillStyle = '#e8b896';
        ctx.fillRect(x - 6, yy, 12, 12);
        // hair
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x - 6, yy, 12, 4);
        // arm pointing at blueprint
        ctx.fillStyle = '#e8b896';
        if (facing > 0) {
            ctx.fillRect(x + 6, yy + 18, 18, 4);
        } else {
            ctx.fillRect(x - 24, yy + 18, 18, 4);
        }
        // pants
        ctx.fillStyle = '#1e2a3a';
        ctx.fillRect(x - 7, yy + 34, 6, 16);
        ctx.fillRect(x + 1, yy + 34, 6, 16);
    }

    tick = () => {
        if (this.finished) return;
        const t = (performance.now() - this.startedAt) / 1000;
        this.updateActs(t);
        this.drawRetroFrame(t);
        if (t >= this.duration) {
            this.showStartButton();
            // auto-finish shortly after
            if (t >= this.duration + 2.5) {
                this.finish();
                return;
            }
        }
        this.raf = requestAnimationFrame(this.tick);
    };

    updateActs(t) {
        const root = this.root;
        if (!root) return;

        // Act timing
        const retro = root.querySelector('[data-act="retro"]');
        const smash = root.querySelector('[data-act="smash"]');
        const cinema = root.querySelector('[data-act="cinema"]');

        const setActive = (el, on) => el?.classList.toggle('is-active', on);
        const setDone = (el, on) => el?.classList.toggle('is-done', on);

        // 0–10s retro, 10–13 smash, 13–26 cinema
        setActive(retro, t < 11.2);
        setDone(retro, t >= 10.2);
        setActive(smash, t >= 10.0 && t < 13.5);
        setDone(smash, t >= 13.2);
        setActive(cinema, t >= 12.8);
        root.classList.toggle('phase-cinema', t >= 12.8);
        root.classList.toggle('phase-smash', t >= 10 && t < 13.5);

        const caption = root.querySelector('#retro-caption');
        if (caption) {
            if (t < 3) caption.textContent = 'KONSTRUKTÖRERNA RITAR…';
            else if (t < 6) caption.textContent = 'PROJEKTERAR HÖGA HUS';
            else if (t < 10) caption.textContent = 'STÅL · BETONG · VIND';
            else caption.textContent = '';
        }

        const line = root.querySelector('#cinema-line');
        if (line) {
            if (t < 16) line.textContent = 'Projektera höghus. Utmana fysiken. Invig — eller rasa.';
            else if (t < 20) line.textContent = 'Verklig bärverksfysik. Verkliga katastrofer.';
            else line.textContent = 'Bygg smartare. Bestå stormen.';
        }

        // Parallax towers
        const city = root.querySelector('.cinema-city');
        if (city && t >= 12.8) {
            const p = (t - 12.8) * 4;
            city.style.transform = `translateY(${12 - p * 0.35}px) scale(${1 + Math.min(0.08, (t - 12.8) * 0.008)})`;
        }
    }

    showStartButton() {
        const btn = this.root?.querySelector('#intro-start-btn');
        if (btn) btn.hidden = false;
    }

    finish() {
        if (this.finished) return;
        this.finished = true;
        cancelAnimationFrame(this.raf);
        this.stopMusic();
        this.markSeen();

        if (this.root) {
            this.root.classList.add('is-exiting');
            const node = this.root;
            setTimeout(() => {
                node.remove();
                this.root = null;
                this.onComplete?.();
            }, 700);
        } else {
            this.onComplete?.();
        }
    }
}

/** Återställ så introt spelas igen (t.ex. från meny). */
export function resetIntroSeen() {
    try {
        localStorage.removeItem(INTRO_SKIP_KEY);
    } catch { /* ignore */ }
}
