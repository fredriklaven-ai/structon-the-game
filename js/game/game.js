/**
 * STRUCTON THE GAME - Huvudspelsmotor & Tillståndshanterare
 * Kopplar ihop fysik, väder, ljud, nivåprogression, UI och besiktningsrapporter.
 */

import { PhysicsEngine } from '../engine/physics.js';
import { EnvironmentEngine } from '../engine/environment.js';
import { AudioManager } from './audio.js';
import { UIManager } from './ui.js';
import { LEVELS, SANDBOX_LEVEL } from './levels.js';
import { MATERIALS } from '../engine/materials.js';
import { TerrainEngine, buildAnchorNodes } from '../engine/terrain.js';

export class StructonGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.physics = new PhysicsEngine();
        this.environment = new EnvironmentEngine();
        this.audio = new AudioManager();
        this.ui = new UIManager(this, this.canvas);

        // Speltillstånd
        this.gameState = 'build'; // 'build', 'cladding', 'test', 'simulate', 'report'
        this.currentLevelIndex = 0;
        this.currentLevel = null;
        this.isSandbox = false;

        // Fasadmontage före lastpåföring
        this.facadeProgress = 0;
        this.claddingDuration = 2.4;
        this.claddingRooms = [];
        this.lastFacadeMountIndex = -1;

        // Testscenario och tidtagning
        this.testTimer = 0;
        this.testDuration = 10.0;
        this.isPaused = false;
        this.lastFrameTime = performance.now();

        // Spelardata och framsteg
        this.userProgress = this.loadUserProgress();

        this.initCallbacks();
        this.bindDOMButtons();
        this.startLevel(0);
        this.startLoop();
    }

    initCallbacks() {
        // Ljudtriggning vid brott
        this.physics.onMemberBroken = (member) => {
            this.audio.playCrack(member.materialKey);
            if (this.physics.stats.brokenMembersCount >= 3) {
                this.audio.playCollapse();
            }
        };

        // Ljudtriggning vid blixt
        this.environment.onLightning = () => {
            this.audio.playThunder();
        };

        // Ljud vid skalv
        this.environment.onEarthquakeStep = (mag) => {
            this.audio.updateEarthquake(mag);
        };
    }

    loadUserProgress() {
        try {
            const data = localStorage.getItem('structon_progress');
            return data ? JSON.parse(data) : { completedLevels: {}, stars: {} };
        } catch (e) {
            return { completedLevels: {}, stars: {} };
        }
    }

    saveUserProgress() {
        try {
            localStorage.setItem('structon_progress', JSON.stringify(this.userProgress));
        } catch (e) {
            console.warn(e);
        }
    }

    startLevel(index) {
        if (index === 'sandbox') {
            this.isSandbox = true;
            this.currentLevel = SANDBOX_LEVEL;
        } else {
            this.isSandbox = false;
            this.currentLevelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
            this.currentLevel = LEVELS[this.currentLevelIndex];
        }

        this.gameState = 'build';
        this.facadeProgress = 0;
        this.claddingRooms = [];
        this.lastFacadeMountIndex = -1;
        this.physics.reset();
        this.environment.reset();
        this.audio.updateWind(0);
        this.audio.updateEarthquake(0);

        const terrain = new TerrainEngine(this.currentLevel.ground || {});
        this.physics.terrain = terrain;
        this.environment.terrain = terrain;
        terrain.onTunnelCollapse = (tunnel) => {
            this.audio.playCrack('concrete_cast');
            this.showToast(`Bergtaket över ${tunnel.name || 'tunneln'} rasade under huslasten!`);
        };

        const anchors = buildAnchorNodes(terrain, this.currentLevel.ground || {});
        for (const n of anchors) {
            const node = this.physics.addNode(n.x, n.y, n.fixed, n.soil);
            node.isBedrockPinned = n.isBedrock || false;
            node.initialBedrockPinned = node.isBedrockPinned;
            node.isGroundAnchor = true;
        }

        // Visa hela tomten, klyftor, vatten, sprickor och tunnlar
        this.ui.fitOverview();

        // Visa/dölj sandlådekontroller
        const sandboxDrawer = document.getElementById('sandbox-drawer');
        if (sandboxDrawer) {
            sandboxDrawer.style.display = this.isSandbox ? 'flex' : 'none';
        }
        const testHud = document.getElementById('test-hud');
        if (testHud) {
            testHud.style.display = 'none';
        }

        this.updateMaterialPalette();
        this.updateHUD();
        this.ui.saveState();
        const t = this.physics.terrain;
        const geo = [];
        if (t?.tunnels.length) geo.push('bergstunnel');
        if (t?.ravines.length) geo.push('klyfta');
        if (t?.cracks.length) geo.push('spricka');
        this.showToast(geo.length
            ? `${this.currentLevel.name} · ${geo.join(', ')} – kontrollera bergtäckning`
            : `Uppdrag: ${this.currentLevel.name}`);
    }

    updateMaterialPalette() {
        const container = document.getElementById('material-list');
        if (!container) return;

        container.innerHTML = '';
        const allowed = this.currentLevel.allowedMaterials;

        for (const key of allowed) {
            const mat = MATERIALS[key];
            if (!mat) continue;

            const card = document.createElement('div');
            card.className = `mat-card ${this.ui.selectedMaterial === key ? 'active' : ''}`;
            card.dataset.material = key;

            card.innerHTML = `
                <div class="mat-badge" style="background-color: ${mat.color}; border: 1px solid ${mat.borderColor}"></div>
                <div class="mat-info">
                    <span class="mat-name">${mat.shortName}</span>
                    <span class="mat-cost">${mat.costPerMeter.toLocaleString('sv-SE')} kr/m</span>
                </div>
            `;

            card.addEventListener('click', () => {
                this.audio.init();
                this.audio.playClick();
                this.ui.selectedMaterial = key;
                document.querySelectorAll('.mat-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });

            container.appendChild(card);
        }
    }

    startTest() {
        if (this.physics.members.length === 0) {
            this.showToast('Du måste bygga en konstruktion innan du testar!');
            return;
        }

        this.audio.init();
        this.audio.resume();
        this.audio.playClick();

        this.physics.resetToBlueprint();
        if (this.physics.terrain) this.physics.terrain.resetRuntime();

        // Fasaderna monteras och klär in stommen innan lasterna påförs.
        const facadeStyle = this.resolveFacadeStyle();
        this.claddingRooms = this.physics.getFacadeBays(facadeStyle).map(room => ({
            ...room,
            style: facadeStyle
        }));
        this.facadeProgress = 0;
        this.lastFacadeMountIndex = -1;
        this.claddingDuration = Math.max(1.6, Math.min(4.2, 1.1 + this.claddingRooms.length * 0.28));
        this.gameState = 'cladding';
        this.testTimer = 0;
        const scenario = this.currentLevel.testScenario;
        this.testDuration = scenario.duration;

        // Inga katastroflaster under fasadmontage
        this.environment.setDisasterLevels({
            wind: 0,
            rain: 0,
            earthquake: 0,
            landslide: false
        });
        this.audio.updateWind(0);
        this.audio.updateEarthquake(0);

        const buildEl = document.getElementById('build-controls');
        const testEl = document.getElementById('test-controls');
        if (buildEl) buildEl.style.display = 'none';
        if (testEl) testEl.style.display = 'flex';
        const testHud = document.getElementById('test-hud');
        if (testHud) testHud.style.display = 'flex';

        this.showToast(this.claddingRooms.length
            ? 'Monterar fasader som klär in stommen...'
            : 'Stommen saknar slutna fack – lasterna påförs direkt.');

        if (!this.claddingRooms.length) {
            this.beginLoadPhase();
        }
    }

    resolveFacadeStyle() {
        const lvl = this.currentLevel;
        const allowed = lvl?.allowedMaterials || [];
        if (lvl?.category === 'residential' || allowed.includes('wood')) {
            if (allowed.includes('brick') && lvl?.category === 'commercial') return 'brick';
            if (lvl?.category === 'residential') return 'wood';
        }
        if (allowed.includes('brick') && (lvl?.category === 'commercial' || lvl?.id === 'level_2')) return 'brick';
        if (lvl?.category === 'airport') return 'glass';
        if (lvl?.category === 'highrise' || lvl?.category === 'skyscraper' || lvl?.category === 'megastructure') {
            return 'curtain';
        }
        if (allowed.includes('steel')) return 'curtain';
        if (allowed.includes('brick')) return 'brick';
        return 'glass';
    }

    beginLoadPhase() {
        const scenario = this.currentLevel.testScenario;
        this.facadeProgress = 1;
        this.gameState = 'test';
        this.testTimer = 0;
        this.environment.setDisasterLevels({
            wind: scenario.wind,
            rain: scenario.rain,
            earthquake: scenario.earthquake,
            landslide: scenario.landslide
        });
        this.audio.updateWind(scenario.wind);
        this.audio.updateEarthquake(scenario.earthquake);
        this.showToast(`Lasterna påförs: ${scenario.name}!`);
    }

    updateCladding(dt) {
        if (this.gameState !== 'cladding') return;
        this.facadeProgress = Math.min(1, this.facadeProgress + dt / this.claddingDuration);

        const rooms = this.claddingRooms;
        if (rooms.length) {
            const mountIndex = Math.min(
                rooms.length - 1,
                Math.floor(this.facadeProgress * rooms.length)
            );
            if (mountIndex > this.lastFacadeMountIndex) {
                this.lastFacadeMountIndex = mountIndex;
                this.audio.playFacadeMount(rooms[mountIndex]?.style || 'glass');
            }
        }

        if (this.facadeProgress >= 1) {
            this.beginLoadPhase();
        }
    }

    stopTest(returnToBuild = true) {
        this.environment.reset();
        this.audio.updateWind(0);
        this.audio.updateEarthquake(0);
        this.facadeProgress = 0;
        this.claddingRooms = [];
        this.lastFacadeMountIndex = -1;

        const testHud = document.getElementById('test-hud');
        if (testHud) testHud.style.display = 'none';

        this.physics.resetToBlueprint();
        if (this.physics.terrain) this.physics.terrain.resetRuntime();

        if (returnToBuild) {
            this.gameState = 'build';
            const buildEl = document.getElementById('build-controls');
            const testEl = document.getElementById('test-controls');
            if (buildEl) buildEl.style.display = 'flex';
            if (testEl) testEl.style.display = 'none';
            this.showToast('Återgick till byggläge.');
        }
    }

    finishTest() {
        this.gameState = 'report';
        this.environment.reset();
        this.audio.updateWind(0);
        this.audio.updateEarthquake(0);

        const testHud = document.getElementById('test-hud');
        if (testHud) testHud.style.display = 'none';

        const stats = this.physics.stats;
        const lvl = this.currentLevel;
        const remainingBudget = lvl.budget - stats.totalCost;
        const heightReached = stats.buildingHeight >= lvl.targetHeight;
        const noCollapse = stats.brokenMembersCount === 0;
        const stressOk = stats.maxStressRatio <= (lvl.starThresholds ? lvl.starThresholds.maxStressAllowed : 0.95);
        const isPassed = heightReached && noCollapse && stressOk && remainingBudget >= 0;

        let stars = 0;
        if (isPassed) {
            if (remainingBudget >= lvl.starThresholds.stars3_budget && stats.maxStressRatio < 0.75) {
                stars = 3;
            } else if (remainingBudget >= lvl.starThresholds.stars2_budget) {
                stars = 2;
            } else {
                stars = 1;
            }

            // Spara framsteg
            this.userProgress.completedLevels[lvl.id] = true;
            this.userProgress.stars[lvl.id] = Math.max(this.userProgress.stars[lvl.id] || 0, stars);
            this.saveUserProgress();

            this.audio.playVictory();
        } else {
            this.audio.playAlarm();
        }

        this.showInspectionReport(isPassed, stars, remainingBudget);
    }

    showInspectionReport(isPassed, stars, remainingBudget) {
        const modal = document.getElementById('report-modal');
        if (!modal) return;

        const stats = this.physics.stats;
        const lvl = this.currentLevel;

        let comment = '';
        if (isPassed) {
            if (stars === 3) {
                comment = '⭐⭐⭐ Mästerlig ingenjörskonst! Byggnaden uppvisade exceptionell styvhet, perfekt bärförmåga och låg materialkostnad.';
            } else if (stars === 2) {
                comment = '⭐⭐ Mycket stabil konstruktion! Den stod emot alla laster med god säkerhetsmarginal.';
            } else {
                comment = '⭐ Godkänd besiktning! Byggnaden höll ihop, men spänningsnivåerna var nära gränsvärdet eller budgeten var stram.';
            }
        } else {
            if (stats.buildingHeight < lvl.targetHeight) {
                comment = `❌ Bygghöjden nådde inte kravet på ${lvl.targetHeight} meter (nådde ${stats.buildingHeight}m).`;
            } else if (stats.brokenMembersCount > 0) {
                comment = `❌ Konstruktionen havererade! ${stats.brokenMembersCount} bärverkselement knäcktes eller bröts av. Förstärk med kryss-strävor eller starkare pelare.`;
            } else if (remainingBudget < 0) {
                comment = `❌ Budgetöverskridande! Konstruktionen kostade ${Math.abs(remainingBudget).toLocaleString('sv-SE')} kr för mycket.`;
            } else {
                comment = '❌ Spänningarna i bärverket överskred säkerhetskravet.';
            }
        }

        modal.innerHTML = `
            <div class="modal-content">
                <div class="report-header ${isPassed ? 'success' : 'fail'}">
                    <h2>${isPassed ? '✅ BESIKTNING GODKÄND!' : '⚠️ BESIKTNING UNDERKÄND'}</h2>
                    <div class="stars-container">
                        ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}
                    </div>
                </div>
                <div class="report-body">
                    <p class="engineer-comment">${comment}</p>
                    <div class="report-stats">
                        <div class="report-row"><span>Uppnådd Höjd:</span> <strong>${stats.buildingHeight} m (Mål: ${lvl.targetHeight}m)</strong></div>
                        <div class="report-row"><span>Max Toppsvaj:</span> <strong>${stats.maxTopSway} m</strong></div>
                        <div class="report-row"><span>Högsta Spänningsutnyttjande:</span> <strong>${Math.round(stats.maxStressRatio * 100)}%</strong></div>
                        <div class="report-row"><span>Knäckta/Skadade Element:</span> <strong>${stats.brokenMembersCount} st</strong></div>
                        <div class="report-row"><span>Total Byggkostnad:</span> <strong>${stats.totalCost.toLocaleString('sv-SE')} kr</strong></div>
                        <div class="report-row"><span>Kvarvarande Budget:</span> <strong style="color: ${remainingBudget >= 0 ? '#34D399' : '#F87171'}">${remainingBudget.toLocaleString('sv-SE')} kr</strong></div>
                    </div>
                </div>
                <div class="report-actions">
                    <button class="btn btn-secondary" id="report-retry-btn">🛠️ Förbättra Konstruktionen</button>
                    ${isPassed && this.currentLevelIndex < LEVELS.length - 1 ? '<button class="btn btn-primary" id="report-next-btn">🚀 Nästa Nivå</button>' : ''}
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        document.getElementById('report-retry-btn').addEventListener('click', () => {
            modal.style.display = 'none';
            this.stopTest(true);
        });

        const nextBtn = document.getElementById('report-next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                this.stopTest(false);
                this.startLevel(this.currentLevelIndex + 1);
            });
        }
    }

    startLoop() {
        const loop = (timestamp) => {
            const dt = Math.min(0.05, (timestamp - this.lastFrameTime) / 1000);
            this.lastFrameTime = timestamp;

            if (!this.isPaused) {
                if (this.gameState === 'cladding') {
                    // Fasadmontage: stommen står stilla medan fasaderna monteras
                    this.physics.calculateStats();
                    this.updateCladding(dt);
                } else if (this.gameState === 'test' || this.gameState === 'simulate') {
                    // Uppdatera aktiv dynamisk fysik och miljö vid test
                    this.physics.step(dt, this.environment);
                    this.environment.update(dt);

                    if (this.gameState === 'test') {
                        this.testTimer += dt;
                        if (this.testTimer >= this.testDuration) {
                            this.finishTest();
                        }
                    }
                } else {
                    // I byggläge: Statisk ritningsvy (inga fallande balkar under pågående bygge!)
                    this.physics.calculateStats();
                    this.physics.updateDebris(dt);
                }
            }

            // Rendera canvas
            this.ui.render();
            this.updateHUD();

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    updateHUD() {
        const stats = this.physics.stats;
        const lvl = this.currentLevel;
        if (!lvl) return;

        const heightEl = document.getElementById('hud-height');
        const budgetEl = document.getElementById('hud-budget');
        const stressEl = document.getElementById('hud-stress');
        const levelNameEl = document.getElementById('hud-level-name');
        const timerEl = document.getElementById('test-timer-val');
        const timerLabel = document.getElementById('test-hud-label');

        if (levelNameEl) levelNameEl.innerText = lvl.name;
        if (heightEl) heightEl.innerText = `${stats.buildingHeight}m / ${lvl.targetHeight}m`;
        
        if (budgetEl) {
            const rem = lvl.budget - stats.totalCost;
            budgetEl.innerText = `${rem.toLocaleString('sv-SE')} kr`;
            budgetEl.style.color = rem < 0 ? '#EF4444' : '#38BDF8';
        }

        if (stressEl) {
            const pct = Math.min(100, Math.round(stats.maxStressRatio * 100));
            stressEl.innerText = `${pct}%`;
            stressEl.style.color = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#34D399';
        }

        if (timerEl) {
            if (this.gameState === 'cladding') {
                const pct = Math.round(this.facadeProgress * 100);
                timerEl.innerText = `${pct}%`;
                if (timerLabel) timerLabel.innerText = '🏗️ Fasadmontage';
            } else if (this.gameState === 'test') {
                const timeLeft = Math.max(0, this.testDuration - this.testTimer).toFixed(1);
                timerEl.innerText = `${timeLeft}s`;
                if (timerLabel) timerLabel.innerText = '⏱️ Testtid Kvar';
            }
        }
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerText = message;
        toast.classList.add('show');
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    bindDOMButtons() {
        // Verktygsväljare
        const tools = ['build', 'strut', 'foundation', 'pile', 'delete', 'inspect'];
        tools.forEach(tool => {
            const btn = document.getElementById(`tool-${tool}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.audio.init();
                    this.audio.playClick();
                    this.ui.activeTool = tool;
                    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            }
        });

        // Invigning & avbryt
        const startTestBtn = document.getElementById('btn-start-test');
        if (startTestBtn) {
            startTestBtn.addEventListener('click', () => this.startTest());
        }
        const stopTestBtn = document.getElementById('btn-stop-test');
        if (stopTestBtn) {
            stopTestBtn.addEventListener('click', () => this.stopTest(true));
        }

        const zoomOut = document.getElementById('btn-zoom-out');
        const zoomIn = document.getElementById('btn-zoom-in');
        const zoomFit = document.getElementById('btn-zoom-fit');
        if (zoomOut) zoomOut.addEventListener('click', () => { this.audio.init(); this.ui.zoomBy(0.8); });
        if (zoomIn) zoomIn.addEventListener('click', () => { this.audio.init(); this.ui.zoomBy(1.25); });
        if (zoomFit) zoomFit.addEventListener('click', () => { this.audio.init(); this.ui.fitOverview(); });

        // Undo & Clear
        const undoBtn = document.getElementById('btn-undo');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.ui.undo());
        }
        const clearBtn = document.getElementById('btn-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Vill du rensa hela konstruktionen?')) {
                    this.startLevel(this.isSandbox ? 'sandbox' : this.currentLevelIndex);
                }
            });
        }

        // Ljud av/på
        const muteBtn = document.getElementById('btn-mute');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                this.audio.init();
                const isMuted = this.audio.toggleMute();
                muteBtn.innerText = isMuted ? '🔇' : '🔊';
            });
        }

        // Spänningskarta-växlare
        const heatmapBtn = document.getElementById('btn-heatmap');
        if (heatmapBtn) {
            heatmapBtn.addEventListener('click', () => {
                this.ui.isHeatmapActive = !this.ui.isHeatmapActive;
                heatmapBtn.classList.toggle('active', this.ui.isHeatmapActive);
            });
        }

        // Nivåmeny
        const menuBtn = document.getElementById('btn-menu');
        const levelModal = document.getElementById('level-modal');
        if (menuBtn && levelModal) {
            menuBtn.addEventListener('click', () => {
                this.renderLevelMenu();
                levelModal.style.display = 'flex';
            });
        }

        // Sandlåde-sliders
        this.bindSandboxSliders();
    }

    renderLevelMenu() {
        const grid = document.getElementById('level-grid');
        if (!grid) return;
        grid.innerHTML = '';

        LEVELS.forEach((lvl, idx) => {
            const isCompleted = this.userProgress.completedLevels[lvl.id];
            const stars = this.userProgress.stars[lvl.id] || 0;
            const isUnlocked = idx === 0 || this.userProgress.completedLevels[LEVELS[idx - 1].id];

            const card = document.createElement('div');
            card.className = `level-card ${isUnlocked ? 'unlocked' : 'locked'} ${this.currentLevelIndex === idx ? 'current' : ''}`;
            card.innerHTML = `
                <h3>${lvl.name}</h3>
                <p class="lvl-sub">${lvl.subtitle}</p>
                <div class="lvl-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
                <p class="lvl-desc">${lvl.description.substring(0, 75)}...</p>
                <button class="btn btn-sm ${isUnlocked ? 'btn-primary' : 'btn-disabled'}">
                    ${isUnlocked ? 'Spela Uppdrag' : '🔒 Låst'}
                </button>
            `;

            if (isUnlocked) {
                card.addEventListener('click', () => {
                    document.getElementById('level-modal').style.display = 'none';
                    this.startLevel(idx);
                });
            }

            grid.appendChild(card);
        });

        // Sandlådekort
        const sandCard = document.createElement('div');
        sandCard.className = 'level-card sandbox-card unlocked';
        sandCard.innerHTML = `
            <h3>🏖️ Sandlådeläge</h3>
            <p class="lvl-sub">Fritt bygge & Katastroflabb</p>
            <div class="lvl-stars">⭐⭐⭐</div>
            <p class="lvl-desc">Obegränsad budget, alla material och fullständiga katastrofreglage.</p>
            <button class="btn btn-sm btn-primary">Öppna Labbet</button>
        `;
        sandCard.addEventListener('click', () => {
            document.getElementById('level-modal').style.display = 'none';
            this.startLevel('sandbox');
        });
        grid.appendChild(sandCard);
    }

    bindSandboxSliders() {
        const sliderWind = document.getElementById('slider-wind');
        const sliderRain = document.getElementById('slider-rain');
        const sliderQuake = document.getElementById('slider-quake');
        const checkSlide = document.getElementById('check-slide');

        const updateDisasters = () => {
            if (!sliderWind || !sliderRain || !sliderQuake) return;
            const wind = parseFloat(sliderWind.value);
            const rain = parseFloat(sliderRain.value) / 100;
            const quake = parseFloat(sliderQuake.value);
            const landslide = checkSlide ? checkSlide.checked : false;

            this.environment.setDisasterLevels({ wind, rain, earthquake: quake, landslide });
            this.audio.updateWind(wind);
            this.audio.updateEarthquake(quake);

            document.getElementById('val-wind').innerText = `${wind} m/s`;
            document.getElementById('val-rain').innerText = `${Math.round(rain * 100)}%`;
            document.getElementById('val-quake').innerText = `Mag ${quake.toFixed(1)}`;
        };

        if (sliderWind) sliderWind.addEventListener('input', updateDisasters);
        if (sliderRain) sliderRain.addEventListener('input', updateDisasters);
        if (sliderQuake) sliderQuake.addEventListener('input', updateDisasters);
        if (checkSlide) checkSlide.addEventListener('change', updateDisasters);
    }
}

// Starta spelet när sidan laddats
window.addEventListener('DOMContentLoaded', () => {
    window.structon = new StructonGame();
});
