/**
 * STRUCTON THE GAME - Terräng- och geologimotor
 * Proceduriell, deterministisk markyta och berggrund med klyftor, vatten,
 * bergssprickor och tunnlar. Bergtäckning över tunneln bär huslasten tills
 * täckningen/spännvidden inte längre räcker.
 */

import { SOIL_TYPES, getSoil, resolveSoilId } from './materials.js';

const ROCK_ALLOWABLE_STRESS = 3.5e6; // Pa, sprickigt urberg med säkerhetsfaktor
const ROCK_DENSITY = 2700;           // kg/m³
const SOIL_DENSITY = 1800;           // kg/m³
const TRIBUTARY_BREADTH = 6.0;       // m "in i skärmen" för 2D → 3D last
const GRAVITY = 9.81;

/** Standardlagerstackar – andelar från ytan ned mot berg. */
const DEFAULT_LAYER_PLANS = {
    gravel: [
        { type: 'gravel', share: 0.55 },
        { type: 'sand', share: 0.25 },
        { type: 'moraine', share: 0.20 }
    ],
    sand: [
        { type: 'sand', share: 0.45 },
        { type: 'gravel', share: 0.15 },
        { type: 'moraine', share: 0.40 }
    ],
    moraine: [
        { type: 'gravel', share: 0.12 },
        { type: 'sand', share: 0.18 },
        { type: 'moraine', share: 0.70 }
    ],
    stiff_soil: [
        { type: 'gravel', share: 0.12 },
        { type: 'sand', share: 0.18 },
        { type: 'moraine', share: 0.70 }
    ],
    stiff_clay: [
        { type: 'sand', share: 0.12 },
        { type: 'stiff_clay', share: 0.48 },
        { type: 'moraine', share: 0.40 }
    ],
    soft_clay: [
        { type: 'sand', share: 0.08 },
        { type: 'soft_clay', share: 0.52 },
        { type: 'stiff_clay', share: 0.22 },
        { type: 'moraine', share: 0.18 }
    ],
    wet_soft_clay: [
        { type: 'sand', share: 0.06 },
        { type: 'wet_soft_clay', share: 0.48 },
        { type: 'soft_clay', share: 0.24 },
        { type: 'stiff_clay', share: 0.12 },
        { type: 'moraine', share: 0.10 }
    ]
};

export class TerrainEngine {
    constructor(ground = {}) {
        this.seed = ground.seed ?? 42;
        this.soilType = resolveSoilId(ground.soilType || 'moraine');
        this.baseSurfaceY = ground.surfaceY ?? 0;
        this.baseBedrockY = ground.bedrockY ?? -4;
        this.slopeAngle = ground.slopeAngle ?? 0;
        this.surfaceAmp = ground.surfaceAmp ?? 2.2;
        this.bedrockAmp = ground.bedrockAmp ?? 2.8;
        this.ravines = ground.ravines || [];
        this.cracks = ground.cracks || [];
        this.tunnels = (ground.tunnels || []).map((t, i) => ({ ...t, id: t.id || `tunnel_${i}` }));
        this.waterBodies = ground.waterBodies || [];
        this.hasClayLayer = !!ground.hasClayLayer
            || this.soilType === 'soft_clay'
            || this.soilType === 'wet_soft_clay';
        this.layerPlan = this._normalizeLayerPlan(ground.soilLayers, this.soilType);
        this.clayNearWater = ground.clayNearWater || (this.hasClayLayer
            ? { maxDist: 22, wetType: 'wet_soft_clay', softType: 'soft_clay', strength: 0.7 }
            : null);
        this.collapsedTunnels = new Set();
        this.onTunnelCollapse = null;
        this._embedTunnelsInRock();
    }

    _normalizeLayerPlan(layers, soilType) {
        if (Array.isArray(layers) && layers.length > 0) {
            const cleaned = layers
                .map(l => ({
                    type: resolveSoilId(l.type || l.soil || soilType),
                    share: Math.max(0.01, Number(l.share) || Number(l.fraction) || 0.1)
                }))
                .filter(l => l.type !== 'bedrock');
            if (cleaned.length) return cleaned;
        }
        return (DEFAULT_LAYER_PLANS[soilType] || DEFAULT_LAYER_PLANS.moraine).map(l => ({ ...l }));
    }

