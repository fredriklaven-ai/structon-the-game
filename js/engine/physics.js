/**
 * STRUCTON THE GAME - Fysik- och Bärverksmotor (2D FEM / Spring-Damper & Beam Mechanics)
 * Beräknar spänningar, deformationer, knäckning, markinteraktion och brott.
 */

import { MATERIALS, getSoil } from './materials.js';

export class PhysicsEngine {
    constructor() {
        this.nodes = [];
        this.members = [];
        this.debris = []; // Partiklar och rasrester
        this.particles = [];
        
        // Fysikparametrar
        this.gravity = -9.81; // m/s² (positiv y är uppåt)
        this.timeScale = 1.0;
        this.subSteps = 12;   // Sub-steps för numerisk stabilitet vid styva stål/betongelement
        this.structuralDamping = 0.08; // Konstruktionsdämpning (viskös dämpning)
        
        // Statistik för besiktning
        this.stats = {
            maxStressRatio: 0,
            criticalMember: null,
            totalMass: 0,
            brokenMembersCount: 0,
            maxTopSway: 0,
            buildingHeight: 0,
            peakWorldY: 0,
            buildingWidth: 0,
            totalCost: 0
        };

        this.onMemberBroken = null; // Callback för ljud och händelser
        this.terrain = null;
    }

    reset() {
        this.nodes = [];
        this.members = [];
        this.debris = [];
        this.particles = [];
        this.stats = {
            maxStressRatio: 0,
            criticalMember: null,
            totalMass: 0,
            brokenMembersCount: 0,
            maxTopSway: 0,
            buildingHeight: 0,
            peakWorldY: 0,
            buildingWidth: 0,
            totalCost: 0
        };
    }

    resetToBlueprint() {
        for (const n of this.nodes) {
            n.x = n.initialX;
            n.y = n.initialY;
            n.vx = 0;
            n.vy = 0;
            n.fx = 0;
            n.fy = 0;
            n.fixed = n.initialFixed;
            n.isBedrockPinned = n.initialBedrockPinned;
        }
        for (const m of this.members) {
            m.isBroken = false;
            m.isBuckled = false;
            m.force = 0;
            m.stress = 0;
            m.stressRatio = 0;
            m.failureType = null;
            if (!m.nodeA.connectedMembers.includes(m)) m.nodeA.connectedMembers.push(m);
            if (!m.nodeB.connectedMembers.includes(m)) m.nodeB.connectedMembers.push(m);
        }
        this.debris = [];
        this.particles = [];
        this.updateNodeMasses();
        this.calculateStats();
    }

    addNode(x, y, isFixed = false, soilType = null) {
        const id = 'node_' + Math.random().toString(36).substr(2, 9);
        const node = {
            id,
            x,
            y,
            initialX: x,
            initialY: y,
            vx: 0,
            vy: 0,
            fx: 0,
            fy: 0,
            mass: 50, // Grundmassa i kg
            fixed: isFixed,
            initialFixed: isFixed,
            soilType: soilType,
            connectedMembers: [],
            settlement: 0,
            isBedrockPinned: false,
            initialBedrockPinned: false,
            isGroundAnchor: isFixed || this._isAtTerrainSurface(x, y)
        };
        this.nodes.push(node);
        return node;
    }

    findNearestNode(x, y, maxDistance = 0.8) {
        let nearest = null;
        let minDist = maxDistance;
        for (const n of this.nodes) {
            const d = Math.hypot(n.x - x, n.y - y);
            if (d < minDist) {
                minDist = d;
                nearest = n;
            }
        }
        return nearest;
    }

