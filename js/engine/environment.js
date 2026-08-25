/**
 * STRUCTON THE GAME - Miljö- och Katastrofmotor
 * Simulerar vindprofiler, stormbyar, ösregn, jordbävningar (Richter) och jordskred.
 */

import { SOIL_TYPES } from './materials.js';

export class EnvironmentEngine {
    constructor() {
        // Väder- och katastrofparametrar
        this.windSpeed = 0;       // m/s vid marknivå
        this.windGusts = 0;       // Turbulensfaktor 0 - 1
        this.rainIntensity = 0;   // 0.0 - 1.0
        this.earthquakeMagnitude = 0; // 0 - 9 på Richterskalan
        this.landslideActive = false; // Jordskred aktivt
        this.landslideProgress = 0;   // 0 -> 1.0

        // Tidsvariabler och vågform
        this.time = 0;
        this.earthquakeTime = 0;
        this.lightningFlash = 0;
        this.nextLightningIn = 4.0;
        
        // Markrörelser för rendering och seismograf
        this.groundOffsetX = 0;
        this.groundOffsetY = 0;
        this.seismicWaveHistory = new Array(100).fill(0);

        // Partikelsystem för regn och vindstråk
        this.rainDrops = [];
        this.windStreaks = [];
        this.maxRainDrops = 180;
        this.maxWindStreaks = 40;

        // Callback för blixt och jordbävning (ljudtriggar)
        this.onLightning = null;
        this.onEarthquakeStep = null;
        this.terrain = null;
    }

    reset() {
        this.windSpeed = 0;
        this.windGusts = 0;
        this.rainIntensity = 0;
        this.earthquakeMagnitude = 0;
        this.landslideActive = false;
        this.landslideProgress = 0;
        this.time = 0;
        this.earthquakeTime = 0;
        this.lightningFlash = 0;
        this.groundOffsetX = 0;
        this.groundOffsetY = 0;
        this.seismicWaveHistory.fill(0);
        this.rainDrops = [];
        this.windStreaks = [];
    }

    setDisasterLevels({ wind = 0, rain = 0, earthquake = 0, landslide = false }) {
        this.windSpeed = wind;
        this.windGusts = wind > 15 ? 0.35 : 0.1;
        this.rainIntensity = rain;
        this.earthquakeMagnitude = earthquake;
        this.landslideActive = landslide;
    }

    update(dt) {
        this.time += dt;

        // 1. Jordbävningsdynamik (Seismisk våg)
        if (this.earthquakeMagnitude > 0) {
            this.earthquakeTime += dt;
            const mag = this.earthquakeMagnitude;
            // Grundamplitud baserat på magnitud
            const ampX = (Math.pow(10, mag * 0.45) * 0.0008) * Math.min(1.0, this.earthquakeTime * 0.8);
            const ampY = ampX * 0.35; // Vertikal P-våg

            // Två harmoniska frekvenser för att skapa kaotisk markskakning
            const freq1 = 2.2 * Math.PI; // 1.1 Hz
            const freq2 = 5.8 * Math.PI; // 2.9 Hz

            const waveX = Math.sin(this.time * freq1) * 0.7 + Math.sin(this.time * freq2 + 1.2) * 0.3;
            const waveY = Math.cos(this.time * freq1 * 1.3) * 0.5 + Math.sin(this.time * freq2 * 1.7) * 0.5;

            this.groundOffsetX = waveX * ampX;
            this.groundOffsetY = waveY * ampY;

            // Uppdatera seismograf
            this.seismicWaveHistory.shift();
            this.seismicWaveHistory.push(this.groundOffsetX * 20);

            if (this.onEarthquakeStep && Math.random() < 0.15) {
                this.onEarthquakeStep(mag);
            }
        } else {
            this.groundOffsetX *= 0.85;
            this.groundOffsetY *= 0.85;
            this.seismicWaveHistory.shift();
            this.seismicWaveHistory.push(0);
        }

        // 2. Jordskredsutveckling
        if (this.landslideActive) {
            this.landslideProgress = Math.min(1.0, this.landslideProgress + dt * 0.12);
        } else {
            this.landslideProgress = Math.max(0, this.landslideProgress - dt * 0.2);
        }

        // 3. Blixt- och åskcykel vid storm
        if (this.rainIntensity > 0.6 && this.windSpeed > 20) {
            this.nextLightningIn -= dt;
            if (this.nextLightningIn <= 0) {
                this.lightningFlash = 1.0;
                this.nextLightningIn = 3.0 + Math.random() * 6.0;
                if (this.onLightning) {
                    this.onLightning();
                }
            }
        }
        if (this.lightningFlash > 0) {
            this.lightningFlash = Math.max(0, this.lightningFlash - dt * 4.0);
        }

        // 4. Uppdatera regndroppar och vindstråk
        this.updateParticles(dt);
    }