    _embedTunnelsInRock() {
        for (const t of this.tunnels) {
            if (t.embedInRock === false) continue;
            const rockTop = this.bedrockY(t.x);
            const desiredCover = t.cover ?? Math.max(1.6, t.width * 0.22);
            t.y = rockTop - desiredCover - t.height / 2;
        }
    }

    resetRuntime() {
        this.collapsedTunnels.clear();
        for (const t of this.tunnels) {
            t.collapsed = false;
        }
    }

    hash01(i) {
        const n = Math.sin(i * 127.1 + this.seed * 311.7) * 43758.5453;
        return n - Math.floor(n);
    }

    smoothNoise(x) {
        const i = Math.floor(x);
        const f = x - i;
        const u = f * f * (3 - 2 * f);
        return this.hash01(i) * (1 - u) + this.hash01(i + 1) * u;
    }

    fbm(x, octaves = 4) {
        let v = 0;
        let amp = 1;
        let freq = 1;
        let sum = 0;
        for (let o = 0; o < octaves; o++) {
            v += this.smoothNoise(x * freq + this.seed * 0.13 + o * 19.7) * amp;
            sum += amp;
            amp *= 0.5;
            freq *= 2.07;
        }
        return v / sum;
    }

    _slope(x) {
        return Math.tan((this.slopeAngle * Math.PI) / 180) * x;
    }

    _rawSurface(x) {
        const n = (this.fbm(x * 0.042, 5) - 0.5) * 2;
        const hills = Math.sin(x * 0.055 + this.seed * 0.4) * 1.05
            + Math.sin(x * 0.023 + 1.7) * 1.45
            + Math.sin(x * 0.11 + 0.6) * 0.45;
        let y = this.baseSurfaceY + this._slope(x) + n * this.surfaceAmp + hills * (this.surfaceAmp * 0.55);

        for (const r of this.ravines) {
            y -= this._depression(x, r.x, r.width, r.depth, r.steepness ?? 1.55);
        }
        for (const c of this.cracks) {
            if (c.openAtSurface) {
                y -= this._depression(x, c.x, c.width ?? 1.2, Math.min(c.depth ?? 6, 4.5), 0.7);
            }
        }
        for (const id of this.collapsedTunnels) {
            const t = this.tunnels.find(tn => tn.id === id);
            if (!t) continue;
            const sink = Math.max(1.2, (t.height || 4) * 0.45);
            y -= this._depression(x, t.x, t.width * 1.15, sink, 1.2);
        }
        return y;
    }

    _rawBedrock(x) {
        const n = (this.fbm(x * 0.027 + 40, 5) - 0.5) * 2;
        const jagged = Math.sin(x * 0.14 + this.seed * 2.1) * 0.62
            + Math.sin(x * 0.33 + 0.4) * 0.32
            + Math.sin(x * 0.61 + 2.2) * 0.16;
        let y = this.baseBedrockY + this._slope(x) * 0.55 + n * this.bedrockAmp + jagged * this.bedrockAmp;

        for (const r of this.ravines) {
            if (r.cutsRock) {
                const rockDepth = r.rockDepth ?? r.depth * 0.55;
                y -= this._depression(x, r.x, r.width * 0.92, rockDepth, r.steepness ?? 1.55);
            }
        }
        for (const c of this.cracks) {
            y -= this._depression(x, c.x, (c.width ?? 0.9) * 1.1, c.depth ?? 6, 0.55);
        }
        return y;
    }

    _depression(x, cx, width, depth, steepness) {
        const half = Math.max(0.05, width / 2);
        const d = Math.abs(x - cx);
        if (d >= half) return 0;
        const t = d / half;
        return depth * Math.pow(Math.cos((t * Math.PI) / 2), steepness);
    }

    surfaceY(x) {
        return this._rawSurface(x) - this._rawSurface(0) + this.baseSurfaceY;
    }

