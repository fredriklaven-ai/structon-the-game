/**
 * STRUCTON THE GAME - UI & Canvas Renderingsmotor
 * Hanterar pekskärmskontroller, nyp-zoom, magnetisk snäppning, rendering av balkar/mark/rum och modaler.
 */

import { MATERIALS, SOIL_TYPES } from '../engine/materials.js';

export class UIManager {
    constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Kamera & Vy
        this.zoom = 24;          // Pixlar per meter
        this.minZoom = 1.5;
        this.maxZoom = 60;
        this.panX = 0;           // Canvas pixlar
        this.panY = 0;

        // Byggverktyg & Status
        this.activeTool = 'build';      // 'build', 'strut', 'foundation', 'pile', 'delete', 'inspect'
        this.selectedMaterial = 'wood'; // vald materialnyckel
        this.gridSize = 1.0;            // Snäppraster i meter (1m)
        this.snapRadius = 0.6;          // m
        this.isHeatmapActive = true;    // Spänningskarta aktiverad

        // Interaktionstillstånd (Mus & Touch)
        this.isInteracting = false;
        this.isPanning = false;
        this.dragStartNode = null;
        this.dragStartPos = { x: 0, y: 0 };
        this.currentPointerWorld = { x: 0, y: 0 };
        this.hoverNode = null;
        this.hoverMember = null;
        this.inspectedMember = null;

        // Multi-touch för nyp-zoom
        this.touchPoints = new Map();
        this.initialPinchDist = 0;
        this.initialZoom = this.zoom;

        // Undo/Redo historik
        this.history = [];
        this.historyIndex = -1;

