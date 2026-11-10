import { beforeEach, it, expect, vi } from 'vitest';
import { fresh, newRun, save, load, validate, importSave } from './save';
beforeEach(() => { const data = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) }); });
it('persists pending upgrade offers and claimed reward ledger', () => { const p = fresh(); p.run = newRun('campaign', 'guardian'); Object.assign(p.run, { phase: 'upgrade', offers: ['wide', 'damage'], claimed: ['campaign:1'], scrap: 40 }); expect(save(p)).toBe(true); expect(load().run).toEqual(p.run); });
it('keeps shop spending and purchased stock through reload', () => { const p = fresh(); p.run = newRun('campaign', 'guardian'); Object.assign(p.run, { phase: 'shop', offers: ['wide'], shopBought: true, shopRerolls: 2, scrap: 15, consumable: true }); save(p); expect(load().run).toEqual(p.run); });
it('recovers the valid backup after malformed JSON', () => { const p = fresh(); save(p); p.xp = 25; save(p); localStorage.setItem('corebreaker.save.v2', '{bad'); expect(load().xp).toBe(0); });
it('rejects impossible or malformed imported builds', () => { const p = fresh(); p.run = newRun('campaign', 'guardian'); p.run.upgrades.wide = 999; expect(validate(p)).toBe(false); expect(() => importSave(JSON.stringify(p))).toThrow(); });
it('migrates old progress and retains unlocks', () => { const p: any = fresh(); p.version = 1; delete p.settings; const loaded = importSave(JSON.stringify(p)); expect(loaded.version).toBe(2); expect(loaded.settings.sfx).toBe(.7); });