    bedrockY(x) {
        const raw = this._rawBedrock(x) - this._rawSurface(0) + this.baseSurfaceY;
        return Math.min(raw, this.surfaceY(x) - 0.12);
    }

    soilThickness(x) {
        return Math.max(0, this.surfaceY(x) - this.bedrockY(x));
    }

    /** Marklutning dy/dx (positiv = stiger åt höger). */
    surfaceSlope(x, dx = 0.55) {
        return (this.surfaceY(x + dx) - this.surfaceY(x - dx)) / (2 * dx);
    }

    /** Avstånd till närmaste vattenyta (klyfta/vatten). */
    distanceToWater(x) {
        let best = Infinity;
        for (const w of this.waterBodies) {
            const edge = Math.abs(x - w.x) - w.width / 2;
            best = Math.min(best, Math.max(0, edge));
        }
        for (const r of this.ravines) {
            if (!r.water) continue;
            const edge = Math.abs(x - r.x) - r.width / 2;
            best = Math.min(best, Math.max(0, edge));
        }
        return best;
    }

    /** 0 = långt från vatten, 1 = i/vid vatten. */
    waterProximity(x, maxDist = 22) {
        const d = this.distanceToWater(x);
        if (!Number.isFinite(d)) return 0;
        return Math.max(0, Math.min(1, 1 - d / Math.max(1, maxDist)));
    }

    /**
     * Lagerandelar vid x – brusvarierade, med lerförstärkning mot vatten.
     */
    layerSharesAt(x) {
        const plan = this.layerPlan.map(l => ({ type: l.type, share: l.share }));
        const n = plan.length;
        for (let i = 0; i < n; i++) {
            const wobble = (this.fbm(x * 0.031 + i * 7.3 + this.seed * 0.07, 3) - 0.5) * 0.28;
            plan[i].share = Math.max(0.04, plan[i].share * (1 + wobble));
        }

        const proxCfg = this.clayNearWater;
        if (proxCfg) {
            const maxDist = proxCfg.maxDist ?? 22;
            const prox = this.waterProximity(x, maxDist);
            const strength = (proxCfg.strength ?? 0.65) * prox;
            if (strength > 0.02) {
                const wetType = resolveSoilId(proxCfg.wetType || 'wet_soft_clay');
                const softType = resolveSoilId(proxCfg.softType || 'soft_clay');
                // Nära vatten: mer blöt/lös lera upptill, mindre morän/grus
                let clayBoost = strength * 0.55;
                for (const layer of plan) {
                    if (layer.type === 'moraine' || layer.type === 'gravel') {
                        const take = Math.min(layer.share * 0.65, clayBoost);
                        layer.share -= take;
                        clayBoost -= take;
                    }
                }
                const clayShare = strength * 0.5 + (0.55 - clayBoost);
                const preferWet = prox > 0.45;
                const clayType = preferWet ? wetType : softType;
                const existing = plan.find(l => l.type === clayType || l.type === softType || l.type === wetType);
                if (existing) {
                    existing.type = clayType;
                    existing.share += clayShare;
                } else {
                    plan.splice(Math.min(1, plan.length), 0, { type: clayType, share: Math.max(0.12, clayShare) });
                }
            }
        }

        const sum = plan.reduce((s, l) => s + l.share, 0) || 1;
        return plan.map(l => ({ type: l.type, share: l.share / sum }));
    }

    /**
     * Stratigrafi vid x: lager från markyta ned till berg.
     * @returns {{ type: string, topY: number, bottomY: number, thickness: number }[]}
     */
    soilColumnAt(x) {
        const surf = this.surfaceY(x);
        const rock = this.bedrockY(x);
        const total = Math.max(0.08, surf - rock);
        const shares = this.layerSharesAt(x);
        const column = [];
        let y = surf;
        for (let i = 0; i < shares.length; i++) {
            const isLast = i === shares.length - 1;
            const th = isLast ? (y - rock) : total * shares[i].share;
            const topY = y;
            const bottomY = isLast ? rock : y - th;
            column.push({
                type: shares[i].type,
                topY,
                bottomY,
                thickness: Math.max(0, topY - bottomY)
            });
            y = bottomY;
        }
        return column;
    }

