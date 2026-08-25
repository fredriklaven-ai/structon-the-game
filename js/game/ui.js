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
        this.minZoom = 8;
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
            // Om under mark, kolla om det är grund
            const isGround = snapped.y <= 0;
            const node = this.game.physics.addNode(snapped.x, snapped.y, false);
            if (isGround) {
                node.soilType = this.game.currentLevel ? this.game.currentLevel.ground.soilType : 'stiff_soil';
            }
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
                    if (snapped.y <= 0) {
                        endNode.soilType = this.game.currentLevel ? this.game.currentLevel.ground.soilType : 'stiff_soil';
                    }
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
        } else {
            this.inspectedMember = null;
            const card = document.getElementById('inspection-card');
            if (card) card.style.display = 'none';
        }
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
            nodes: this.game.physics.nodes.map(n => ({ x: n.x, y: n.y, fixed: n.fixed, soilType: n.soilType, id: n.id })),
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

        // 4. Rendera rum och inredda våningsplan (fönster, belysning)
        this.renderRooms(ctx);

        // 5. Rendera balkar, pelare och bärverkselement
        this.renderMembers(ctx);

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
        const lvl = this.game.currentLevel;
        const ground = lvl ? lvl.ground : { leftX: -30, rightX: 30, surfaceY: 0, bedrockY: -6, soilType: 'stiff_soil' };
        const env = this.game.environment;

        const leftX = ground.leftX * this.zoom;
        const rightX = ground.rightX * this.zoom;
        const topY = -ground.surfaceY * this.zoom;
        const bedrockY = -ground.bedrockY * this.zoom;
        const bottomY = 500; // djupt ner

        // Jordskredsoffset
        const slideX = env.landslideProgress * 3.5 * this.zoom;
        const slideY = -env.landslideProgress * 1.8 * this.zoom;

        // 1. Berggrund (fast berg)
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.rect(leftX - 200, bedrockY, (rightX - leftX) + 400, bottomY);
        ctx.fill();

        // Bergstexturmönster
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        for (let x = leftX - 100; x < rightX + 100; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, bedrockY);
            ctx.lineTo(x + 25, bottomY);
            ctx.stroke();
        }

        // 2. Jordlager (Morän eller Känslig lera)
        ctx.save();
        if (ground.hasClayLayer && env.landslideProgress > 0) {
            ctx.translate(slideX, slideY);
        }

        ctx.fillStyle = ground.soilType === 'soft_clay' ? '#5A2A18' : '#3E2723';
        ctx.beginPath();
        ctx.moveTo(leftX - 100, bedrockY);
        ctx.lineTo(leftX - 100, topY);

        if (ground.slopeAngle && ground.slopeAngle !== 0) {
            ctx.lineTo(rightX + 100, topY + (rightX - leftX) * 0.08);
        } else {
            ctx.lineTo(rightX + 100, topY);
        }

        ctx.lineTo(rightX + 100, bedrockY);
        ctx.closePath();
        ctx.fill();

        // Markyta (Gräs / Grus)
        ctx.strokeStyle = ground.soilType === 'soft_clay' ? '#854D0E' : '#15803D';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(leftX - 100, topY);
        if (ground.slopeAngle && ground.slopeAngle !== 0) {
            ctx.lineTo(rightX + 100, topY + (rightX - leftX) * 0.08);
        } else {
            ctx.lineTo(rightX + 100, topY);
        }
        ctx.stroke();

        ctx.restore();

        // Textetiketter för geologiska lager
        ctx.font = '11px monospace';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(`⛰️ FAST URBERG (${ground.bedrockY}m)`, leftX + 10, bedrockY + 22);
        ctx.fillText(`🌱 ${SOIL_TYPES[ground.soilType || 'stiff_soil'].name.toUpperCase()}`, leftX + 10, topY + 25);
    }

    renderGrid(ctx) {
        const step = this.gridSize * this.zoom;
        const minX = -40 * this.zoom;
        const maxX = 40 * this.zoom;
        const minY = -120 * this.zoom;
        const maxY = 15 * this.zoom;

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let x = minX; x <= maxX; x += step) {
            ctx.moveTo(x, minY);
            ctx.lineTo(x, maxY);
        }
        for (let y = minY; y <= maxY; y += step) {
            ctx.moveTo(minX, y);
            ctx.lineTo(maxX, y);
        }
        ctx.stroke();

        // Marklinje (Y = 0)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(minX, 0);
        ctx.lineTo(maxX, 0);
        ctx.stroke();
    }

    renderRooms(ctx) {
        const rooms = this.game.physics.detectRooms();
        for (const room of rooms) {
            const p1 = this.worldToScreenOffset(room.bottomA);
            const p2 = this.worldToScreenOffset(room.bottomB);
            const p3 = this.worldToScreenOffset(room.topB);
            const p4 = this.worldToScreenOffset(room.topA);

            // Glasfasad med subtil belysning
            ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            ctx.fill();

            // Fönsterposter
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Varm rumsbelysning i fönstren
            const midX = (p1.x + p2.x + p3.x + p4.x) / 4;
            const midY = (p1.y + p2.y + p3.y + p4.y) / 4;
            ctx.fillStyle = 'rgba(253, 230, 138, 0.25)';
            ctx.beginPath();
            ctx.arc(midX, midY, 6, 0, Math.PI * 2);
            ctx.fill();
        }
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
            const curY = -currentHeight * this.zoom;
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
