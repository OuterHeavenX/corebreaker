import type { Progress, RunState, Settings } from './types';
import { UPGRADES } from './data';
const KEY = 'corebreaker.save.v2', BACKUP = 'corebreaker.save.backup';
export const defaults: Settings = { music: .55, sfx: .7, shake: .35, reducedMotion: false, highContrast: false, largeCore: false, touchSensitivity: 1, directTouch: false, leftHanded: false, assistSpeed: false, assistWidth: false, assistBullets: false, crisp: true };
export const fresh = (): Progress => ({ version: 2, xp: 0, rank: 1, rescues: 0, campaignBest: 0, unlocks: ['guardian'], tutorials: [], settings: { ...defaults }, records: {}, selectedShip: 'guardian' });
export function validate(x: unknown): x is Progress { if (!x || typeof x !== 'object')
    return false; const p = x as any; const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0; if (![1, 2].includes(p.version) || !finite(p.xp) || !finite(p.rank) || !Array.isArray(p.unlocks))
    return false; if (p.records !== undefined && (!p.records || typeof p.records !== 'object' || Object.values(p.records).some(n => !finite(n))))
    return false; if (p.settings) {
    for (const [key, value] of Object.entries(p.settings)) {
        const d = (defaults as any)[key];
        if (d !== undefined && (typeof value !== typeof d || (typeof value === 'number' && !finite(value))))
            return false;
    }
} if (p.run) {
    const r = p.run;
    if (!['guardian', 'striker', 'magnetar'].includes(r.ship) || !['campaign', 'quick', 'daily', 'endless'].includes(r.mode) || !Number.isInteger(r.stage) || r.stage < 1 || !finite(r.shield) || !finite(r.scrap) || !finite(r.seed) || !Array.isArray(r.claimed) || !Array.isArray(r.elements) || r.elements.length > 2 || new Set(r.elements).size !== r.elements.length || r.elements.some((e: string) => !['fire', 'ice', 'lightning', 'kinetic'].includes(e)) || !r.upgrades || typeof r.upgrades !== 'object')
        return false;
    for (const [id, n] of Object.entries(r.upgrades)) {
        const u = UPGRADES.find(u => u.id === id);
        if (!u || !Number.isInteger(n) || (n as number) < 0 || (n as number) > u.maxRank)
            return false;
    }
    if (r.score !== undefined && !finite(r.score))
        return false;
    if (r.phase && !['battle', 'upgrade', 'shop'].includes(r.phase))
        return false;
    if (r.offers && (!Array.isArray(r.offers) || r.offers.some((id: string) => !UPGRADES.some(u => u.id === id))))
        return false;
} return true; }
function migrate(p: any): Progress { if (p.version === 1) {
    p.version = 2;
    p.records ??= {};
    p.selectedShip ??= 'guardian';
} return { ...fresh(), ...p, settings: { ...defaults, ...p.settings } }; }
export function load(): Progress { for (const key of [KEY, BACKUP]) {
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const x = JSON.parse(raw);
            if (validate(x))
                return migrate(x);
        }
    }
    catch { }
} return fresh(); }
export function save(p: Progress) { try {
    if (!validate(p))
        return false;
    const old = localStorage.getItem(KEY);
    if (old) {
        try {
            if (validate(JSON.parse(old)))
                localStorage.setItem(BACKUP, old);
        }
        catch { }
    }
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
}
catch {
    return false;
} }
export function newRun(mode: RunState['mode'], ship: RunState['ship'], seed = Date.now() >>> 0): RunState { return { mode, stage: 1, shield: 100, scrap: 0, ship, upgrades: {}, elements: [], seed, claimed: [] }; }
export function exportSave(p: Progress) { const b = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'corebreaker-save.json'; a.click(); URL.revokeObjectURL(a.href); }
export function importSave(text: string): Progress { const x = JSON.parse(text); if (!validate(x))
    throw new Error('Not a valid Corebreaker save.'); const p = migrate(x); save(p); return p; }
export function dailySeed(d = new Date()) { return Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`) >>> 0; }