    surfaceSoilId(x) {
        const col = this.soilColumnAt(x);
        return col.length ? col[0].type : this.soilType;
    }

    soilThicknessOf(type, x) {
        const id = resolveSoilId(type);
        return this.soilColumnAt(x)
            .filter(l => l.type === id)
            .reduce((s, l) => s + l.thickness, 0);
    }

    /**
     * Lokal skredfara 0–1: jordart × brantlutning × närhet till vatten.
     */
    landslideHazardAt(x) {
        const col = this.soilColumnAt(x);
        const upper = col.slice(0, Math.min(2, col.length));
        let soilRisk = 0;
        let w = 0;
        for (const layer of upper) {
            const soil = getSoil(layer.type);
            soilRisk += soil.landslideRisk * layer.thickness;
            w += layer.thickness;
        }
        soilRisk = w > 0 ? soilRisk / w : getSoil(this.soilType).landslideRisk;

        const slope = Math.abs(this.surfaceSlope(x));
        // ~0.18 ≈ 10°, ~0.45 ≈ 24°
        const steep = Math.max(0, Math.min(1, (slope - 0.08) / 0.38));
        const prox = this.waterProximity(x, this.clayNearWater?.maxDist ?? 24);
        // Brant + vatten väger tungt; lös lera utan lutning ger måttlig risk
        return Math.max(0, Math.min(1,
            soilRisk * (0.28 + 0.72 * steep) * (0.35 + 0.65 * Math.max(steep, prox))
        ));
    }

    maxLandslideHazard(sampleLeft = -40, sampleRight = 40, dx = 2) {
        let maxH = 0;
        for (let x = sampleLeft; x <= sampleRight; x += dx) {
            maxH = Math.max(maxH, this.landslideHazardAt(x));
        }
        return maxH;
    }

    soilAt(x, y) {
        if (y < this.bedrockY(x) - 0.02) return SOIL_TYPES.bedrock;
        const surf = this.surfaceY(x);
        if (y > surf + 0.35) return getSoil(this.surfaceSoilId(x));
        const column = this.soilColumnAt(x);
        for (const layer of column) {
            if (y <= layer.topY + 1e-4 && y >= layer.bottomY - 1e-4) {
                return getSoil(layer.type);
            }
        }
        if (y <= this.bedrockY(x)) return SOIL_TYPES.bedrock;
        return getSoil(this.surfaceSoilId(x));
    }

    waterSurfaceY(x) {
        for (const w of this.waterBodies) {
            if (x >= w.x - w.width / 2 && x <= w.x + w.width / 2) {
                return w.surfaceY;
            }
        }
        for (const r of this.ravines) {
            if (!r.water) continue;
            if (Math.abs(x - r.x) >= r.width / 2) continue;
            const floor = this.surfaceY(x);
            const waterY = r.waterLevel ?? (this.surfaceY(r.x) + r.depth * 0.55);
            if (floor < waterY - 0.05) return waterY;
        }
        return null;
    }

    tunnelRoofY(tunnel, x) {
        return this._tunnelY(tunnel, x, 1);
    }

    tunnelFloorY(tunnel, x) {
        return this._tunnelY(tunnel, x, -1);
    }

    _tunnelY(tunnel, x, sign) {
        const halfW = tunnel.width / 2;
        const dx = x - tunnel.x;
        if (Math.abs(dx) > halfW) return null;
        const term = 1 - (dx / halfW) ** 2;
        if (term < 0) return null;
        const dy = (tunnel.height / 2) * Math.sqrt(term);
        return tunnel.y + sign * dy;
    }

    isInsideTunnel(tunnel, x, y) {
        if (this.collapsedTunnels.has(tunnel.id)) return false;
        const dx = (x - tunnel.x) / (tunnel.width / 2);
        const dy = (y - tunnel.y) / (tunnel.height / 2);
        return dx * dx + dy * dy <= 1;
    }

