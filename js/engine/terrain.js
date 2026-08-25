/**
 * STRUCTON THE GAME - Terräng- och geologimotor
 * Proceduriell, deterministisk markyta och berggrund med klyftor, vatten,
 * bergssprickor och tunnlar. Bergtäckning över tunneln bär huslasten tills
 * täckningen/spännvidden inte längre räcker.
 */

import { SOIL_TYPES } from './materials.js';

const ROCK_ALLOWABLE_STRESS = 3.5e6; // Pa, sprickigt urberg med säkerhetsfaktor
const ROCK_DENSITY = 2700;           // kg/m³
const SOIL_DENSITY = 1800;           // kg/m³
const TRIBUTARY_BREADTH = 6.0;       // m "in i skärmen" för 2D → 3D last
const GRAVITY = 9.81;

export class TerrainEngine {
    constructor(ground = {}) {
        this.seed = ground.seed ?? 42;
        this.soilType = ground.soilType || 'stiff_soil';
        this.baseSurfaceY = ground.surfaceY ?? 0;
        this.baseBedrockY = ground.bedrockY ?? -4;
        this.slopeAngle = ground.slopeAngle ?? 0;
        this.surfaceAmp = ground.surfaceAmp ?? 1.15;
        this.bedrockAmp = ground.bedrockAmp ?? 1.7;
        this.ravines = ground.ravines || [];
        this.cracks = ground.cracks || [];
        this.tunnels = (ground.tunnels || []).map((t, i) => ({ ...t, id: t.id || `tunnel_${i}` }));
        this.waterBodies = ground.waterBodies || [];
        this.hasClayLayer = !!ground.hasClayLayer;
        this.collapsedTunnels = new Set();
        this.onTunnelCollapse = null;
        this._embedTunnelsInRock();
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
        const n = (this.fbm(x * 0.048, 5) - 0.5) * 2;
        const hills = Math.sin(x * 0.062 + this.seed * 0.4) * 0.55
            + Math.sin(x * 0.028 + 1.7) * 0.85
            + Math.sin(x * 0.14 + 0.6) * 0.22;
        let y = this.baseSurfaceY + this._slope(x) + n * this.surfaceAmp + hills * (this.surfaceAmp * 0.35);

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
        const n = (this.fbm(x * 0.031 + 40, 5) - 0.5) * 2;
        const jagged = Math.sin(x * 0.17 + this.seed * 2.1) * 0.42
            + Math.sin(x * 0.39 + 0.4) * 0.18
            + Math.sin(x * 0.73 + 2.2) * 0.08;
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

    soilAt(x, y) {
        const cls = this.classify(x, y);
        if (cls === 'rock') return SOIL_TYPES.bedrock;
        if (cls === 'soil') return SOIL_TYPES[this.soilType] || SOIL_TYPES.stiff_soil;
        return SOIL_TYPES[this.soilType] || SOIL_TYPES.stiff_soil;
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
            soilW += this.soilThickness(x) * (span / samples) * TRIBUTARY_BREADTH * SOIL_DENSITY * GRAVITY;
        }
        return rockW + soilW;
    }

    buildingLoadOverTunnelN(nodes, tunnel) {
        let mass = 0;
        for (const n of nodes) {
            if (!this.isNodeOnTunnelCover(n, tunnel)) continue;
            mass += n.mass || 0;
        }
        return mass * GRAVITY;
    }

    isNodeOnTunnelCover(node, tunnel) {
        if (!this.isOverTunnel(node.x, tunnel)) return false;
        const roof = this.tunnelRoofY(tunnel, node.x);
        if (roof == null) return false;
        const surf = this.surfaceY(node.x);
        return node.y >= roof - 0.25 && node.y <= surf + 2.5;
    }

    assessTunnelLoads(nodes) {
        return this.tunnels.map(tunnel => {
            const cap = this.tunnelRoofCapacity(tunnel);
            const overburden = this.overburdenWeightN(tunnel);
            const building = this.buildingLoadOverTunnelN(nodes, tunnel);
            // Tunneln antas redan stå i jämvikt med jord/bergöverlasten efter utsprängning.
            // Ny huslast jämförs mot bergskivans kvarvarande kapacitet.
            const total = building;
            const utilization = cap.capacityN > 0 ? total / cap.capacityN : (total > 0 ? 99 : 0);
            return {
                tunnel,
                ...cap,
                overburdenN: overburden,
                buildingN: building,
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
            points.push({
                x,
                surfaceY: this.surfaceY(x),
                bedrockY: this.bedrockY(x),
                waterY: this.waterSurfaceY(x)
            });
        }
        return points;
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
        const soil = n.soil || (terrain.isRock(x, y) ? 'bedrock' : terrain.soilType);
        return {
            x,
            y,
            fixed: n.fixed !== false && (isBedrock || followSurface),
            soil,
            isBedrock,
            isGroundAnchor: true
        };
    });
}
