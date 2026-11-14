import type { Settings } from './types';
type Cue = 'paddle' | 'hit' | 'armor' | 'fire' | 'ice' | 'lightning' | 'rescue' | 'scrap' | 'damage' | 'ability' | 'phase' | 'victory' | 'defeat' | 'launch' | 'power' | 'combo' | 'clang' | 'bolt' | 'portal' | 'wall' | 'boom' | 'bigboom';
/** Original, bounded Web Audio score. No downloads; starts only after a gesture. */
class Soundtrack {
    private ctx?: AudioContext;
    private music?: GainNode;
    private effects?: GainNode;
    private timer?: number;
    private step = 0;
    private voices = 0;
    private last = 0;
    settings?: Settings;
    mode: 'menu' | 'battle' | 'boss' | 'silent' = 'menu';
    region = 0;
    /** 0..1, driven by the live combo: adds hats and a doubled arpeggio to the battle score. */
    intensity = 0;
    private noiseBuffer?: AudioBuffer;
    private lastBoom = 0;
    unlock() { try {
        if (!this.ctx) {
            this.ctx = new AudioContext();
            const compressor = this.ctx.createDynamicsCompressor();
            compressor.threshold.value = -18;
            compressor.ratio.value = 8;
            compressor.connect(this.ctx.destination);
            this.music = this.ctx.createGain();
            this.effects = this.ctx.createGain();
            this.music.connect(compressor);
            this.effects.connect(compressor);
            this.timer = window.setInterval(() => this.tick(), 150);
        }
        void this.ctx.resume().catch(() => { });
        this.apply();
    }
    catch { } }
    apply() { if (this.music && this.effects) {
        this.music.gain.value = (this.settings?.music ?? .5) * .25;
        this.effects.gain.value = (this.settings?.sfx ?? .7) * .3;
    } }
    private tone(hz: number, duration: number, volume: number, bus: GainNode, type: OscillatorType = 'sine', delay = 0, endHz?: number) { const c = this.ctx; if (!c || c.state !== 'running' || this.voices >= 24)
        return; this.voices++; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay; o.type = type; o.frequency.setValueAtTime(hz, t); if (endHz)
        o.frequency.exponentialRampToValueAtTime(endHz, t + duration); g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(Math.max(.001, volume), t + .008); g.gain.exponentialRampToValueAtTime(.001, t + duration); o.connect(g); g.connect(bus); o.start(t); o.stop(t + duration + .02); o.onended = () => { o.disconnect(); g.disconnect(); this.voices--; }; }
    /** Filtered noise burst: the body of every explosion. */
    private noise(duration: number, volume: number, from: number, to: number) {
        const c = this.ctx, bus = this.effects;
        if (!c || !bus || c.state !== 'running' || this.voices >= 24)
            return;
        if (!this.noiseBuffer) {
            this.noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++)
                data[i] = Math.random() * 2 - 1;
        }
        this.voices++;
        const src = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
        src.buffer = this.noiseBuffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(from, t);
        filter.frequency.exponentialRampToValueAtTime(to, t + duration);
        g.gain.setValueAtTime(volume, t);
        g.gain.exponentialRampToValueAtTime(.001, t + duration);
        src.connect(filter);
        filter.connect(g);
        g.connect(bus);
        src.start(t, Math.random() * .5, duration + .02);
        src.onended = () => { src.disconnect(); filter.disconnect(); g.disconnect(); this.voices--; };
    }
    cue(name: Cue, pitch = 1) {
        const c = this.ctx, b = this.effects;
        if (!c || !b || document.hidden)
            return;
        const now = c.currentTime;
        if (name === 'boom' || name === 'bigboom') {
            const big = name === 'bigboom';
            if (!big && now - this.lastBoom < .05)
                return;
            this.lastBoom = now;
            this.noise(big ? .7 : .2, big ? .9 : .5, big ? 3200 : 2600, big ? 60 : 180);
            this.tone(big ? 75 : 130, big ? .5 : .14, big ? .9 : .5, b, 'sine', 0, big ? 28 : 45);
            return;
        }
        if (['hit', 'armor', 'paddle', 'bolt', 'clang'].includes(name) && now - this.last < (name === 'bolt' ? .09 : .025))
            return;
        this.last = now;
        const notes: Record<Cue, number[]> = { paddle: [360], hit: [210], armor: [110], fire: [160, 240], ice: [950, 1400], lightning: [680, 1300], rescue: [523, 659, 784], scrap: [880, 1174], damage: [120, 70], ability: [220, 440, 880], phase: [110, 165, 220], victory: [523, 659, 784, 1046], defeat: [220, 196, 147], launch: [220, 660], power: [392, 523, 784, 1046], combo: [659, 880, 1318], clang: [1250, 830], bolt: [990], portal: [300, 900], wall: [180, 360], boom: [], bigboom: [] };
        notes[name].forEach((f, i) => this.tone(f * pitch, name === 'victory' ? .35 : name === 'bolt' ? .06 : .16, name === 'bolt' ? .14 : .45, b, ['armor', 'damage'].includes(name) ? 'sawtooth' : 'triangle', i * .065, name === 'hit' ? 65 : undefined));
    }
    private tick() { if (!this.ctx || this.ctx.state !== 'running' || !this.music || document.hidden || this.mode === 'silent')
        return; this.apply(); const s = this.step++, boss = this.mode === 'boss', menu = this.mode === 'menu', roots = [130.81, 103.83, 155.56, 116.54], root = roots[(Math.floor(s / 32) + this.region) % 4]; if (s % 8 === 0)
        this.tone(root / 2, 1.1, .35, this.music, 'triangle'); if (s % (menu ? 4 : 2) === 0) {
        const scale = [0, 7, 12, 15, 19, 12, 7, 3];
        this.tone(root * 2 ** (scale[s % 8] / 12), menu ? .55 : .24, .12, this.music, 'sine');
    } ; if (!menu && s % 4 === 0)
        this.tone(boss ? 110 : 80, .12, .45, this.music, 'sine', 0, 35); if (boss && s % 2 === 1)
        this.tone(1900, .035, .035, this.music, 'square'); if (!menu && this.intensity > .5) {
        if (s % 2 === 1)
            this.tone(5200, .03, .03 + .03 * this.intensity, this.music, 'square');
        if (s % 4 === 2)
            this.tone(80, .1, .4, this.music, 'sine', 0, 35);
        this.tone(root * 2 ** (([0, 7, 12, 15, 19, 12, 7, 3][(s + 3) % 8] + 12) / 12), .12, .07 * this.intensity, this.music, 'triangle');
    } }
    suspend() { void this.ctx?.suspend().catch(() => { }); }
}
export const audio = new Soundtrack();