    getTunnelAt(x, y) {
        for (const t of this.tunnels) {
            if (this.isInsideTunnel(t, x, y)) return t;
        }
        return null;
    }

    isOverTunnel(x, tunnel) {
        return Math.abs(x - tunnel.x) <= tunnel.width / 2;
    }

    crackPolygon(crack) {
        const half = (crack.width ?? 0.9) / 2;
        const topY = crack.openAtSurface
            ? this.surfaceY(crack.x) + 0.35
            : this.bedrockY(crack.x) + 0.45;
        const botY = this.bedrockY(crack.x) - (crack.depth ?? 6);
        return {
            topY,
            botY,
            topHalf: half,
            botHalf: half * 0.22
        };
    }

    isInCrackVoid(x, y) {
        for (const c of this.cracks) {
            const d = Math.abs(x - c.x);
            const poly = this.crackPolygon(c);
            if (y > poly.topY || y < poly.botY) continue;
            const t = (poly.topY - y) / Math.max(0.15, poly.topY - poly.botY);
            const half = poly.topHalf * (1 - t) + poly.botHalf * t;
            if (d < half) return true;
        }
        return false;
    }

    classify(x, y) {
        const waterY = this.waterSurfaceY(x);
        const surf = this.surfaceY(x);
        if (waterY != null && y <= waterY && y > surf) return 'water';
        if (y > surf + 0.04) return 'air';
        if (this.getTunnelAt(x, y)) return 'tunnel';
        if (this.isInCrackVoid(x, y)) return 'crack';
        if (y <= this.bedrockY(x)) return 'rock';
        return 'soil';
    }

    isSolid(x, y) {
        const cls = this.classify(x, y);
        return cls === 'rock' || cls === 'soil';
    }

    isRock(x, y) {
        return this.classify(x, y) === 'rock';
    }

    isSolidRockForPin(x, y) {
        return this.classify(x, y) === 'rock';
    }

    supportY(x) {
        return this.surfaceY(x);
    }

    rockCoverAboveTunnel(tunnel) {
        const samples = 20;
        let minCover = Infinity;
        for (let i = 0; i <= samples; i++) {
            const x = tunnel.x - tunnel.width / 2 + (tunnel.width * i) / samples;
            const roof = this.tunnelRoofY(tunnel, x);
            if (roof == null) continue;
            minCover = Math.min(minCover, this.bedrockY(x) - roof);
        }
        return Number.isFinite(minCover) ? minCover : 0;
    }

    /**
     * Förenklad bergbalk/bergvalv: kapacitet växer med täckning² och minskar med spännvidd.
     * Närliggande sprickor sänker kapaciteten.
     */
    tunnelRoofCapacity(tunnel) {
        const cover = Math.max(0, this.rockCoverAboveTunnel(tunnel));
        const span = Math.max(0.6, tunnel.width);
        if (cover < 0.35) {
            return { cover, span, ratio: cover / span, capacityN: 0, crackFactor: 1 };
        }
        let crackFactor = 1;
        for (const c of this.cracks) {
            if (Math.abs(c.x - tunnel.x) < span * 0.55 + (c.width ?? 1)) {
                crackFactor = Math.min(crackFactor, 0.68);
            }
        }
        const ratio = cover / span;
        const beamCap = (4 / 3) * ROCK_ALLOWABLE_STRESS * TRIBUTARY_BREADTH * (cover * cover) / span;
        const archBoost = 1 + Math.max(0, ratio - 0.28) * 1.7;
        const capacityN = beamCap * archBoost * crackFactor;
        return { cover, span, ratio, capacityN, crackFactor };
    }