    updateParticles(dt) {
        // Regndroppar
        const targetRain = Math.floor(this.rainIntensity * this.maxRainDrops);
        while (this.rainDrops.length < targetRain) {
            this.rainDrops.push({
                x: (Math.random() - 0.2) * 80, // m
                y: 10 + Math.random() * 90,    // m
                speed: 25 + Math.random() * 15,
                length: 0.8 + Math.random() * 0.8
            });
        }
        while (this.rainDrops.length > targetRain) {
            this.rainDrops.pop();
        }

        const rainAngle = Math.atan2(-30, this.windSpeed * 0.8);
        for (const drop of this.rainDrops) {
            drop.x += this.windSpeed * 0.6 * dt;
            drop.y -= drop.speed * dt;
            if (drop.y < (this.terrain ? this.terrain.surfaceY(drop.x) : 0)) {
                drop.y = 80 + Math.random() * 20;
                drop.x = (Math.random() - 0.2) * 80;
            }
        }

        // Vindstråk
        const targetWind = Math.min(this.maxWindStreaks, Math.floor((this.windSpeed / 40) * this.maxWindStreaks));
        while (this.windStreaks.length < targetWind) {
            this.windStreaks.push({
                x: -20 + Math.random() * 10,
                y: 5 + Math.random() * 85,
                speed: this.windSpeed * (1.2 + Math.random() * 0.6),
                length: 4 + Math.random() * 8,
                alpha: 0.15 + Math.random() * 0.25
            });
        }
        while (this.windStreaks.length > targetWind) {
            this.windStreaks.pop();
        }

        for (const streak of this.windStreaks) {
            streak.x += streak.speed * dt;
            if (streak.x > 80) {
                streak.x = -20 - Math.random() * 10;
                streak.y = 5 + Math.random() * 85;
            }
        }
    }

    applyForces(nodes, members, dt) {
        // 1. Vindkrafter på noder
        // Vindprofil: v(z) = v_0 * (1 + 0.3 * ln(1 + z/10))
        // Dynamiskt vindtryck: q = 0.5 * rho_air * v²  (rho = 1.25 kg/m³)
        const gustFactor = 1.0 + Math.sin(this.time * 2.5) * this.windGusts * 0.4 + Math.sin(this.time * 6.2) * this.windGusts * 0.2;

        if (this.windSpeed > 0) {
            for (const n of nodes) {
                if (n.y > 0) {
                    const heightFactor = 1.0 + 0.28 * Math.log(1 + Math.max(0, n.y) / 8.0);
                    const localWindSpeed = this.windSpeed * heightFactor * gustFactor;
                    const dynamicPressure = 0.5 * 1.25 * localWindSpeed * localWindSpeed; // N/m²

                    // Vindfångsarea per nod (baserat på anslutna element och våningshöjd)
                    const tributaryArea = 1.8 * 1.5; // Ca 2.7 m² yta per nod
                    const dragCoeff = 1.2; // Aerodynamisk formfaktor för rätblock

                    const fWind = dynamicPressure * tributaryArea * dragCoeff;
                    n.fx += fWind;
                }
            }
        }

        // 2. Regnvikt på tak och horisontella balkar
        if (this.rainIntensity > 0) {
            for (const m of members) {
                if (m.isBroken) continue;
                const dy = Math.abs(m.nodeB.y - m.nodeA.y);
                const dx = Math.abs(m.nodeB.x - m.nodeA.x);
                if (dy < 0.3 && dx > 0.5) { // Horisontellt element / bjälklag / tak
                    // Regnvattenansamling
                    const rainLoadPerMeter = this.rainIntensity * 350; // N/m
                    const totalRainLoad = rainLoadPerMeter * dx;
                    m.nodeA.fy -= totalRainLoad * 0.5;
                    m.nodeB.fy -= totalRainLoad * 0.5;
                }
            }
        }

        // 3. Jordbävningsacceleration & markförskjutning
        if (this.earthquakeMagnitude > 0) {
            for (const n of nodes) {
                const onGround = n.fixed || n.isGroundAnchor || n.isBedrockPinned
                    || (this.terrain && n.y <= this.terrain.surfaceY(n.x) + 0.35)
                    || (!this.terrain && n.y <= 0);
                if (onGround) {
                    n.x = n.initialX + this.groundOffsetX;
                    n.y = n.initialY + this.groundOffsetY;
                }
            }
        }

        // 4. Jordskredsmekanik (Landslide)
        if (this.landslideProgress > 0) {
            const slideDistanceX = this.landslideProgress * 3.5; // m glidning i sidled
            const slideDistanceY = -this.landslideProgress * 1.8; // m sättning nedåt

            for (const n of nodes) {
                // Endast noder i känslig lera som INTE är pålade till berg
                if (n.soilType === 'soft_clay' && !n.isBedrockPinned) {
                    // Skredet drar med sig grunden om inte pålar når berggrund
                    if (n.fixed) {
                        n.x = n.initialX + slideDistanceX;
                        n.y = n.initialY + slideDistanceY;
                    } else {
                        n.fx += 25000 * this.landslideProgress;
                        n.fy -= 18000 * this.landslideProgress;
                    }
                }
            }
        }
    }
}