        this.initEvents();
        this.initDPI();
    }

    initDPI() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;
        this.layoutChrome();

        // Centrera kameran på markytan
        if (this.panX === 0 && this.panY === 0) {
            this.panX = this.displayWidth / 2;
            this.panY = this.displayHeight * 0.72;
        }
    }

    screenToWorld(screenX, screenY) {
        const wx = (screenX - this.panX) / this.zoom;
        const wy = (this.panY - screenY) / this.zoom; // Invertera Y för koordinater uppåt
        return { x: wx, y: wy };
    }

    worldToScreen(worldX, worldY) {
        const sx = this.panX + worldX * this.zoom;
        const sy = this.panY - worldY * this.zoom;
        return { x: sx, y: sy };
    }

    snapToGrid(pos) {
        return {
            x: Math.round(pos.x / this.gridSize) * this.gridSize,
            y: Math.round(pos.y / this.gridSize) * this.gridSize
        };
    }

    initEvents() {
        // Fönsterstorleksändring
        window.addEventListener('resize', () => {
            this.initDPI();
        });

        // 1. Mus- och pekarhändelser
        this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        this.canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        this.canvas.addEventListener('pointercancel', (e) => this.handlePointerUp(e));

        // 2. Scrollhjul för zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const mouseScreen = this.getCanvasCoords(e);
            const worldBefore = this.screenToWorld(mouseScreen.x, mouseScreen.y);

            const zoomDelta = e.deltaY < 0 ? 1.15 : 0.85;
            const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomDelta));

            // Zooma mot muspekaren
            this.zoom = newZoom;
            this.panX = mouseScreen.x - worldBefore.x * this.zoom;
            this.panY = mouseScreen.y + worldBefore.y * this.zoom;
        }, { passive: false });

        // Förhindra högerklicksmeny
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                this.zoomBy(0.8);
            } else if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                this.zoomBy(1.25);
            } else if (e.key === '0') {
                e.preventDefault();
                this.fitOverview();
            }
        });
    }

    layoutChrome() {
        const hud = document.querySelector('.top-hud');
        const toolbox = document.querySelector('.toolbox');
        if (!hud || !toolbox) return;
        const h = hud.getBoundingClientRect();
        toolbox.style.top = `${Math.round(h.bottom + 8)}px`;
    }

    zoomBy(factor, screenX = null, screenY = null) {
        const sx = screenX == null ? this.displayWidth / 2 : screenX;
        const sy = screenY == null ? this.displayHeight / 2 : screenY;
        const worldBefore = this.screenToWorld(sx, sy);
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
        this.panX = sx - worldBefore.x * this.zoom;
        this.panY = sy + worldBefore.y * this.zoom;
    }

    /**
     * Zooma ut så att tomt, klyftor, vatten, sprickor och tunnlar syns i vyn.
     */
    fitOverview() {
        const lvl = this.game.currentLevel;
        const terrain = this.game.physics.terrain;
        let minX = -24;
        let maxX = 24;
        let minY = -12;
        let maxY = Math.max(8, lvl?.targetHeight || 0);

        if (terrain) {
            const b = terrain.overviewBounds(6, lvl?.targetHeight || 0);
            minX = b.minX;
            maxX = b.maxX;
            minY = b.minY;
            maxY = b.maxY;
        } else if (lvl?.ground) {
            minX = (lvl.ground.leftX ?? -24) - 6;
            maxX = (lvl.ground.rightX ?? 24) + 6;
            minY = (lvl.ground.bedrockY ?? -8) - 6;
        }

        const hud = document.querySelector('.top-hud');
        const dock = document.querySelector('.bottom-dock');
        const padTop = (hud ? hud.getBoundingClientRect().height : 64) + 18;
        const padBottom = (dock ? dock.getBoundingClientRect().height : 64) + 18;
        const padLeft = 72;
        const padRight = 24;
        const availW = Math.max(120, this.displayWidth - padLeft - padRight);
        const availH = Math.max(120, this.displayHeight - padTop - padBottom);
        const worldW = Math.max(12, maxX - minX);
        const worldH = Math.max(10, maxY - minY);
        const zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(availW / worldW, availH / worldH) * 0.92));
        this.zoom = zoom;

        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        const cx = padLeft + availW / 2;
        const cy = padTop + availH / 2;
        this.panX = cx - midX * this.zoom;
        this.panY = cy + midY * this.zoom;
        this.layoutChrome();
    }

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handlePointerDown(e) {
        this.canvas.setPointerCapture(e.pointerId);
        this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });

        const coords = this.getCanvasCoords(e);
        const world = this.screenToWorld(coords.x, coords.y);
        this.currentPointerWorld = world;

        // Om 2 fingrar används -> Panorera & Nyp-zooma
        if (this.touchPoints.size === 2) {
            const pts = Array.from(this.touchPoints.values());
            this.initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            this.initialZoom = this.zoom;
            this.isPanning = true;
            this.dragStartNode = null;
            return;
        }

        // Högerklick eller mellanslag -> Panorera
        if (e.button === 2 || e.button === 1 || this.activeTool === 'pan') {
            this.isPanning = true;
            this.dragStartPos = { x: coords.x, y: coords.y };
            return;
        }

        // Endast i byggläge kan man ändra strukturen
        if (this.game.gameState !== 'build') {
            if (this.activeTool === 'inspect') {
                this.inspectAt(world);
            }
            return;
        }

        // Hitta närmaste befintliga nod eller element
        const nearestNode = this.game.physics.findNearestNode(world.x, world.y, this.snapRadius);
        
        if (this.activeTool === 'delete') {
            if (nearestNode && !nearestNode.fixed) {
                this.game.physics.removeNode(nearestNode);
                this.game.audio.playDelete();
                this.saveState();
            } else {
                // Hitta balk under pekaren
                const member = this.findMemberUnder(world.x, world.y);
                if (member) {
                    this.game.physics.removeMember(member);
                    this.game.audio.playDelete();
                    this.saveState();
                }
            }
            return;
        }

        if (this.activeTool === 'inspect') {
            this.inspectAt(world);
            return;
        }

        // Byggverktyg (Balk, Pelare, Sträva, Grundläggning, Påle)
        this.isInteracting = true;

        if (nearestNode) {
            this.dragStartNode = nearestNode;
        } else {
            // Skapa ny startnod vid snäppposition
            const snapped = this.snapToGrid(world);
            const node = this.game.physics.addNode(snapped.x, snapped.y, false);
            this.applyNodeGeology(node, snapped.x, snapped.y);
            this.dragStartNode = node;
            this.game.audio.playPlaceNode();
        }
    }

    handlePointerMove(e) {
        this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const coords = this.getCanvasCoords(e);
        const world = this.screenToWorld(coords.x, coords.y);
        this.currentPointerWorld = world;

        // Nyp-zoom med 2 fingrar
        if (this.touchPoints.size === 2) {
            const pts = Array.from(this.touchPoints.values());
            const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            if (this.initialPinchDist > 0) {
                const scale = currentDist / this.initialPinchDist;
                this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.initialZoom * scale));
            }
            return;
        }

        // Panorering med mus/ett finger vid pan-läge
        if (this.isPanning) {
            const dx = coords.x - this.dragStartPos.x;
            const dy = coords.y - this.dragStartPos.y;
            this.panX += dx;
            this.panY += dy;
            this.dragStartPos = { x: coords.x, y: coords.y };
            return;
        }

        // Hover-detektion
        this.hoverNode = this.game.physics.findNearestNode(world.x, world.y, this.snapRadius);
        this.hoverMember = this.findMemberUnder(world.x, world.y);
    }

    handlePointerUp(e) {
        this.touchPoints.delete(e.pointerId);

        if (this.touchPoints.size < 2) {
            this.initialPinchDist = 0;
        }

        if (this.isPanning) {
            this.isPanning = false;
            return;
        }

        if (this.isInteracting && this.dragStartNode && this.game.gameState === 'build') {
            const world = this.currentPointerWorld;
            let endNode = this.game.physics.findNearestNode(world.x, world.y, this.snapRadius);

            if (!endNode) {
                const snapped = this.snapToGrid(world);
                // Skapa inte om samma punkt
                if (Math.hypot(snapped.x - this.dragStartNode.x, snapped.y - this.dragStartNode.y) > 0.4) {
                    endNode = this.game.physics.addNode(snapped.x, snapped.y, false);
                    this.applyNodeGeology(endNode, snapped.x, snapped.y);
                }
            }

            if (endNode && endNode !== this.dragStartNode) {
                // Välj material baserat på aktivt verktyg
                let materialToUse = this.selectedMaterial;
                if (this.activeTool === 'strut') {
                    materialToUse = materialToUse === 'wood' ? 'strut_wood' : 'strut_steel';
                } else if (this.activeTool === 'foundation') {
                    materialToUse = 'concrete_cast';
                } else if (this.activeTool === 'pile') {
                    materialToUse = 'pile';
                }

                // Kontrollera max spännvidd
                const matDef = MATERIALS[materialToUse];
                const span = Math.hypot(endNode.x - this.dragStartNode.x, endNode.y - this.dragStartNode.y);

                if (span <= matDef.maxSpan) {
                    const member = this.game.physics.addMember(this.dragStartNode, endNode, materialToUse);
                    if (member) {
                        this.game.audio.playPlaceMember(materialToUse);
                        this.saveState();
                    }
                } else {
                    // Spännvidden för stor! Skapa mellanliggande noder eller varna
                    this.game.showToast(`För lång spännvidd! Max för ${matDef.shortName} är ${matDef.maxSpan}m.`);
                }
            }

            // Rensa tomma oanslutna startnoder
            this.game.physics.cleanOrphanNodes();
        }

        this.isInteracting = false;
        this.dragStartNode = null;
    }

    applyNodeGeology(node, x, y) {
        const terrain = this.game.physics.terrain;
        if (!terrain) {
            if (y <= 0) {
                node.soilType = this.game.currentLevel ? this.game.currentLevel.ground.soilType : 'stiff_soil';
            }
            return;
        }
        const cls = terrain.classify(x, y);
        if (cls === 'rock') node.soilType = 'bedrock';
        else if (cls === 'soil' || y <= terrain.surfaceY(x) + 0.25) {
            node.soilType = terrain.soilType;
        }
    }

    visibleWorldBounds(pad = 12) {
        const left = -this.panX / this.zoom - pad;
        const right = (this.displayWidth - this.panX) / this.zoom + pad;
        const top = this.panY / this.zoom + pad;
        const bottom = (this.panY - this.displayHeight) / this.zoom - pad;
        return { left, right, top, bottom };
    }

    findMemberUnder(wx, wy, maxDist = 0.5) {
        for (const m of this.game.physics.members) {
            if (m.isBroken) continue;
            const dist = this.distPointToSegment(wx, wy, m.nodeA.x, m.nodeA.y, m.nodeB.x, m.nodeB.y);
            if (dist < maxDist) {
                return m;
            }
        }
        return null;
    }

    distPointToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }

    inspectAt(world) {
        const member = this.findMemberUnder(world.x, world.y);
        if (member) {
            this.inspectedMember = member;
            this.renderInspectionCard(member);
            return;
        }
        this.inspectedMember = null;
        const terrain = this.game.physics.terrain;
        if (terrain) {
            this.renderGeologyCard(world.x, world.y, terrain);
            return;
        }
        const card = document.getElementById('inspection-card');
        if (card) card.style.display = 'none';
    }

    renderGeologyCard(x, y, terrain) {
        const card = document.getElementById('inspection-card');
        if (!card) return;
        const cls = terrain.classify(x, y);
        const surf = terrain.surfaceY(x);
        const rock = terrain.bedrockY(x);
        const water = terrain.waterSurfaceY(x);
        const labels = {
            air: 'Luft / ovan mark',
            water: 'Vatten',
            soil: SOIL_TYPES[terrain.soilType]?.name || 'Jord',
            rock: 'Fast urberg',
            tunnel: 'Bergtunnel (hålrum)',
            crack: 'Bergsspricka'
        };
        let extra = '';
        const assessments = terrain.assessTunnelLoads(this.game.physics.nodes);
        for (const a of assessments) {
            if (!terrain.isOverTunnel(x, a.tunnel) && cls !== 'tunnel') continue;
            const util = Math.round(a.utilization * 100);
            extra += `<div class="stat-row"><span>Tunnel:</span> <strong>${a.tunnel.name || 'Bergtunnel'}</strong></div>
                <div class="stat-row"><span>Bergtäckning / spännvidd:</span> <strong>${a.cover.toFixed(1)} m / ${a.span.toFixed(1)} m</strong></div>
                <div class="stat-row"><span>Huslast mot taket:</span> <strong>${(a.buildingN / 1000).toFixed(0)} kN</strong></div>
                <div class="stat-row"><span>Bergkapacitet:</span> <strong>${(a.capacityN / 1000).toFixed(0)} kN (${util}%)</strong></div>`;
        }
        card.innerHTML = `
            <div class="card-header">
                <h4>Geologi vid ${x.toFixed(1)} m</h4>
                <button class="close-btn" onclick="document.getElementById('inspection-card').style.display='none'">✕</button>
            </div>
            <div class="card-body">
                <div class="stat-row"><span>Klass:</span> <strong>${labels[cls] || cls}</strong></div>
                <div class="stat-row"><span>Markyta:</span> <strong>${surf.toFixed(2)} m</strong></div>
                <div class="stat-row"><span>Bergöveryta:</span> <strong>${rock.toFixed(2)} m</strong></div>
                <div class="stat-row"><span>Jordmäktighet:</span> <strong>${(surf - rock).toFixed(2)} m</strong></div>
                ${water != null ? `<div class="stat-row"><span>Vattenyta:</span> <strong>${water.toFixed(2)} m</strong></div>` : ''}
                ${extra}
            </div>
        `;
        card.style.display = 'block';
    }

    renderInspectionCard(member) {
        const card = document.getElementById('inspection-card');
        if (!card) return;

        const mat = member.material;
        const forceType = member.force >= 0 ? 'Dragkraft (+)' : 'Tryckkraft (-)';
        const forceKN = (Math.abs(member.force) / 1000).toFixed(1);
        const stressMPa = (member.stress / 1e6).toFixed(1);
        const maxStressMPa = ((member.force >= 0 ? mat.maxTension : mat.maxCompression) / 1e6).toFixed(1);
        const utilPct = Math.min(100, Math.round(member.stressRatio * 100));

        let statusClass = 'safe';
        let statusText = 'Säker / Godkänd';
        if (utilPct > 90) {
            statusClass = 'danger';
            statusText = 'KRITISK / Knäckrisk!';
        } else if (utilPct > 70) {
            statusClass = 'warning';
            statusText = 'Hög belastning';
        }

        card.innerHTML = `
            <div class="card-header">
                <h4><i class="icon-info"></i> ${mat.name}</h4>
                <button class="close-btn" onclick="document.getElementById('inspection-card').style.display='none'">✕</button>
            </div>
            <div class="card-body">
                <div class="stat-row"><span>Status:</span> <strong class="badge ${statusClass}">${statusText} (${utilPct}%)</strong></div>
                <div class="stat-row"><span>Längd / Spännvidd:</span> <strong>${member.currentLength.toFixed(2)} m</strong></div>
                <div class="stat-row"><span>Krafttyp:</span> <strong>${forceType}</strong></div>
                <div class="stat-row"><span>Normalkraft:</span> <strong>${forceKN} kN</strong></div>
                <div class="stat-row"><span>Aktuell Spänning:</span> <strong>${stressMPa} MPa</strong></div>
                <div class="stat-row"><span>Max Bärkraft:</span> <strong>${maxStressMPa} MPa</strong></div>
                <div class="stat-row"><span>E-Modul:</span> <strong>${(mat.youngsModulus / 1e9).toFixed(0)} GPa</strong></div>
                <div class="stat-row"><span>Egenvikt:</span> <strong>${Math.round(member.weight)} kg</strong></div>
                <div class="stat-row"><span>Kostnad:</span> <strong>${member.cost.toLocaleString('sv-SE')} kr</strong></div>
            </div>
        `;
        card.style.display = 'block';
    }

    saveState() {
        // Spara nod- och balkkonfiguration för Undo
        const snapshot = {
            nodes: this.game.physics.nodes.map(n => ({
                x: n.x, y: n.y, fixed: n.fixed, soilType: n.soilType, id: n.id,
                isBedrockPinned: n.isBedrockPinned, isGroundAnchor: n.isGroundAnchor
            })),
            members: this.game.physics.members.filter(m => !m.isBroken).map(m => ({
                nodeAIdx: this.game.physics.nodes.indexOf(m.nodeA),
                nodeBIdx: this.game.physics.nodes.indexOf(m.nodeB),
                materialKey: m.materialKey
            }))
        };
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(snapshot);
        this.historyIndex = this.history.length - 1;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadState(this.history[this.historyIndex]);
            this.game.audio.playClick();
        }
    }

    loadState(snapshot) {
        if (!snapshot) return;
        this.game.physics.reset();
        
        // Återskapa noder
        const nodeMap = [];
        for (const nData of snapshot.nodes) {
            const node = this.game.physics.addNode(nData.x, nData.y, nData.fixed, nData.soilType);
            node.isBedrockPinned = !!nData.isBedrockPinned;
            node.initialBedrockPinned = node.isBedrockPinned;
            node.isGroundAnchor = !!nData.isGroundAnchor;
            nodeMap.push(node);
        }

        // Återskapa balkar
        for (const mData of snapshot.members) {
            const nA = nodeMap[mData.nodeAIdx];
            const nB = nodeMap[mData.nodeBIdx];
            if (nA && nB) {
                this.game.physics.addMember(nA, nB, mData.materialKey);
            }
        }
        this.game.physics.calculateStats();
    }

    // ==========================================
    // RENDERINGSLOOP
    // ==========================================
    render() {
        const ctx = this.ctx;
        const width = this.displayWidth;
        const height = this.displayHeight;

        ctx.clearRect(0, 0, width, height);

        // 1. Rendera dynamisk himmel & väderatmosfär
        this.renderSky(ctx, width, height);

        ctx.save();
        // Applicera kameratransformation
        ctx.translate(this.panX, this.panY);

        // 2. Rendera mark, geologiska lager och berggrund
        this.renderGround(ctx);

        // 3. Rendera byggnadsraster (Grid)
        if (this.game.gameState === 'build') {
            this.renderGrid(ctx);
        }

        // 4. Rendera stomme först (balkar synliga under montage)
        this.renderMembers(ctx);

        // 5. Fasaderna klär in stommen under/efter invigning
        this.renderFacades(ctx);

        // 6. Rendera noder och anslutningar
        this.renderNodes(ctx);

        // 7. Rendera rasmassor och fysikskräp
        this.renderDebris(ctx);

        // 8. Rendera interaktiv byggförhandsgranskning (draglinje)
        this.renderBuildPreview(ctx);

        // 9. Rendera måttstock och höjdindikator (meterlinjal)
        this.renderHeightRuler(ctx);

        // 10. Rendera väderpartiklar (regn & vindstråk)
        this.renderWeatherParticles(ctx);

        ctx.restore();

        // 11. Blixtnedslagsflash
        if (this.game.environment.lightningFlash > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.game.environment.lightningFlash * 0.75})`;
            ctx.fillRect(0, 0, width, height);
        }
    }

    renderSky(ctx, width, height) {
        const env = this.game.environment;
        const storminess = Math.min(1.0, (env.windSpeed / 40) * 0.6 + env.rainIntensity * 0.4);

        // Gradient från vacker daghimmel till mörk storm
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        if (storminess < 0.2) {
            // Klar dag / Arkitektblå
            grad.addColorStop(0, '#0F172A');
            grad.addColorStop(0.4, '#1E293B');
            grad.addColorStop(1, '#334155');
        } else if (storminess < 0.6) {
            // Mulen / Blåsigt
            grad.addColorStop(0, '#0B132B');
            grad.addColorStop(0.5, '#1C2541');
            grad.addColorStop(1, '#3A506B');
        } else {
            // Mörk storm med åskmoln
            grad.addColorStop(0, '#050811');
            grad.addColorStop(0.5, '#0F172A');
            grad.addColorStop(1, '#1E1B4B');
        }

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }

    renderGround(ctx) {
        const terrain = this.game.physics.terrain;
        const env = this.game.environment;
        const lvl = this.game.currentLevel;
        const ground = lvl ? lvl.ground : { soilType: 'stiff_soil' };

        ctx.save();
        ctx.translate(env.groundOffsetX * this.zoom, -env.groundOffsetY * this.zoom);

        const view = this.visibleWorldBounds(18);
        const z = this.zoom;
        const deepY = Math.min(view.bottom - 8, -28);

        if (!terrain) {
            this.renderFlatGroundFallback(ctx, ground, z, deepY);
            ctx.restore();
            return;
        }

        const profile = terrain.sampleProfile(view.left, view.right, Math.max(0.28, 10 / z));

        this.renderDistantHills(ctx, profile, z);

        // 1. Berggrund – fyllning med hål för tunnlar och sprickor
        ctx.fillStyle = '#1B2434';
        ctx.beginPath();
        ctx.moveTo(profile[0].x * z, -deepY * z);
        for (const p of profile) {
            ctx.lineTo(p.x * z, -p.bedrockY * z);
        }
        ctx.lineTo(profile[profile.length - 1].x * z, -deepY * z);
        ctx.closePath();

        for (const tunnel of terrain.tunnels) {
            if (terrain.collapsedTunnels.has(tunnel.id)) continue;
            ctx.moveTo((tunnel.x + tunnel.width / 2) * z, -tunnel.y * z);
            ctx.ellipse(tunnel.x * z, -tunnel.y * z, (tunnel.width / 2) * z, (tunnel.height / 2) * z, 0, 0, Math.PI * 2, true);
        }
        for (const crack of terrain.cracks) {
            const poly = terrain.crackPolygon(crack);
            ctx.moveTo((crack.x - poly.topHalf) * z, -poly.topY * z);
            ctx.lineTo((crack.x + poly.topHalf) * z, -poly.topY * z);
            ctx.lineTo((crack.x + poly.botHalf) * z, -poly.botY * z);
            ctx.lineTo((crack.x - poly.botHalf) * z, -poly.botY * z);
            ctx.closePath();
        }
        ctx.fill('evenodd');

        // Bergöveryta (kuperad kontur mot jorden)
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = Math.max(2, z * 0.08);
        ctx.beginPath();
        for (let i = 0; i < profile.length; i++) {
            const sx = profile[i].x * z;
            const sy = -profile[i].bedrockY * z;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
        ctx.lineWidth = 1.2;
        for (let k = 1; k <= 4; k++) {
            ctx.beginPath();
            let started = false;
            for (const p of profile) {
                const y = p.bedrockY - k * 1.35 - Math.sin(p.x * 0.21 + k) * 0.25;
                const sx = p.x * z;
                const sy = -y * z;
                if (!started) {
                    ctx.moveTo(sx, sy);
                    started = true;
                } else {
                    ctx.lineTo(sx, sy);
                }
            }
            ctx.stroke();
        }

        // Diagonala bergfogar
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
        ctx.lineWidth = 1;
        const jointStart = Math.floor(view.left / 7) * 7;
        for (let x = jointStart; x < view.right; x += 7) {
            const by = terrain.bedrockY(x);
            ctx.beginPath();
            ctx.moveTo(x * z, -by * z);
            ctx.lineTo((x + 5.5) * z, -(by - 14) * z);
            ctx.stroke();
        }

        // 2. Jordlager mellan markyta och berg
        const soilColor = ground.soilType === 'soft_clay' ? '#5A2A18' : '#3E2723';
        const slideX = ground.hasClayLayer ? env.landslideProgress * 3.5 * z : 0;
        const slideY = ground.hasClayLayer ? -env.landslideProgress * 1.8 * z : 0;
        ctx.save();
        ctx.translate(slideX, slideY);
        ctx.fillStyle = soilColor;
        ctx.beginPath();
        ctx.moveTo(profile[0].x * z, -profile[0].bedrockY * z);
        for (const p of profile) ctx.lineTo(p.x * z, -p.surfaceY * z);
        for (let i = profile.length - 1; i >= 0; i--) {
            ctx.lineTo(profile[i].x * z, -profile[i].bedrockY * z);
        }
        ctx.closePath();
        ctx.fill();

        // Gräs / markyta längs den kuperade silhuetten
        ctx.strokeStyle = ground.soilType === 'soft_clay' ? '#854D0E' : '#15803D';
        ctx.lineWidth = Math.max(3, z * 0.14);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < profile.length; i++) {
            const sx = profile[i].x * z;
            const sy = -profile[i].surfaceY * z;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // Grästuvor som följer lutningen
        if (ground.soilType !== 'soft_clay' && z > 10) {
            ctx.strokeStyle = 'rgba(22, 163, 74, 0.7)';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            for (let i = 2; i < profile.length - 2; i += 3) {
                const p = profile[i];
                const dx = profile[i + 1].x - profile[i - 1].x;
                const dy = profile[i + 1].surfaceY - profile[i - 1].surfaceY;
                const len = Math.hypot(dx, dy) || 1;
                const nx = -dy / len;
                const ny = dx / len;
                const blade = 0.55 + (i % 5) * 0.08;
                ctx.moveTo(p.x * z, -p.surfaceY * z);
                ctx.lineTo((p.x + nx * blade) * z, -(p.surfaceY + ny * blade) * z);
            }
            ctx.stroke();
        }
        ctx.restore();

        // 3. Vatten i klyftor och vattenspeglar
        this.renderWater(ctx, terrain, profile, env.time, z);

        // 4. Tunnlar – mörkt hålrum, lining och lastvarning
        this.renderTunnels(ctx, terrain, z);

        // 5. Synliga sprickor
        this.renderCracks(ctx, terrain, z);

        // 6. Geologiska etiketter i den synliga vyn
        this.renderGeologyLabels(ctx, terrain, ground, view, z);

        ctx.restore();
    }

    renderFlatGroundFallback(ctx, ground, z, deepY) {
        const left = -80 * z;
        const right = 80 * z;
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(left, -(ground.bedrockY || -6) * z, right - left, -deepY * z + 800);
        ctx.fillStyle = ground.soilType === 'soft_clay' ? '#5A2A18' : '#3E2723';
        ctx.fillRect(left, 0, right - left, -(ground.bedrockY || -6) * z);
        ctx.strokeStyle = '#15803D';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(left, 0);
        ctx.lineTo(right, 0);
        ctx.stroke();
    }

    renderDistantHills(ctx, profile, z) {
        ctx.fillStyle = '#0B1220';
        ctx.beginPath();
        ctx.moveTo(profile[0].x * z, -6 * z);
        for (const p of profile) {
            const y = 7.5 + p.surfaceY * 0.55 + Math.sin(p.x * 0.035 + 0.8) * 2.4 + Math.sin(p.x * 0.09) * 1.1;
            ctx.lineTo(p.x * z, -y * z);
        }
        ctx.lineTo(profile[profile.length - 1].x * z, 20 * z);
        ctx.lineTo(profile[0].x * z, 20 * z);
        ctx.closePath();
        ctx.fill();
    }

    renderWater(ctx, terrain, profile, time, z) {
        ctx.save();
        const segments = [];
        let run = null;
        for (const p of profile) {
            if (p.waterY != null && p.waterY > p.surfaceY + 0.05) {
                if (!run) run = [];
                run.push(p);
            } else if (run) {
                segments.push(run);
                run = null;
            }
        }
        if (run) segments.push(run);

        for (const seg of segments) {
            ctx.beginPath();
            const first = seg[0];
            ctx.moveTo(first.x * z, -first.surfaceY * z);
            for (const p of seg) ctx.lineTo(p.x * z, -p.surfaceY * z);
            for (let i = seg.length - 1; i >= 0; i--) {
                const p = seg[i];
                const wave = Math.sin(p.x * 1.15 + time * 2.4) * 0.08;
                ctx.lineTo(p.x * z, -(p.waterY + wave) * z);
            }
            ctx.closePath();
            const top = Math.max(...seg.map(p => p.waterY));
            const bot = Math.min(...seg.map(p => p.surfaceY));
            const grad = ctx.createLinearGradient(0, -top * z, 0, -bot * z);
            grad.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
            grad.addColorStop(1, 'rgba(12, 74, 110, 0.72)');
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let i = 0; i < seg.length; i++) {
                const p = seg[i];
                const wave = Math.sin(p.x * 1.15 + time * 2.4) * 0.08;
                const sx = p.x * z;
                const sy = -(p.waterY + wave) * z;
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    renderTunnels(ctx, terrain, z) {
        const nodes = this.game.physics.nodes;
        const assessments = terrain.assessTunnelLoads(nodes);
        for (const a of assessments) {
            const t = a.tunnel;
            const cx = t.x * z;
            const cy = -t.y * z;
            const rx = (t.width / 2) * z;
            const ry = (t.height / 2) * z;

            if (terrain.collapsedTunnels.has(t.id)) {
                ctx.fillStyle = 'rgba(71, 85, 105, 0.7)';
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#94A3B8';
                ctx.font = `${Math.max(10, z * 0.45)}px monospace`;
                ctx.textAlign = 'center';
                ctx.fillText('RASAD TUNNEL', cx, cy);
                continue;
            }

            ctx.fillStyle = '#020617';
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#475569';
            ctx.lineWidth = Math.max(2, z * 0.12);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo((t.x - t.width * 0.32) * z, -(t.y - t.height * 0.18) * z);
            ctx.lineTo((t.x + t.width * 0.32) * z, -(t.y - t.height * 0.18) * z);
            ctx.stroke();

            const util = a.utilization;
            let color = '#38BDF8';
            if (util > 1) color = '#EF4444';
            else if (util > 0.7) color = '#F59E0B';
            ctx.fillStyle = color;
            ctx.font = `${Math.max(10, z * 0.42)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(`🚇 ${t.name || 'TUNNEL'}`, cx, cy - ry - 8);
            ctx.fillText(`täckning ${a.cover.toFixed(1)}m · last ${Math.round(util * 100)}%`, cx, cy - ry + 8);
        }
    }

    renderCracks(ctx, terrain, z) {
        ctx.save();
        for (const crack of terrain.cracks) {
            const poly = terrain.crackPolygon(crack);
            ctx.fillStyle = '#020617';
            ctx.beginPath();
            ctx.moveTo((crack.x - poly.topHalf) * z, -poly.topY * z);
            ctx.lineTo((crack.x + poly.topHalf) * z, -poly.topY * z);
            ctx.lineTo((crack.x + poly.botHalf) * z, -poly.botY * z);
            ctx.lineTo((crack.x - poly.botHalf) * z, -poly.botY * z);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#7F1D1D';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.fillStyle = '#F87171';
            ctx.font = `${Math.max(9, z * 0.38)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText('SPRICKA', crack.x * z, -(poly.topY + 0.6) * z);
        }
        ctx.restore();
    }

    renderGeologyLabels(ctx, terrain, ground, view, z) {
        ctx.save();
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        const labelX = Math.max(view.left + 1.5, (ground.leftX ?? -10));
        const surf = terrain.surfaceY(labelX);
        const rock = terrain.bedrockY(labelX);
        const midSoil = (surf + rock) / 2;
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(`⛰️ URBERG (${rock.toFixed(1)} m)`, labelX * z, -rock * z + 16);
        ctx.fillStyle = ground.soilType === 'soft_clay' ? '#FBBF24' : '#86EFAC';
        ctx.fillText(`🌱 ${SOIL_TYPES[ground.soilType || 'stiff_soil'].name.toUpperCase()}`, labelX * z, -midSoil * z);
        ctx.restore();
    }

    renderGrid(ctx) {
        const step = this.gridSize * this.zoom;
        const view = this.visibleWorldBounds(4);
        const minX = view.left * this.zoom;
        const maxX = view.right * this.zoom;
        const minY = -view.top * this.zoom;
        const maxY = -view.bottom * this.zoom;

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        const x0 = Math.floor(view.left) * this.zoom;
        const y0 = Math.floor(view.bottom) * this.zoom;
        for (let x = x0; x <= maxX; x += step) {
            ctx.moveTo(x, minY);
            ctx.lineTo(x, maxY);
        }
        for (let y = y0; y <= view.top * this.zoom + step; y += step) {
            ctx.moveTo(minX, -y);
            ctx.lineTo(maxX, -y);
        }
        ctx.stroke();
    }

    renderFacades(ctx) {
        const state = this.game.gameState;
        if (state === 'build') return; // Ren stomme under bygge

        const rooms = this.game.claddingRooms?.length
            ? this.game.claddingRooms
            : this.game.physics.getFacadeBays(this.game.resolveFacadeStyle?.() || 'glass');
        if (!rooms.length) return;

        const globalProgress = state === 'cladding'
            ? this.game.facadeProgress
            : 1;

        for (let i = 0; i < rooms.length; i++) {
            const room = rooms[i];
            const local = this.facadeBayProgress(i, rooms.length, globalProgress);
            if (local <= 0.01) continue;
            this.drawFacadeBay(ctx, room, local, room.style || 'glass');
        }
    }

    facadeBayProgress(index, total, globalProgress) {
        if (globalProgress >= 1) return 1;
        if (total <= 0) return globalProgress;
        const start = index / (total + 0.35);
        const end = (index + 1) / (total + 0.35);
        return Math.max(0, Math.min(1, (globalProgress - start) / Math.max(0.08, end - start)));
    }

    drawFacadeBay(ctx, room, progress, style) {
        const z = this.zoom;
        const x1 = room.leftX * z;
        const x2 = room.rightX * z;
        const y1 = -room.bottomY * z;
        const y2 = -room.topY * z;
        const w = x2 - x1;
        const h = y1 - y2;
        if (w < 2 || h < 2) return;

        // Montering: paneler växer uppåt från bjälklaget
        const mountH = h * progress;
        const clipTop = y1 - mountH;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x1, clipTop, w, mountH);
        ctx.clip();

        const palette = this.facadePalette(style);

        // Huvudfasadytan
        const wallGrad = ctx.createLinearGradient(x1, y2, x2, y1);
        wallGrad.addColorStop(0, palette.wallA);
        wallGrad.addColorStop(1, palette.wallB);
        ctx.fillStyle = wallGrad;
        ctx.fillRect(x1, y2, w, h);

        // Materialtextur
        if (style === 'brick') {
            this.drawBrickPattern(ctx, x1, y2, w, h, palette);
        } else if (style === 'wood') {
            this.drawWoodCladding(ctx, x1, y2, w, h, palette);
        }

        // Fönsterband
        const insetX = Math.max(4, w * 0.12);
        const insetY = Math.max(4, h * 0.18);
        const winX = x1 + insetX;
        const winY = y2 + insetY;
        const winW = w - insetX * 2;
        const winH = h - insetY * 2;

        if (winW > 6 && winH > 6) {
            const glass = ctx.createLinearGradient(winX, winY, winX + winW, winY + winH);
            glass.addColorStop(0, palette.glassA);
            glass.addColorStop(0.55, palette.glassB);
            glass.addColorStop(1, palette.glassC);
            ctx.fillStyle = glass;
            ctx.fillRect(winX, winY, winW, winH);

            ctx.strokeStyle = palette.mullion;
            ctx.lineWidth = Math.max(1.5, z * 0.06);
            ctx.strokeRect(winX, winY, winW, winH);

            // Sprossar / fönsterposter
            const panes = style === 'curtain' ? 3 : 2;
            ctx.beginPath();
            for (let p = 1; p < panes; p++) {
                const px = winX + (winW * p) / panes;
                ctx.moveTo(px, winY);
                ctx.lineTo(px, winY + winH);
            }
            ctx.moveTo(winX, winY + winH * 0.45);
            ctx.lineTo(winX + winW, winY + winH * 0.45);
            ctx.stroke();

            // Inomhusljus
            ctx.fillStyle = `rgba(253, 230, 138, ${0.18 + 0.22 * progress})`;
            ctx.fillRect(winX + winW * 0.15, winY + winH * 0.2, winW * 0.28, winH * 0.22);
        }

        // Yttre karm / panelram
        ctx.strokeStyle = palette.frame;
        ctx.lineWidth = Math.max(2, z * 0.08);
        ctx.strokeRect(x1 + 1, y2 + 1, w - 2, h - 2);

        // Montageglans under pågående montering
        if (progress < 0.999) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.12 * (1 - progress)})`;
            ctx.fillRect(x1, clipTop, w, Math.max(2, z * 0.15));
        }

        ctx.restore();
    }

    facadePalette(style) {
        if (style === 'brick') {
            return {
                wallA: 'rgba(146, 64, 14, 0.92)',
                wallB: 'rgba(120, 53, 15, 0.95)',
                glassA: 'rgba(125, 211, 252, 0.35)',
                glassB: 'rgba(56, 189, 248, 0.22)',
                glassC: 'rgba(14, 116, 144, 0.28)',
                mullion: 'rgba(69, 26, 3, 0.9)',
                frame: 'rgba(69, 26, 3, 0.95)'
            };
        }
        if (style === 'wood') {
            return {
                wallA: 'rgba(180, 83, 9, 0.9)',
                wallB: 'rgba(146, 64, 14, 0.92)',
                glassA: 'rgba(186, 230, 253, 0.4)',
                glassB: 'rgba(125, 211, 252, 0.28)',
                glassC: 'rgba(14, 116, 144, 0.25)',
                mullion: 'rgba(120, 53, 15, 0.95)',
                frame: 'rgba(69, 26, 3, 0.9)'
            };
        }
        if (style === 'curtain') {
            return {
                wallA: 'rgba(30, 41, 59, 0.88)',
                wallB: 'rgba(51, 65, 85, 0.9)',
                glassA: 'rgba(56, 189, 248, 0.45)',
                glassB: 'rgba(14, 165, 233, 0.28)',
                glassC: 'rgba(12, 74, 110, 0.4)',
                mullion: 'rgba(226, 232, 240, 0.55)',
                frame: 'rgba(148, 163, 184, 0.85)'
            };
        }
        return {
            wallA: 'rgba(71, 85, 105, 0.85)',
            wallB: 'rgba(51, 65, 85, 0.9)',
            glassA: 'rgba(125, 211, 252, 0.42)',
            glassB: 'rgba(56, 189, 248, 0.25)',
            glassC: 'rgba(8, 47, 73, 0.35)',
            mullion: 'rgba(226, 232, 240, 0.5)',
            frame: 'rgba(148, 163, 184, 0.8)'
        };
    }

    drawBrickPattern(ctx, x, y, w, h, palette) {
        ctx.strokeStyle = 'rgba(69, 26, 3, 0.35)';
        ctx.lineWidth = 1;
        const brickH = Math.max(4, h / 8);
        const brickW = brickH * 2.2;
        ctx.beginPath();
        for (let row = 0; row < h / brickH; row++) {
            const oy = y + row * brickH;
            const offset = row % 2 === 0 ? 0 : brickW * 0.5;
            ctx.moveTo(x, oy);
            ctx.lineTo(x + w, oy);
            for (let col = -1; col < w / brickW + 1; col++) {
                const ox = x + offset + col * brickW;
                ctx.moveTo(ox, oy);
                ctx.lineTo(ox, oy + brickH);
            }
        }
        ctx.stroke();
    }

    drawWoodCladding(ctx, x, y, w, h, palette) {
        ctx.strokeStyle = 'rgba(69, 26, 3, 0.28)';
        ctx.lineWidth = 1;
        const board = Math.max(5, h / 7);
        ctx.beginPath();
        for (let i = 1; i < h / board; i++) {
            const oy = y + i * board;
            ctx.moveTo(x, oy);
            ctx.lineTo(x + w, oy);
        }
        ctx.stroke();
    }

    worldToScreenOffset(node) {
        return {
            x: node.x * this.zoom,
            y: -node.y * this.zoom
        };
    }

    renderMembers(ctx) {
        for (const m of this.game.physics.members) {
            if (m.isBroken) continue;

            const x1 = m.nodeA.x * this.zoom;
            const y1 = -m.nodeA.y * this.zoom;
            const x2 = m.nodeB.x * this.zoom;
            const y2 = -m.nodeB.y * this.zoom;

            const mat = m.material;
            const isHovered = this.hoverMember === m;
            const isInspected = this.inspectedMember === m;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);

            let strokeColor = mat.color;
            let lineWidth = Math.max(3, (mat.thickness / 100) * this.zoom);

            // Spänningskarta (Heatmap)
            if (this.isHeatmapActive && (this.game.gameState === 'simulate' || this.game.gameState === 'test' || m.stressRatio > 0.3)) {
                const ratio = m.stressRatio;
                if (ratio > 0.92) {
                    strokeColor = '#EF4444'; // Röd (Kritisk)
                    // Pulsera vid extrem överbelastning
                    lineWidth += Math.sin(Date.now() * 0.015) * 2;
                } else if (ratio > 0.75) {
                    strokeColor = '#F97316'; // Orange
                } else if (ratio > 0.50) {
                    strokeColor = '#EAB308'; // Gul
                } else if (ratio > 0.25) {
                    strokeColor = '#22C55E'; // Grön
                } else {
                    strokeColor = '#06B6D4'; // Cyan / Låg spänning
                }
            }

            if (isInspected || isHovered) {
                ctx.shadowColor = '#38BDF8';
                ctx.shadowBlur = 10;
            }

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';

            if (mat.isStrut) {
                ctx.setLineDash([6, 3]); // Fackverkssträva med streckad linje
            }

            ctx.stroke();
            ctx.restore();
        }
    }

    renderNodes(ctx) {
        for (const n of this.game.physics.nodes) {
            const sx = n.x * this.zoom;
            const sy = -n.y * this.zoom;
            const isHover = this.hoverNode === n;

            ctx.save();
            ctx.beginPath();
            ctx.arc(sx, sy, isHover ? 7 : 4.5, 0, Math.PI * 2);

            if (n.fixed) {
                ctx.fillStyle = '#E11D48'; // Röd förankrad bergnod
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
            } else if (n.soilType === 'soft_clay') {
                ctx.fillStyle = '#D97706'; // Marknod i lera
                ctx.strokeStyle = '#78350F';
                ctx.lineWidth = 1.5;
            } else {
                ctx.fillStyle = isHover ? '#38BDF8' : '#F8FAFC';
                ctx.strokeStyle = '#0F172A';
                ctx.lineWidth = 1.5;
            }

            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }

    renderDebris(ctx) {
        // Rasrester / Knäckta balkar
        for (const d of this.game.physics.debris) {
            const sx = d.x * this.zoom;
            const sy = -d.y * this.zoom;
            const len = (d.length * this.zoom) * 0.45;

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(-d.angle);
            ctx.strokeStyle = d.material.color;
            ctx.lineWidth = Math.max(3, (d.material.thickness / 100) * this.zoom);
            ctx.beginPath();
            ctx.moveTo(-len, 0);
            ctx.lineTo(len, 0);
            ctx.stroke();
            ctx.restore();
        }

        // Partiklar
        for (const p of this.game.physics.particles) {
            const sx = p.x * this.zoom;
            const sy = -p.y * this.zoom;
            ctx.fillStyle = p.type === 'spark' ? '#FACC15' : p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(sx, sy, p.size * this.zoom, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    renderBuildPreview(ctx) {
        if (!this.isInteracting || !this.dragStartNode || this.game.gameState !== 'build') return;

        const startX = this.dragStartNode.x * this.zoom;
        const startY = -this.dragStartNode.y * this.zoom;

        const world = this.currentPointerWorld;
        const nearest = this.game.physics.findNearestNode(world.x, world.y, this.snapRadius);
        const targetPos = nearest ? nearest : this.snapToGrid(world);

        const endX = targetPos.x * this.zoom;
        const endY = -targetPos.y * this.zoom;

        const dx = targetPos.x - this.dragStartNode.x;
        const dy = targetPos.y - this.dragStartNode.y;
        const lengthM = Math.hypot(dx, dy);
        const angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(0);

        const mat = MATERIALS[this.selectedMaterial] || MATERIALS.wood;
        const isTooLong = lengthM > mat.maxSpan;

        // Snäppindikator
        ctx.save();
        ctx.strokeStyle = isTooLong ? '#EF4444' : '#38BDF8';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Mått- och vinkel-tooltip
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const costEst = Math.round(lengthM * mat.costPerMeter);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = isTooLong ? '#EF4444' : '#38BDF8';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.roundRect(midX - 45, midY - 24, 90, 28, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = '10px monospace';
        ctx.fillStyle = isTooLong ? '#F87171' : '#E2E8F0';
        ctx.textAlign = 'center';
        ctx.fillText(`${lengthM.toFixed(1)}m | ${angleDeg}°`, midX, midY - 11);
        ctx.fillStyle = '#38BDF8';
        ctx.fillText(`${costEst.toLocaleString('sv-SE')} kr`, midX, midY + 1);

        ctx.restore();
    }

    renderHeightRuler(ctx) {
        const lvl = this.game.currentLevel;
        const targetHeight = lvl ? lvl.targetHeight : 0;
        const currentHeight = this.game.physics.stats.buildingHeight;
        const peakWorldY = this.game.physics.stats.peakWorldY ?? currentHeight;

        const rulerX = -32 * this.zoom;
        const maxH = Math.max(targetHeight + 10, currentHeight + 10, 20);

        ctx.save();
        ctx.font = '10px monospace';
        ctx.fillStyle = '#64748B';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;

        // Skala med 5m intervall
        for (let h = 0; h <= maxH; h += 5) {
            const y = -h * this.zoom;
            ctx.beginPath();
            ctx.moveTo(rulerX - 8, y);
            ctx.lineTo(rulerX, y);
            ctx.stroke();
            ctx.fillText(`${h}m`, rulerX - 28, y + 3);
        }

        // Målhöjdslinje
        if (targetHeight > 0) {
            const targetY = -targetHeight * this.zoom;
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(-35 * this.zoom, targetY);
            ctx.lineTo(35 * this.zoom, targetY);
            ctx.stroke();

            ctx.fillStyle = '#F59E0B';
            ctx.fillText(`🚩 MÅLHÖJD: ${targetHeight}m`, rulerX + 15, targetY - 5);
        }

        // Aktuell topphöjdslinje
        if (currentHeight > 0.5) {
            const curY = -peakWorldY * this.zoom;
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(-35 * this.zoom, curY);
            ctx.lineTo(35 * this.zoom, curY);
            ctx.stroke();

            ctx.fillStyle = '#38BDF8';
            ctx.fillText(`📐 TOPP: ${currentHeight}m`, rulerX + 15, curY - 5);
        }

        ctx.restore();
    }

    renderWeatherParticles(ctx) {
        const env = this.game.environment;

        // Regn
        if (env.rainIntensity > 0) {
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (const drop of env.rainDrops) {
                const sx = drop.x * this.zoom;
                const sy = -drop.y * this.zoom;
                const len = drop.length * this.zoom;
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + env.windSpeed * 0.15 * this.zoom, sy + len);
            }
            ctx.stroke();
        }

        // Vindstråk
        if (env.windSpeed > 5) {
            for (const streak of env.windStreaks) {
                const sx = streak.x * this.zoom;
                const sy = -streak.y * this.zoom;
                const len = streak.length * this.zoom;

                ctx.strokeStyle = `rgba(255, 255, 255, ${streak.alpha})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.bezierCurveTo(sx + len * 0.3, sy - 8, sx + len * 0.7, sy + 8, sx + len, sy);
                ctx.stroke();
            }
        }
    }
}