    overburdenWeightN(tunnel) {
        const cover = Math.max(0, this.rockCoverAboveTunnel(tunnel));
        const span = tunnel.width;
        const rockW = cover * span * TRIBUTARY_BREADTH * ROCK_DENSITY * GRAVITY;
        let soilW = 0;
        const samples = 12;
        for (let i = 0; i <= samples; i++) {
            const x = tunnel.x - span / 2 + (span * i) / samples;
            const column = this.soilColumnAt(x);
            let colDensity = SOIL_DENSITY;
            let colTh = 0;
            let massProxy = 0;
            for (const layer of column) {
                massProxy += layer.thickness * (getSoil(layer.type).density || SOIL_DENSITY);
                colTh += layer.thickness;
            }
            if (colTh > 0) colDensity = massProxy / colTh;
            soilW += this.soilThickness(x) * (span / samples) * TRIBUTARY_BREADTH * colDensity * GRAVITY;
        }
        return rockW + soilW;
    }

    /**
     * Vertikala upplagsreaktioner från hela sammanhängande stommen.
     *
     * Varje nodlast fördelas till närmast omslutande upplag med statisk
     * hävstångsfördelning. Därmed följer vikten från alla övre våningar
     * lastvägen ner till grundens upplag, i stället för att bara räkna noder
     * som råkar ligga nära tunnelns tak.
     */
    calculateSupportReactions(nodes) {
        const nodeSet = new Set(nodes);
        const visited = new Set();
        const reactions = [];

        for (const start of nodes) {
            if (visited.has(start)) continue;

            const component = [];
            const stack = [start];
            visited.add(start);

            while (stack.length) {
                const node = stack.pop();
                component.push(node);
                for (const member of node.connectedMembers || []) {
                    if (member.isBroken) continue;
                    const other = member.nodeA === node ? member.nodeB : member.nodeA;
                    if (!other || !nodeSet.has(other) || visited.has(other)) continue;
                    visited.add(other);
                    stack.push(other);
                }
            }

            const supports = component
                .filter(node => node.fixed || node.isGroundAnchor || node.isBedrockPinned)
                .sort((a, b) => a.x - b.x);
            if (!supports.length) continue;

            const componentReactions = new Map(supports.map(node => [node, 0]));
            let componentMassKg = 0;

            for (const loadNode of component) {
                const massKg = Math.max(0, loadNode.mass || 0);
                if (massKg === 0) continue;
                componentMassKg += massKg;
                const loadN = massKg * GRAVITY;

                if (supports.length === 1 || loadNode.x <= supports[0].x) {
                    const support = supports[0];
                    componentReactions.set(support, componentReactions.get(support) + loadN);
                    continue;
                }

                const last = supports[supports.length - 1];
                if (loadNode.x >= last.x) {
                    componentReactions.set(last, componentReactions.get(last) + loadN);
                    continue;
                }

                for (let i = 0; i < supports.length - 1; i++) {
                    const left = supports[i];
                    const right = supports[i + 1];
                    if (loadNode.x < left.x || loadNode.x > right.x) continue;
                    const span = Math.max(1e-6, right.x - left.x);
                    const rightShare = (loadNode.x - left.x) / span;
                    componentReactions.set(left, componentReactions.get(left) + loadN * (1 - rightShare));
                    componentReactions.set(right, componentReactions.get(right) + loadN * rightShare);
                    break;
                }
            }

            for (const support of supports) {
                reactions.push({
                    node: support,
                    reactionN: componentReactions.get(support),
                    componentMassKg
                });
            }
        }

        return reactions;
    }

    buildingLoadOverTunnelN(nodes, tunnel, supportReactions = null) {
        const reactions = supportReactions || this.calculateSupportReactions(nodes);
        return reactions.reduce((sum, reaction) => {
            if (!this.isNodeOnTunnelCover(reaction.node, tunnel)) return sum;
            return sum + reaction.reactionN;
        }, 0);
    }

    isNodeOnTunnelCover(node, tunnel) {
        if (!this.isOverTunnel(node.x, tunnel)) return false;
        const roof = this.tunnelRoofY(tunnel, node.x);
        if (roof == null) return false;
        const surf = this.surfaceY(node.x);
        return node.y >= roof - 0.25 && node.y <= surf + 2.5;
    }