    addMember(nodeA, nodeB, materialKey) {
        if (!nodeA || !nodeB || nodeA === nodeB) return null;

        // Kontrollera om det redan finns en balk mellan noderna
        const existing = this.members.find(m => 
            !m.isBroken && 
            ((m.nodeA === nodeA && m.nodeB === nodeB) || (m.nodeA === nodeB && m.nodeB === nodeA))
        );
        if (existing) return existing;

        const material = MATERIALS[materialKey] || MATERIALS.wood;
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const length = Math.hypot(dx, dy);

        if (length < 0.2) return null; // För kort

        // Pelare: kräver huvudsakligen vertikal riktning
        if (material.isColumn) {
            const slopeFromVertical = Math.abs(Math.atan2(Math.abs(dx), Math.abs(dy))) * 180 / Math.PI;
            const maxSlope = material.maxSlopeDeg ?? 15;
            if (slopeFromVertical > maxSlope) {
                return { error: 'column_slope', slopeFromVertical, maxSlope, material };
            }
        }

        // Beräkna tvärsnittsarea (m²) och tröghetsmoment (m⁴) baserat på materialets tjocklek
        const thicknessMeters = material.thickness / 100; // t.ex. 0.14 m
        const area = thicknessMeters * thicknessMeters;
        const momentOfInertia = (thicknessMeters * Math.pow(thicknessMeters, 3)) / 12; // I = b*h³/12

        // Förspänning: förkorta vilolängden så kabeln drar ihop ändarna
        let restLength = length;
        let prestressForce = 0;
        if (material.isPretension && material.prestressForce > 0) {
            prestressForce = material.prestressForce;
            const kPhysical = (material.youngsModulus * area) / Math.max(length, 0.2);
            const shorten = Math.min(length * 0.02, prestressForce / Math.max(kPhysical, 1));
            restLength = Math.max(0.15, length - shorten);
        }

        const id = 'mem_' + Math.random().toString(36).substr(2, 9);
        const member = {
            id,
            nodeA,
            nodeB,
            material,
            materialKey,
            restLength,
            currentLength: length,
            area,
            momentOfInertia,
            force: 0,        // Normalstyrka (N): >0 drag, <0 tryck
            stress: 0,       // Pa
            stressRatio: 0,  // 0.0 -> 1.0 (1.0 = brott)
            isBroken: false,
            isBuckled: false,
            failureType: null, // 'tension', 'compression', 'buckling', 'shear'
            angularMomentum: 0,
            cost: Math.round(length * material.costPerMeter),
            weight: length * area * material.density,
            prestressForce,
            shaftCapacity: 0
        };

        this.members.push(member);
        nodeA.connectedMembers.push(member);
        nodeB.connectedMembers.push(member);

        if (material.isPile) {
            this._setupPileAnchorage(member);
        }

        this.updateNodeMasses();
        this.calculateStats();
        return member;
    }

    _isAtTerrainSurface(x, y) {
        if (!this.terrain) return y <= 0;
        return y <= this.terrain.surfaceY(x) + 0.3;
    }

    _setupPileAnchorage(member) {
        const mat = member.material;
        if (mat.isFrictionPile) {
            this._refreshFrictionPileCapacity(member);
            return;
        }
        // Spetsbärande: förankra tippen i/till berg
        this._tryPinEndBearingTip(member.nodeA, mat);
        this._tryPinEndBearingTip(member.nodeB, mat);
    }

    _tryPinPileToBedrock(node) {
        // Bakåtkompatibel hjälpare (äldre tester)
        this._tryPinEndBearingTip(node, MATERIALS.pile_driven || MATERIALS.pile);
    }

    _tryPinEndBearingTip(node, material) {
        if (!this.terrain || !node || !material) return;
        if (material.isFrictionPile) return;

        const rockY = this.terrain.bedrockY(node.x);
        const method = material.pileMethod || 'driven';
        let ok = false;

        if (method === 'bored') {
            // Borrad: tippen ska gå ned i berget
            ok = node.y <= rockY - 0.2 && this.terrain.isSolidRockForPin(node.x, node.y);
        } else {
            // Slagen: tippen ska nå bergytan (eller strax under)
            const nearRockSurface = node.y <= rockY + 0.25 && node.y >= rockY - 0.85;
            ok = (nearRockSurface && this.terrain.classify(node.x, Math.min(node.y, rockY - 0.05)) === 'rock')
                || this.terrain.isSolidRockForPin(node.x, node.y);
        }

        if (ok) {
            node.fixed = true;
            node.initialFixed = true;
            node.isBedrockPinned = true;
            node.initialBedrockPinned = true;
            node.soilType = 'bedrock';
            node.isGroundAnchor = true;
            node.pileTipBearing = true;
        }
    }

