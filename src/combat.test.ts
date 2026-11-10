import { describe, it, expect } from 'vitest';
import { impact, choices, available, buy, maxShield } from './combat';
import type { Target } from './combat';
import { newRun } from './save';
import { sweep } from './physics';
const target = (): Target => ({ id: 1, hp: 20, armor: 2, chill: 0, frozen: 0, burn: 0, burnPower: 0, procAt: 0, boss: false });
describe('element combat', () => {
    it('burn and frost persist, boss freeze is shorter', () => { const r = newRun('campaign', 'guardian'); r.elements = ['fire', 'ice']; const t = target(); impact(t, r, 1, false, false, 1); expect(t.burn).toBe(4); r.elements = ['ice']; t.chill = 1; impact(t, r, 2, false, false, 1); expect(t.frozen).toBe(4.4); const boss = target(); boss.boss = true; boss.chill = 1; impact(boss, r, 2, false, false, 1); expect(boss.frozen).toBe(2.9); });
    for (const [elements, name] of [[['fire', 'ice'], 'THERMAL SHOCK'], [['ice', 'lightning'], 'CONDUCTIVE FREEZE'], [['fire', 'lightning'], 'PLASMA ARC'], [['kinetic', 'ice'], 'SHATTER IMPACT'], [['kinetic', 'fire'], 'BREACHING CHARGE'], [['kinetic', 'lightning'], 'RAIL SURGE']] as const) {
        it(`${name} triggers with prerequisites and obeys cooldown`, () => { const r = newRun('campaign', 'striker'); r.elements = [...elements]; const t = target(); t.frozen = 10; t.armor = 1; const hit = impact(t, r, 1, true, true, 1); expect(hit.proc).toBe(name); expect(hit.chains).toBeLessThanOrEqual(5); t.armor = 1; t.frozen = 10; expect(impact(t, r, 1.1, true, true, 1).proc).toBe(''); });
    }
    it('charged kinetic pierces armor and consumes no recursive effect path', () => { const r = newRun('campaign', 'striker'); r.elements = ['kinetic']; r.upgrades.pierce = 2; const t = target(); impact(t, r, 1, true, true, 1); expect(t.armor).toBe(0); });
});
describe('upgrades and shop transactions', () => {
    it('offers never include maxed, incompatible or unmet upgrades', () => { const r = newRun('campaign', 'guardian'); r.upgrades.wide = 3; const pool = available(r).map(x => x.id); expect(pool).not.toContain('wide'); expect(pool).not.toContain('burn'); expect(pool).not.toContain('hold'); expect(pool).not.toContain('overdrive'); expect(choices(r)).toEqual(choices(r)); });
    it('repair caps health, charges once and refuses full health', () => { const r = newRun('campaign', 'guardian'); r.scrap = 100; r.shield = 90; r.upgrades.repair = 1; expect(buy(r, 'repair')).toBe(true); expect(r.scrap).toBe(68); expect(r.shield).toBe(maxShield(r)); expect(buy(r, 'repair')).toBe(false); expect(r.scrap).toBe(68); });
    it('kit cannot be duplicated and unavailable upgrades cannot be purchased', () => { const r = newRun('campaign', 'guardian'); r.scrap = 100; expect(buy(r, 'consumable')).toBe(true); expect(buy(r, 'consumable')).toBe(false); expect(buy(r, 'upgrade', 'hold')).toBe(false); expect(r.scrap).toBe(70); });
    it('shield upgrade grants the advertised increased capacity', () => { const r = newRun('campaign', 'guardian'); r.scrap = 60; expect(buy(r, 'upgrade', 'shield')).toBe(true); expect(r.shield).toBe(110); expect(maxShield(r)).toBe(110); });
});
describe('swept collisions', () => {
    it('finds a thin target crossed entirely in one frame', () => { const hit = sweep(100, 0, 0, 2000, .1, 80, 50, 120, 55); expect(hit?.time).toBe(.025); expect(hit?.ny).toBe(-1); });
    it('rejects parallel paths outside the target', () => { expect(sweep(10, 0, 0, 2000, .1, 80, 50, 120, 55)).toBeNull(); });
    it('finds successive walls inside one step', () => { const a = sweep(50, 50, 1000, 0, .2, 100, 0, 110, 100)!; const x = 50 + 1000 * a.time; const b = sweep(x - .001, 50, -1000, 0, .2 - a.time, 0, 0, 10, 100)!; expect(a.time + b.time).toBeLessThan(.2); expect(b.nx).toBe(1); });
});