    assessTunnelLoads(nodes) {
        const allSupportReactions = this.calculateSupportReactions(nodes);
        return this.tunnels.map(tunnel => {
            const cap = this.tunnelRoofCapacity(tunnel);
            const overburden = this.overburdenWeightN(tunnel);
            const supportReactions = allSupportReactions.filter(reaction =>
                this.isNodeOnTunnelCover(reaction.node, tunnel)
            );
            const building = this.buildingLoadOverTunnelN(nodes, tunnel, allSupportReactions);
            // Tunneln antas redan stå i jämvikt med jord/bergöverlasten efter utsprängning.
            // Ny huslast jämförs mot bergskivans kvarvarande kapacitet.
            const total = building;
            const utilization = cap.capacityN > 0 ? total / cap.capacityN : (total > 0 ? 99 : 0);
            return {
                tunnel,
                ...cap,
                overburdenN: overburden,
                buildingN: building,
                supportReactions,
                totalN: total,
                utilization,
                collapsed: this.collapsedTunnels.has(tunnel.id)
            };
        });
    }

    collapseTunnel(tunnel) {
        if (this.collapsedTunnels.has(tunnel.id)) return false;
        this.collapsedTunnels.add(tunnel.id);
        tunnel.collapsed = true;
        if (this.onTunnelCollapse) this.onTunnelCollapse(tunnel);
        return true;
    }

    sampleProfile(x0, x1, dx = 0.4) {
        const points = [];
        const start = Math.min(x0, x1);
        const end = Math.max(x0, x1);
        const step = Math.max(0.15, dx);
        for (let x = start; x <= end + 1e-6; x += step) {
            const layers = this.soilColumnAt(x);
            points.push({
                x,
                surfaceY: this.surfaceY(x),
                bedrockY: this.bedrockY(x),
                waterY: this.waterSurfaceY(x),
                layers,
                surfaceSoil: layers[0]?.type || this.soilType,
                landslideHazard: this.landslideHazardAt(x)
            });
        }
        return points;
    }

    overviewBounds(pad = 6, targetHeight = 0) {
        let minX = -24;
        let maxX = 24;
        const features = [
            ...(this.ravines || []),
            ...(this.tunnels || []),
            ...(this.cracks || []),
            ...(this.waterBodies || [])
        ];
        for (const f of features) {
            const half = (f.width || 2) / 2;
            minX = Math.min(minX, f.x - half - 4);
            maxX = Math.max(maxX, f.x + half + 4);
        }
        minX -= pad;
        maxX += pad;
        let minY = this.bedrockY((minX + maxX) / 2) - 10;
        let maxY = Math.max(8, targetHeight);
        for (const t of this.tunnels || []) {
            minY = Math.min(minY, t.y - (t.height || 4) / 2 - 3);
        }
        for (const x of [minX, 0, maxX]) {
            maxY = Math.max(maxY, this.surfaceY(x) + 4);
            minY = Math.min(minY, this.bedrockY(x) - 4);
        }
        maxY = Math.max(maxY, targetHeight + 3);
        return { minX, maxX, minY, maxY };
    }
}

export function buildAnchorNodes(terrain, ground) {
    const source = ground.anchorNodes || [];
    return source.map(n => {
        const isBedrock = !!(n.isBedrock || n.soil === 'bedrock');
        const followSurface = n.followSurface !== undefined ? n.followSurface : !isBedrock;
        let { x, y } = n;
        if (followSurface) {
            y = terrain.surfaceY(x);
        }
        if (isBedrock) {
            y = terrain.bedrockY(x) - (n.embed ?? 0.45);
            const tun = terrain.getTunnelAt(x, y);
            if (tun) {
                const floor = terrain.tunnelFloorY(tun, x);
                y = (floor ?? y) - 0.55;
            }
            if (terrain.isInCrackVoid(x, y)) {
                y = terrain.bedrockY(x) - (n.embed ?? 0.45) - 1.2;
            }
        }
        const soil = n.soil
            || (terrain.isRock(x, y) ? 'bedrock' : terrain.surfaceSoilId(x));
        return {
            x,
            y,
            fixed: n.fixed !== false && (isBedrock || followSurface),
            soil: resolveSoilId(soil),
            isBedrock,
            isGroundAnchor: true
        };
    });
}