    _refreshFrictionPileCapacity(member) {
        if (!member?.material?.isFrictionPile) {
            member.shaftCapacity = 0;
            return;
        }
        const friction = member.material.shaftFrictionPerMeter || 40000;
        const embed = this._pileEmbedmentLength(member);
        member.shaftCapacity = embed * friction;
        // Förstärk jordkontakt på noder i jord
        for (const n of [member.nodeA, member.nodeB]) {
            if (n.isBedrockPinned) continue;
            n.frictionPileBoost = Math.max(n.frictionPileBoost || 0, 1.8 + embed * 0.15);
        }
    }

    _pileEmbedmentLength(member) {
        const terrain = this.terrain;
        const nA = member.nodeA;
        const nB = member.nodeB;
        const len = Math.hypot(nB.x - nA.x, nB.y - nA.y);
        if (len < 0.05) return 0;
        const samples = 12;
        let embed = 0;
        for (let i = 0; i < samples; i++) {
            const t0 = i / samples;
            const t1 = (i + 1) / samples;
            const x = nA.x + (nB.x - nA.x) * ((t0 + t1) / 2);
            const y = nA.y + (nB.y - nA.y) * ((t0 + t1) / 2);
            const ds = len / samples;
            if (!terrain) {
                if (y < 0) embed += ds;
                continue;
            }
            const surf = terrain.surfaceY(x);
            const cls = terrain.classify(x, y);
            if (y < surf - 0.05 && cls !== 'tunnel' && cls !== 'crack' && cls !== 'air') {
                embed += ds;
            }
        }
        return embed;
    }

    /**
     * Friktionspåle: mantelskjuvning motverkar sjunkning under tryck.
     */
    applyFrictionPileForces(member) {
        if (!member.material?.isFrictionPile || member.isBroken) return;
        this._refreshFrictionPileCapacity(member);
        const capacity = member.shaftCapacity || 0;
        if (capacity <= 0) return;

        // Om pålen är i tryck (ändar trycks ihop / tippen sjunker), lyft med manteln
        const nA = member.nodeA;
        const nB = member.nodeB;
        const tip = nA.y <= nB.y ? nA : nB;
        const head = tip === nA ? nB : nA;
        if (tip.fixed) return;

        const compression = Math.max(0, -member.force);
        const resist = Math.min(capacity, compression + Math.max(0, -tip.fy));
        if (resist <= 0) return;

        // Fördela mantellast längs pålen: mer till den lägre noden
        tip.fy += resist * 0.72;
        if (!head.fixed) head.fy += resist * 0.28;
        tip.vy *= 0.85;
    }

    removeMember(member) {
        const idx = this.members.indexOf(member);
        if (idx !== -1) {
            this.members.splice(idx, 1);
            
            // Rensa från noder
            member.nodeA.connectedMembers = member.nodeA.connectedMembers.filter(m => m !== member);
            member.nodeB.connectedMembers = member.nodeB.connectedMembers.filter(m => m !== member);

            // Rensa ensamma fria noder som inte är grundförankrade
            this.cleanOrphanNodes();
            this.updateNodeMasses();
            this.calculateStats();
        }
    }

    removeNode(node) {
        const connected = [...node.connectedMembers];
        for (const m of connected) {
            this.removeMember(m);
        }
        const idx = this.nodes.indexOf(node);
        if (idx !== -1) {
            this.nodes.splice(idx, 1);
        }
        this.calculateStats();
    }

    cleanOrphanNodes() {
        this.nodes = this.nodes.filter(n => n.fixed || n.isGroundAnchor || n.isBedrockPinned || n.connectedMembers.length > 0);
    }

    updateNodeMasses() {
        for (const n of this.nodes) {
            let totalM = 30; // Grundvikt (kopplingar, bultar)
            for (const m of n.connectedMembers) {
                if (!m.isBroken) {
                    totalM += m.weight * 0.5; // Halva balkens massa till vardera nod
                }
            }
            // Tillägg för bjälklagsnyttolast om horisontell balk
            n.mass = Math.max(30, totalM);
        }
    }

