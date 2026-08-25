/**
 * STRUCTON THE GAME - Fysik- och Bärverksmotor (2D FEM / Spring-Damper & Beam Mechanics)
 * Beräknar spänningar, deformationer, knäckning, markinteraktion och brott.
 */

import { MATERIALS, SOIL_TYPES } from './materials.js';

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
            buildingWidth: 0,
            totalCost: 0
        };

        this.onMemberBroken = null; // Callback för ljud och händelser
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
            soilType: soilType,
            connectedMembers: [],
            settlement: 0,
            isGroundAnchor: isFixed || y <= 0
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

        // Beräkna tvärsnittsarea (m²) och tröghetsmoment (m⁴) baserat på materialets tjocklek
        const thicknessMeters = material.thickness / 100; // t.ex. 0.14 m
        const area = thicknessMeters * thicknessMeters;
        const momentOfInertia = (thicknessMeters * Math.pow(thicknessMeters, 3)) / 12; // I = b*h³/12

        const id = 'mem_' + Math.random().toString(36).substr(2, 9);
        const member = {
            id,
            nodeA,
            nodeB,
            material,
            materialKey,
            restLength: length,
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
            weight: length * area * material.density
        };

        this.members.push(member);
        nodeA.connectedMembers.push(member);
        nodeB.connectedMembers.push(member);

        this.updateNodeMasses();
        this.calculateStats();
        return member;
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
        this.nodes = this.nodes.filter(n => n.fixed || n.connectedMembers.length > 0);
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

                // Markreaktion & jordinteraktion
                if (n.y <= 0 && !n.fixed) {
                    // Markfjäder / bärighet
                    const soil = n.soilType ? SOIL_TYPES[n.soilType] : SOIL_TYPES.stiff_soil;
                    const penetration = -n.y;
                    if (penetration > 0) {
                        const kGround = 450000 * (soil ? soil.stiffness : 1.0);
                        const fNormal = penetration * kGround;
                        n.fy += fNormal;
                        // Friktion i sidled
                        n.fx -= n.vx * (fNormal * 0.35 + 200);
                        n.vy *= 0.7; // Dämpning vid markkontakt
                    }
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
                const totalForce = normalForce + dampingForce;

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

                if (m.material.isStrut) {
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
                    }
                } else {
                    // Vanliga bärverkselement (Pelare, Balkar, Plattor)
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

                // Förhindra att fria noder faller genom berggrunden
                if (n.y < -15) {
                    n.y = -15;
                    n.vy = 0;
                }
            }
        }

        // Uppdatera partiklar och skräp
        this.updateDebris(dt);
        this.calculateStats();
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

            // Markkollision
            if (d.y <= 0) {
                d.y = 0;
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
        let maxY = 0;
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

            const sway = Math.abs(n.x - n.initialX);
            if (sway > maxSway) maxSway = sway;
        }

        this.stats.maxStressRatio = maxRatio;
        this.stats.criticalMember = criticalMem;
        this.stats.totalCost = totalCost;
        this.stats.totalMass = Math.round(totalMass);
        this.stats.buildingHeight = Math.max(0, parseFloat(maxY.toFixed(1)));
        this.stats.buildingWidth = minX < maxX ? parseFloat((maxX - minX).toFixed(1)) : 0;
        this.stats.maxTopSway = parseFloat(maxSway.toFixed(2));
    }

    // Upptäcker slutna 4-sidiga våningsplan (rum) för rendering av fönster, belysning och inredning
    detectRooms() {
        const rooms = [];
        // Enkel våningsrumsdetektion baserad på rektangulära noder
        // Sortera noder i våningsplan
        const activeMembers = this.members.filter(m => !m.isBroken && !m.material.isStrut);
        
        // Hitta horisontella och vertikala balkar
        const horiz = activeMembers.filter(m => Math.abs(m.nodeA.y - m.nodeB.y) < 0.4);
        const vert = activeMembers.filter(m => Math.abs(m.nodeA.x - m.nodeB.x) < 0.4);

        for (const bottom of horiz) {
            for (const top of horiz) {
                if (bottom === top) continue;
                const dy = top.nodeA.y - bottom.nodeA.y;
                if (dy > 1.8 && dy < 5.0) { // Rimlig våningshöjd 2-5 meter
                    // Kolla om det finns vänster och höger pelare
                    const leftCol = vert.find(v => 
                        (Math.hypot(v.nodeA.x - bottom.nodeA.x, v.nodeA.y - bottom.nodeA.y) < 0.5 && Math.hypot(v.nodeB.x - top.nodeA.x, v.nodeB.y - top.nodeA.y) < 0.5) ||
                        (Math.hypot(v.nodeB.x - bottom.nodeA.x, v.nodeB.y - bottom.nodeA.y) < 0.5 && Math.hypot(v.nodeA.x - top.nodeA.x, v.nodeA.y - top.nodeA.y) < 0.5)
                    );
                    const rightCol = vert.find(v => 
                        (Math.hypot(v.nodeA.x - bottom.nodeB.x, v.nodeA.y - bottom.nodeB.y) < 0.5 && Math.hypot(v.nodeB.x - top.nodeB.x, v.nodeB.y - top.nodeB.y) < 0.5) ||
                        (Math.hypot(v.nodeB.x - bottom.nodeB.x, v.nodeB.y - bottom.nodeB.y) < 0.5 && Math.hypot(v.nodeA.x - top.nodeB.x, v.nodeA.y - top.nodeB.y) < 0.5)
                    );

                    if (leftCol && rightCol) {
                        rooms.push({
                            bottomA: bottom.nodeA,
                            bottomB: bottom.nodeB,
                            topA: top.nodeA,
                            topB: top.nodeB,
                            floorLevel: Math.round(bottom.nodeA.y / 3.2)
                        });
                    }
                }
            }
        }
        return rooms;
    }
}
