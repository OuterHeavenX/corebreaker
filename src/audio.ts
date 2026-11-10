import type { Settings } from './types';
type Cue = 'paddle' | 'hit' | 'armor' | 'fire' | 'ice' | 'lightning' | 'rescue' | 'scrap' | 'damage' | 'ability' | 'phase' | 'victory' | 'defeat' | 'launch';
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
    cue(name: Cue) {
        const c = this.ctx, b = this.effects;
        if (!c || !b || document.hidden)
            return;
        const now = c.currentTime;
        if (['hit', 'armor', 'paddle'].includes(name) && now - this.last < .025)
            return;
        this.last = now;
        const notes: Record<Cue, number[]> = { paddle: [360], hit: [210], armor: [110], fire: [160, 240], ice: [950, 1400], lightning: [680, 1300], rescue: [523, 659, 784], scrap: [880, 1174], damage: [120, 70], ability: [220, 440, 880], phase: [110, 165, 220], victory: [523, 659, 784, 1046], defeat: [220, 196, 147], launch: [220, 660] };
        notes[name].forEach((f, i) => this.tone(f, name === 'victory' ? .35 : .16, .45, b, ['armor', 'damage'].includes(name) ? 'sawtooth' : 'triangle', i * .065, name === 'hit' ? 65 : undefined));
    }
    private tick() { if (!this.ctx || this.ctx.state !== 'running' || !this.music || document.hidden || this.mode === 'silent')
        return; this.apply(); const s = this.step++, boss = this.mode === 'boss', menu = this.mode === 'menu', roots = [130.81, 103.83, 155.56, 116.54], root = roots[(Math.floor(s / 32) + this.region) % 4]; if (s % 8 === 0)
        this.tone(root / 2, 1.1, .35, this.music, 'triangle'); if (s % (menu ? 4 : 2) === 0) {
        const scale = [0, 7, 12, 15, 19, 12, 7, 3];
        this.tone(root * 2 ** (scale[s % 8] / 12), menu ? .55 : .24, .12, this.music, 'sine');
    } ; if (!menu && s % 4 === 0)
        this.tone(boss ? 110 : 80, .12, .45, this.music, 'sine', 0, 35); if (boss && s % 2 === 1)
        this.tone(1900, .035, .035, this.music, 'square'); }
    suspend() { void this.ctx?.suspend().catch(() => { }); }
}
export const audio = new Soundtrack();