    step(dt, environment) {
        const effectiveDt = (dt * this.timeScale) / this.subSteps;

        for (let step = 0; step < this.subSteps; step++) {
            // 1. Återställ krafter och applicera gravitation
            for (const n of this.nodes) {
                n.fx = 0;
                n.fy = n.mass * this.gravity;

                // Markreaktion, klyftor, vatten, tunnlar och berg
                if (!n.fixed) {
                    this.applyTerrainForces(n);
                }
            }

            // 2. Applicera miljö- och katastrofkrafter (Vind, Jordbävning, Regnlast, Skred)
            if (environment) {
                environment.applyForces(this.nodes, this.members, effectiveDt);
            }

            // 3. Beräkna krafter i balkar & strävor
            for (const m of this.members) {
                if (m.isBroken) continue;

                const nA = m.nodeA;
                const nB = m.nodeB;

                const dx = nB.x - nA.x;
                const dy = nB.y - nA.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 1e-6) continue;

                m.currentLength = dist;
                const deltaL = dist - m.restLength;
                const strain = deltaL / m.restLength;

                // Hookes lag & töjning
                const kPhysical = (m.material.youngsModulus * m.area) / m.restLength;
                // Numeriskt stabil fjäderkonstant för integration
                const kSim = Math.min(2.8e7, kPhysical);
                let normalForce = kSim * deltaL;

                // Relativ hastighet för strukturdämpning (viskös dämpning för att dämpa svängningar)
                const rvx = nB.vx - nA.vx;
                const rvy = nB.vy - nA.vy;
                const dirX = dx / dist;
                const dirY = dy / dist;
                const relVelNormal = rvx * dirX + rvy * dirY;

                // Fysisk kritisk dämpning c = 2 * zeta * sqrt(k * m)
                const cDamping = 0.06 * 2 * Math.sqrt(kSim * Math.max(25, (nA.mass + nB.mass) * 0.5));
                const dampingForce = Math.max(-10000, Math.min(10000, relVelNormal * cDamping));
                let totalForce = normalForce + dampingForce;

                m.force = normalForce; // Kraft i Newton
                const absForce = Math.abs(normalForce);
                m.stress = absForce / m.area; // Verklig inre mekanisk spänning (Pa)

                // Euler-knäckning vid tryck
                // F_crit = (pi² * E * I) / (L_rest)²
                const eulerBucklingForce = (Math.PI * Math.PI * m.material.youngsModulus * m.momentOfInertia) / (m.restLength * m.restLength);
                m.bucklingCapacity = eulerBucklingForce;

                // Spänning och knäckningsberäkning
                let allowableStress = 0;
                let isCritical = false;

                if (m.material.isTensionOnly) {
                    // Dragband / spännkabel: enbart drag – tryck ger slack
                    if (normalForce <= 0) {
                        normalForce = 0;
                        totalForce = Math.max(0, dampingForce);
                        m.force = 0;
                        m.stress = 0;
                        m.stressRatio = 0;
                    } else {
                        allowableStress = m.material.maxTension;
                        m.stressRatio = m.stress / Math.max(allowableStress, 1);
                        if (m.stress > allowableStress) {
                            m.failureType = 'tension';
                            isCritical = true;
                        }
                    }
                } else if (m.material.isStrut) {
                    // Strävor (Kryssförband / dragstag)
                    if (normalForce > 0) {
                        // Dragspänning
                        allowableStress = m.material.maxTension;
                        m.stressRatio = m.stress / allowableStress;
                        if (m.stress > allowableStress) {
                            m.failureType = 'tension';
                            isCritical = true;
                        }
                    } else {
                        // Vid tryck slaknar en slank sträva elastiskt utan att explodera/brista
                        m.stressRatio = Math.min(0.40, absForce / (eulerBucklingForce + 1));
                        normalForce = Math.max(-eulerBucklingForce * 0.35, normalForce);
                        totalForce = normalForce + dampingForce;
                    }
                } else {
                    // Vanliga bärverkselement (Pelare, Balkar, Plattor, Pålar)
                    if (normalForce > 0) {
                        // Dragspänning (Tension)
                        allowableStress = m.material.maxTension;
                        m.stressRatio = m.stress / allowableStress;
                        if (m.stress > allowableStress) {
                            m.failureType = 'tension';
                            isCritical = true;
                        }
                    } else {
                        // Tryckspänning (Compression) & Knäckning
                        const materialLimit = m.material.maxCompression;
                        const bucklingStress = (eulerBucklingForce * 1.5) / m.area;
                        allowableStress = Math.min(materialLimit, bucklingStress);
                        m.stressRatio = m.stress / allowableStress;

                        if (m.stress > materialLimit) {
                            m.failureType = 'compression';
                            isCritical = true;
                        } else if (absForce > eulerBucklingForce * 1.6 && Math.abs(strain) > 0.08) {
                            m.failureType = 'buckling';
                            m.isBuckled = true;
                            isCritical = true;
                        }
                    }
                }

                if (isCritical) {
                    this.breakMember(m);
                    continue;
                }

                // Applicera krafter på noder
                const fx = totalForce * dirX;
                const fy = totalForce * dirY;

                if (!nA.fixed) {
                    nA.fx += fx;
                    nA.fy += fy;
                }
                if (!nB.fixed) {
                    nB.fx -= fx;
                    nB.fy -= fy;
                }

                if (m.material.isFrictionPile) {
                    this.applyFrictionPileForces(m);
                }
            }

            // 4. Integrera rörelser (Semi-implicit Euler / Verlet)
            for (const n of this.nodes) {
                if (n.fixed) {
                    n.vx = 0;
                    n.vy = 0;
                    continue;
                }

                const ax = n.fx / n.mass;
                const ay = n.fy / n.mass;

                n.vx += ax * effectiveDt;
                n.vy += ay * effectiveDt;

                // Global luftmotstånd
                n.vx *= 0.9992;
                n.vy *= 0.9992;

                n.x += n.vx * effectiveDt;
                n.y += n.vy * effectiveDt;

                // Djupaste tillåtna fall (klyfta / tunnel / spricka)
                if (n.y < -45) {
                    n.y = -45;
                    n.vy = 0;
                }
            }
        }

