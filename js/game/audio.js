/**
 * STRUCTON THE GAME - Proceduriell Ljudmotor (Web Audio API)
 * Genererar realistiska byggnadsljud, materialkollisioner, vädereffekter och katastrofljud i realtid.
 */

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.masterGain = null;

        // Kontinuerliga loopande ljudkällor
        this.windNode = null;
        this.windGain = null;
        this.earthquakeNode = null;
        this.earthquakeGain = null;
    }

    init() {
        if (this.ctx) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
            this.setupContinuousNodes();
        } catch (e) {
            console.warn('Web Audio API kunde inte initieras:', e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
        }
        return this.isMuted;
    }

    setupContinuousNodes() {
        if (!this.ctx) return;

        // 1. Vindgenerator (vitt brus + bandpassfilter)
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 350;
        windFilter.Q.value = 2.5;

        this.windGain = this.ctx.createGain();
        this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

        whiteNoise.connect(windFilter);
        windFilter.connect(this.windGain);
        this.windGain.connect(this.masterGain);
        whiteNoise.start();
        this.windNode = windFilter;

        // 2. Jordbävningsgenerator (sub-bass oscillator + rumble)
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(38, this.ctx.currentTime);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(45, this.ctx.currentTime);

        this.earthquakeGain = this.ctx.createGain();
        this.earthquakeGain.gain.setValueAtTime(0, this.ctx.currentTime);

        osc.connect(this.earthquakeGain);
        osc2.connect(this.earthquakeGain);
        this.earthquakeGain.connect(this.masterGain);
        osc.start();
        osc2.start();
        this.earthquakeNode = osc;
    }

    // UI-klick
    playClick() {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    // Placera balk / byggnadselement
    playPlaceMember(materialKey) {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const now = this.ctx.currentTime;

        if (materialKey === 'steel' || materialKey === 'strut_steel') {
            // Metallisk stålklang
            const osc = this.ctx.createOscillator();
            const oscHarmonic = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(540, now);
            oscHarmonic.type = 'triangle';
            oscHarmonic.frequency.setValueAtTime(1080, now);

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

            osc.connect(gain);
            oscHarmonic.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            oscHarmonic.start(now);
            osc.stop(now + 0.28);
            oscHarmonic.stop(now + 0.28);
        } else if (materialKey === 'wood' || materialKey === 'strut_wood') {
            // Trädunk
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);

            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.12);
        } else {
            // Betong / Tegel - tungt dovt ljud
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

            gain.gain.setValueAtTime(0.45, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.18);
        }
    }

    // Materialbrott / Knäckning
    playCrack(materialKey) {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const now = this.ctx.currentTime;

        // Snärtigt brottljud med brus
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = materialKey === 'steel' ? 'highpass' : 'bandpass';
        filter.frequency.value = materialKey === 'steel' ? 1800 : 750;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
    }

    // Raskrasch / Kollaps
    playCollapse() {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(95, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.8);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.8);
    }

    // Uppdatera vindljud
    updateWind(speed) {
        if (!this.windGain || !this.windNode || this.isMuted) return;
        const now = this.ctx.currentTime;
        if (speed <= 2) {
            this.windGain.gain.setTargetAtTime(0, now, 0.2);
        } else {
            const normalized = Math.min(1.0, speed / 40);
            const volume = 0.08 + normalized * 0.45;
            const freq = 200 + normalized * 650;
            this.windGain.gain.setTargetAtTime(volume, now, 0.15);
            this.windNode.frequency.setTargetAtTime(freq, now, 0.15);
        }
    }

    // Uppdatera jordbävningsmuller
    updateEarthquake(magnitude) {
        if (!this.earthquakeGain || this.isMuted) return;
        const now = this.ctx.currentTime;
        if (magnitude <= 0) {
            this.earthquakeGain.gain.setTargetAtTime(0, now, 0.2);
        } else {
            const normalized = Math.min(1.0, magnitude / 8.0);
            const volume = 0.1 + normalized * 0.6;
            this.earthquakeGain.gain.setTargetAtTime(volume, now, 0.1);
        }
    }

    // Åska / Blixtnedslag
    playThunder() {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const now = this.ctx.currentTime;

        const bufferSize = this.ctx.sampleRate * 1.5;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, now);
        filter.frequency.exponentialRampToValueAtTime(90, now + 1.2);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.75, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(now);
    }

    // Segerfanfar vid godkänd konstruktion
    playVictory() {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const noteTime = now + i * 0.12;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(0.3, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.6);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(noteTime);
            osc.stop(noteTime + 0.6);
        });
    }

    // Larmton vid kritisk överbelastning (>95% spänning)
    playAlarm() {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(660, now + 0.1);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
    }
}
