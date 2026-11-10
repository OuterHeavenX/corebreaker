import { UPGRADES } from './data';
import { RNG } from './sim';
import type { Element, RunState } from './types';
export const rank = (r: RunState, id: string) => r.upgrades[id] ?? 0;
export const maxShield = (r: RunState) => 100 + 10 * rank(r, 'shield');
export const synergyName = (e: Element[]) => ({ 'fire+ice': 'THERMAL SHOCK', 'ice+lightning': 'CONDUCTIVE FREEZE', 'fire+lightning': 'PLASMA ARC', 'ice+kinetic': 'SHATTER IMPACT', 'fire+kinetic': 'BREACHING CHARGE', 'kinetic+lightning': 'RAIL SURGE' }[[...e].sort().join('+')] ?? '');
export interface Target {
    id: number;
    hp: number;
    armor: number;
    chill: number;
    frozen: number;
    burn: number;
    burnPower: number;
    procAt: number;
    boss: boolean;
}
export interface HitResult {
    damage: number;
    burst: number;
    chains: number;
    plasma: boolean;
    pierce: number;
    proc: string;
}
export function impact(t: Target, r: RunState, now: number, charged: boolean, precision: boolean, roll: number): HitResult {
    const has = (e: Element) => r.elements.includes(e), wasFrozen = t.frozen > now, oldArmor = t.armor;
    let damage = (1 + rank(r, 'damage') * .2) * (charged ? 1.5 + .25 * rank(r, 'charge') : 1);
    if (has('kinetic'))
        damage *= 1.2;
    if (precision && roll < Math.min(.75, (has('kinetic') ? .15 : 0) + rank(r, 'crit') * .15))
        damage *= 2;
    if (wasFrozen)
        damage *= 1 + rank(r, 'shatter') * .35;
    const penetration = (has('kinetic') ? 1 : 0) + (charged ? rank(r, 'pierce') : 0);
    t.armor = Math.max(0, t.armor - 1 - penetration);
    if (oldArmor > 0 && penetration === 0)
        damage *= .65;
    if (has('ice')) {
        t.chill += 1 + rank(r, 'freeze') * .25;
        if (t.chill >= 2) {
            t.frozen = now + (t.boss ? .9 : 2.4);
            t.chill = 0;
        }
    }
    if (has('fire')) {
        t.burn = now + 3 + rank(r, 'burn') * 1.5;
        t.burnPower = .45;
    }
    const out: HitResult = { damage, burst: 0, chains: has('lightning') ? 1 + rank(r, 'chain') : 0, plasma: false, pierce: 0, proc: '' };
    if (now >= t.procAt && r.elements.length === 2) {
        const name = synergyName(r.elements);
        let triggered = false;
        if (name === 'THERMAL SHOCK' && (wasFrozen || t.frozen > now)) {
            out.burst = 1.2;
            t.chill = 0;
            t.frozen = 0;
            triggered = true;
        }
        if (name === 'CONDUCTIVE FREEZE' && (wasFrozen || t.frozen > now)) {
            out.chains = Math.min(5, out.chains + 2);
            triggered = true;
        }
        if (name === 'PLASMA ARC') {
            out.plasma = true;
            triggered = true;
        }
        if (name === 'SHATTER IMPACT' && wasFrozen && precision) {
            out.damage += 2;
            triggered = true;
        }
        if (name === 'BREACHING CHARGE' && oldArmor > 0 && t.armor === 0) {
            out.burst = 1.5;
            triggered = true;
        }
        if (name === 'RAIL SURGE' && charged) {
            out.pierce = 2;
            triggered = true;
        }
        if (triggered) {
            out.proc = name;
            t.procAt = now + 1.2 * (rank(r, 'apex') ? .8 : 1);
        }
    }
    return out;
}
export function available(r: RunState) { return UPGRADES.filter(u => rank(r, u.id) < u.maxRank && (u.id !== 'apex' || r.elements.length === 2) && (!u.prereq || !!r.upgrades[u.prereq] || r.elements.some(e => u.prereq === `element-${e}`)) && (!['barrier', 'overdrive', 'hold'].includes(u.id) || ({ barrier: 'guardian', overdrive: 'striker', hold: 'magnetar' }[u.id] === r.ship))); }
export function choices(r: RunState, salt = 0) { const rng = new RNG(r.seed + r.stage * 997 + salt), pool = available(r), out = []; while (pool.length && out.length < 3) {
    const weights = pool.map(u => ({ COMMON: 6, RARE: 3, EPIC: 1 }[u.rarity]) * (u.tags.some(t => r.elements.includes(t as Element)) ? 1.3 : 1));
    let n = rng.next() * weights.reduce((a, b) => a + b, 0), i = 0;
    while (i < weights.length - 1 && n >= weights[i])
        n -= weights[i++];
    out.push(pool.splice(i, 1)[0]);
} return out; }
export function buy(r: RunState, item: 'repair' | 'upgrade' | 'consumable', id?: string) { const cost = item === 'repair' ? Math.ceil(40 * (1 - .2 * rank(r, 'repair'))) : item === 'upgrade' ? 60 : 30; if (r.scrap < cost)
    return false; if (item === 'repair') {
    if (r.shield >= maxShield(r))
        return false;
    r.shield = Math.min(maxShield(r), r.shield + 35);
}
else if (item === 'upgrade') {
    const u = available(r).find(u => u.id === id);
    if (!u)
        return false;
    r.upgrades[u.id] = (r.upgrades[u.id] ?? 0) + 1;
    if (u.id === 'shield')
        r.shield += 10;
}
else {
    if (r.consumable)
        return false;
    r.consumable = true;
} r.scrap -= cost; return true; }