        this.evaluateTunnelRoofLoads();

        // Uppdatera partiklar och skräp
        this.updateDebris(dt);
        this.calculateStats();
    }

    applyTerrainForces(n) {
        const terrain = this.terrain;
        if (!terrain) {
            if (n.y <= 0) {
                const soil = n.soilType ? getSoil(n.soilType) : getSoil('moraine');
                const penetration = -n.y;
<<<<<<< HEAD
                const kGround = 450000 * (soil ? soil.stiffness : 1.0);
                // Extra sättning i lös/blöt lera
                const settleDamp = 1 - Math.min(0.55, (soil?.settlementRate || 0) * 0.8);
                const fNormal = penetration * kGround * settleDamp;
=======
                const boost = n.frictionPileBoost || 1;
                const kGround = 450000 * (soil ? soil.stiffness : 1.0) * boost;
                const fNormal = penetration * kGround;
>>>>>>> 5803683 (Lägg till pelare, dragband, spännkabel och påltyper)
                n.fy += fNormal;
                n.fx -= n.vx * (fNormal * 0.35 + 200);
                n.vy *= 0.7;
            }
            return;
        }

        const cls = terrain.classify(n.x, n.y);
        const waterY = terrain.waterSurfaceY(n.x);

        if (cls === 'water' || (waterY != null && n.y < waterY && n.y > terrain.surfaceY(n.x))) {
            n.fy += n.mass * 7.4; // flytkraft mot tyngdkraften
            n.vx *= 0.92;
            n.vy *= 0.88;
            n.fx -= n.vx * 180;
        }

        if (cls === 'tunnel') {
            const tunnel = terrain.getTunnelAt(n.x, n.y);
            if (tunnel) {
                const floor = terrain.tunnelFloorY(tunnel, n.x);
                if (floor != null && n.y < floor) {
                    n.y = floor;
                    n.vy = Math.max(0, -n.vy * 0.2);
                }
            }
            return;
        }

        if (cls === 'crack') {
            return;
        }

        const support = terrain.supportY(n.x);
        if (n.y < support) {
            const penetration = support - n.y;
            const soil = terrain.soilAt(n.x, support - 0.05);
<<<<<<< HEAD
            const kGround = 450000 * (soil ? soil.stiffness : 1.0);
            const settleDamp = 1 - Math.min(0.55, (soil?.settlementRate || 0) * 0.8);
            const fNormal = penetration * kGround * settleDamp;
=======
            const boost = n.frictionPileBoost || 1;
            const kGround = 450000 * (soil ? soil.stiffness : 1.0) * boost;
            const fNormal = penetration * kGround;
>>>>>>> 5803683 (Lägg till pelare, dragband, spännkabel och påltyper)
            n.fy += fNormal;
            n.fx -= n.vx * (fNormal * 0.35 + 200);
            n.vy *= 0.7;
            n.soilType = soil ? soil.id : n.soilType;
            // Lös/blöt lera utan bergförankring: långsam vertikal sättning under last
            if (soil?.requiresPiling && !n.isBedrockPinned && !n.fixed) {
                n.fy -= n.mass * 9.81 * soil.settlementRate * 0.15;
            }
        }
    }

    evaluateTunnelRoofLoads() {
        const terrain = this.terrain;
        if (!terrain || !terrain.tunnels.length) return;

        const assessments = terrain.assessTunnelLoads(this.nodes);
        for (const a of assessments) {
            if (a.collapsed) continue;
            if (a.utilization < 1.02) continue;
            if (!terrain.collapseTunnel(a.tunnel)) continue;

            for (const n of this.nodes) {
                if (!terrain.isNodeOnTunnelCover(n, a.tunnel)) continue;
                if (n.isBedrockPinned && terrain.isSolidRockForPin(n.x, n.y)) continue;
                n.fixed = false;
                n.isBedrockPinned = false;
            }

            const t = a.tunnel;
            for (let i = 0; i < 22; i++) {
                const ang = (i / 22) * Math.PI * 2;
                this.particles.push({
                    x: t.x + Math.cos(ang) * t.width * 0.25,
                    y: t.y + Math.sin(ang) * t.height * 0.25,
                    vx: (Math.random() - 0.5) * 6,
                    vy: Math.random() * 4,
                    size: Math.random() * 0.35 + 0.12,
                    color: '#64748B',
                    alpha: 1.0,
                    life: Math.random() * 1.8 + 0.7,
                    type: 'dust'
                });
            }
        }
    }

    breakMember(member) {
        if (member.isBroken) return;
        member.isBroken = true;
        this.stats.brokenMembersCount++;

        // Ta bort från anslutningslistor
        member.nodeA.connectedMembers = member.nodeA.connectedMembers.filter(m => m !== member);
        member.nodeB.connectedMembers = member.nodeB.connectedMembers.filter(m => m !== member);

        // Skapa skräp / rasmassa som faller
        const midX = (member.nodeA.x + member.nodeB.x) / 2;
        const midY = (member.nodeA.y + member.nodeB.y) / 2;
        const length = member.restLength;
        const angle = Math.atan2(member.nodeB.y - member.nodeA.y, member.nodeB.x - member.nodeA.x);

        this.debris.push({
            x: midX,
            y: midY,
            vx: (Math.random() - 0.5) * 3 + (member.nodeA.vx + member.nodeB.vx) * 0.4,
            vy: Math.random() * 2 + (member.nodeA.vy + member.nodeB.vy) * 0.4,
            angle: angle,
            vAngle: (Math.random() - 0.5) * 6,
            length: length,
            material: member.material,
            life: 8.0 // sekunder kvar
        });

        // Skapa damm- och splitterpartiklar
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: midX + (Math.random() - 0.5) * length * 0.5,
                y: midY + (Math.random() - 0.5) * 0.5,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.2) * 8,
                size: Math.random() * 0.25 + 0.08,
                color: member.material.color,
                alpha: 1.0,
                life: Math.random() * 1.5 + 0.8,
                type: member.material.id === 'steel' ? 'spark' : 'dust'
            });
        }

        if (this.onMemberBroken) {
            this.onMemberBroken(member);
        }
    }

    updateDebris(dt) {
        // Uppdatera skräp
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.vy += this.gravity * dt;
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.angle += d.vAngle * dt;
            d.life -= dt;

            // Markkollision mot kuperad yta
            const groundY = this.terrain ? this.terrain.supportY(d.x) : 0;
            if (d.y <= groundY) {
                d.y = groundY;
                d.vy = -d.vy * 0.25;
                d.vx *= 0.6;
                d.vAngle *= 0.5;
            }

            if (d.life <= 0) {
                this.debris.splice(i, 1);
            }
        }

        // Uppdatera partiklar
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += (p.type === 'spark' ? this.gravity * 0.5 : -1.5) * dt;
            p.life -= dt;
            p.alpha = Math.max(0, p.life);

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    calculateStats() {
        let maxRatio = 0;
        let criticalMem = null;
        let totalCost = 0;
        let totalMass = 0;
        let maxY = -Infinity;
        let maxHeightAboveGround = 0;
        let minX = Infinity;
        let maxX = -Infinity;
        let maxSway = 0;

        for (const m of this.members) {
            if (!m.isBroken) {
                totalCost += m.cost;
                totalMass += m.weight;
                if (m.stressRatio > maxRatio) {
                    maxRatio = m.stressRatio;
                    criticalMem = m;
                }
            }
        }

        for (const n of this.nodes) {
            if (n.y > maxY) maxY = n.y;
            if (n.x < minX) minX = n.x;
            if (n.x > maxX) maxX = n.x;

            const ground = this.terrain ? this.terrain.surfaceY(n.x) : 0;
            const heightAboveGround = n.y - ground;
            if (heightAboveGround > maxHeightAboveGround) maxHeightAboveGround = heightAboveGround;

            const sway = Math.abs(n.x - n.initialX);
            if (sway > maxSway) maxSway = sway;
        }

        this.stats.maxStressRatio = maxRatio;
        this.stats.criticalMember = criticalMem;
        this.stats.totalCost = totalCost;
        this.stats.totalMass = Math.round(totalMass);
        this.stats.buildingHeight = Math.max(0, parseFloat(maxHeightAboveGround.toFixed(1)));
        this.stats.peakWorldY = Number.isFinite(maxY) ? maxY : 0;
        this.stats.buildingWidth = minX < maxX ? parseFloat((maxX - minX).toFixed(1)) : 0;
        this.stats.maxTopSway = parseFloat(maxSway.toFixed(2));
    }

    _memberAngleDeg(member) {
        const dx = member.nodeB.x - member.nodeA.x;
        const dy = member.nodeB.y - member.nodeA.y;
        return Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
    }

    _memberConnects(member, nodeP, nodeQ, tol = 0.65) {
        const ends = [member.nodeA, member.nodeB];
        const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < tol;
        return (near(ends[0], nodeP) && near(ends[1], nodeQ)) ||
            (near(ends[1], nodeP) && near(ends[0], nodeQ));
    }

    // Upptäcker slutna 4-sidiga våningsplan (rum) för rendering av fönster, belysning och inredning
    detectRooms() {
        const rooms = [];
        const activeMembers = this.members.filter(m => {
            if (m.isBroken) return false;
            const mat = m.material;
            return !mat.isStrut && !mat.isTensionOnly && !mat.isPile;
        });
        // Vinkelbaserat: tål kuperad mark och dragriktning vid placering
        const horiz = activeMembers.filter(m => {
            const a = this._memberAngleDeg(m);
            return a < 22 || a > 158;
        });
        const vert = activeMembers.filter(m => {
            const a = this._memberAngleDeg(m);
            return a > 68 && a < 112;
        });

        for (const bottom of horiz) {
            for (const top of horiz) {
                if (bottom === top) continue;

                const bLeft = bottom.nodeA.x <= bottom.nodeB.x ? bottom.nodeA : bottom.nodeB;
                const bRight = bottom.nodeA.x <= bottom.nodeB.x ? bottom.nodeB : bottom.nodeA;
                const tLeft = top.nodeA.x <= top.nodeB.x ? top.nodeA : top.nodeB;
                const tRight = top.nodeA.x <= top.nodeB.x ? top.nodeB : top.nodeA;

                const bottomY = (bLeft.y + bRight.y) / 2;
                const topY = (tLeft.y + tRight.y) / 2;
                const dy = topY - bottomY;
                if (dy <= 1.6 || dy >= 6.5) continue;

                // Kräv att bjälklagen ungefär överlappar i X
                const overlapLeft = Math.max(bLeft.x, tLeft.x);
                const overlapRight = Math.min(bRight.x, tRight.x);
                if (overlapRight - overlapLeft < 1.2) continue;

                const leftCol = vert.find(v => this._memberConnects(v, bLeft, tLeft));
                const rightCol = vert.find(v => this._memberConnects(v, bRight, tRight));
                if (!leftCol || !rightCol) continue;

                const leftX = Math.min(bLeft.x, tLeft.x);
                const rightX = Math.max(bRight.x, tRight.x);
                rooms.push({
                    bottomA: bLeft,
                    bottomB: bRight,
                    topA: tLeft,
                    topB: tRight,
                    leftX,
                    rightX,
                    bottomY: Math.min(bLeft.y, bRight.y),
                    topY: Math.max(tLeft.y, tRight.y),
                    floorLevel: Math.round(bottomY / 3.2),
                    width: rightX - leftX,
                    height: topY - bottomY
                });
            }
        }

        // Deduplicera nästan identiska rum
        const unique = [];
        for (const room of rooms) {
            const dup = unique.find(u =>
                Math.abs(u.leftX - room.leftX) < 0.3 &&
                Math.abs(u.rightX - room.rightX) < 0.3 &&
                Math.abs(u.bottomY - room.bottomY) < 0.3 &&
                Math.abs(u.topY - room.topY) < 0.3
            );
            if (!dup) unique.push(room);
        }
        return unique;
    }

    /**
     * Reserv: klär in stommens ytterkontur i våningshöga paneler när
     * slutna fack inte detekteras (sneda bjälklag / ofullständig snäppning).
     */
    detectEnvelopeBays() {
        const active = this.members.filter(m => {
            if (m.isBroken) return false;
            const mat = m.material;
            return !mat.isStrut && !mat.isTensionOnly && !mat.isPile;
        });
        if (active.length < 3) return [];

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const m of active) {
            for (const n of [m.nodeA, m.nodeB]) {
                minX = Math.min(minX, n.x);
                maxX = Math.max(maxX, n.x);
                minY = Math.min(minY, n.y);
                maxY = Math.max(maxY, n.y);
            }
        }
        const width = maxX - minX;
        const height = maxY - minY;
        if (width < 1.5 || height < 1.8) return [];

        const storeyH = 3.2;
        const bays = [];
        let y = minY;
        let floor = 0;
        while (y + 1.5 < maxY + 0.01) {
            const next = Math.min(maxY, y + storeyH);
            if (next - y >= 1.5) {
                bays.push({
                    leftX: minX,
                    rightX: maxX,
                    bottomY: y,
                    topY: next,
                    floorLevel: floor,
                    width,
                    height: next - y,
                    isEnvelope: true
                });
            }
            y = next;
            floor++;
        }
        return bays;
    }

    /**
     * Fasadbås sorterade underifrån och från vänster – montageordning vid invigning.
     */
    getFacadeBays(styleHint = null) {
        let rooms = this.detectRooms();
        if (!rooms.length) {
            rooms = this.detectEnvelopeBays();
        }
        rooms.sort((a, b) => {
            if (a.floorLevel !== b.floorLevel) return a.floorLevel - b.floorLevel;
            return a.leftX - b.leftX;
        });
        return rooms.map((room, index) => ({
            ...room,
            mountIndex: index,
            style: styleHint
        }));
    }
}
