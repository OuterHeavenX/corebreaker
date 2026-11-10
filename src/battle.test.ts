import { vi, describe, it, expect } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {
        }, Math: { Clamp: (x: number, a: number, b: number) => Math.max(a, Math.min(b, x)) } } }));
import { BattleScene } from './game';
import { fresh, newRun } from './save';
function visual(x = 0, y = 0, w = 1, h = 1) { const o: any = { x, y, width: w, height: h, active: true, fillColor: 0xffffff }; for (const k of ['setStrokeStyle', 'setDepth', 'setOrigin', 'setPosition', 'setFillStyle', 'setAlpha', 'setVisible', 'setText', 'setName', 'clear', 'lineStyle', 'lineBetween', 'fillStyle', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'strokePath'])
    o[k] = () => o; o.destroy = () => { o.active = false; }; return o; }
function battle(stage = 1) { vi.stubGlobal('document', { hidden: false, addEventListener: () => { }, removeEventListener: () => { }, querySelector: () => null }); const s = new BattleScene(), progress = fresh(), run = newRun('campaign', 'guardian', 42); run.stage = stage; const clear = vi.fn(), over = vi.fn(); s.init({ progress, run, onHud: () => { }, onStageClear: clear, onGameOver: over, onPause: () => { }, toast: () => { } }); Object.assign(s, { cameras: { main: { setBackgroundColor: () => { } } }, add: { rectangle: visual, circle: visual, text: visual, triangle: visual, graphics: visual }, tweens: { add: () => { } }, input: { keyboard: { addKeys: () => ({ A: {}, D: {}, LEFT: {}, RIGHT: {} }), on: () => { } }, on: () => { } }, events: { once: () => { }, on: () => { } } }); s.create(); return { s, run, clear, over }; }
describe('live battle rules with rendering stubbed', () => {
    it('losing an auxiliary core does not damage shield; final loss relaunches safely', () => { const { s } = battle(); s.spawnBall(100, 800, 0, 300); s.loseBall(s.balls[1]); expect(s.shield).toBe(100); s.loseBall(s.balls[0]); expect(s.shield).toBe(82); expect(s.held).toBe(true); expect(s.balls).toHaveLength(1); });
    it('expired Aegis does not grant an indefinite catch', () => { const { s } = battle(); s.ability(); s.clock = 7; s.loseBall(s.balls[0]); expect(s.shield).toBe(82); });
    it('Aegis and failsafe are consumed independently', () => { const { s } = battle(); s.net = 1; s.ability(); s.loseBall(s.balls[0]); expect(s.shield).toBe(100); expect(s.abilityUntil).toBe(0); s.loseBall(s.balls[0]); expect(s.net).toBe(0); expect(s.shield).toBe(100); });
    it('multiball spawns once per stage', () => { const { s, run } = battle(); run.upgrades.multiball = 1; s.launch(); expect(s.balls).toHaveLength(2); s.held = true; s.launch(); expect(s.balls).toHaveLength(2); });
    it('projectile invulnerability prevents chain damage', () => { const { s } = battle(); s.damage(6, 'test'); s.damage(6, 'test'); expect(s.shield).toBe(94); s.clock = 1.3; s.damage(6, 'test'); expect(s.shield).toBe(88); });
    it('boss reactor is protected until armor dies, then defeat clears even with guns intact', () => { const { s, clear } = battle(5); const core = s.enemies.find(e => e.role === 'core')!; s.applyDamage(core, 999, true); expect(core.hp).toBe(28); for (const e of s.enemies.filter(e => e.role === 'plate'))
        s.applyDamage(e, 999, true); expect(s.bossPhase).toBe(2); s.applyDamage(core, 999, true); expect(s.bossDefeated).toBe(true); for (let i = 0; i < 500; i++)
        s.step(1 / 120); expect(clear).toHaveBeenCalledTimes(1); });
    it('fuel explosions do not recurse through adjacent cells', () => { const { s } = battle(); s.enemies.forEach(e => e.alive = false); const first = s.spawnEnemy('fuel', 100, 200, 1), second = s.spawnEnemy('fuel', 150, 200, 1), third = s.spawnEnemy('scout', 210, 200, 5); s.applyDamage(first, 2, true); expect(second.alive).toBe(false); expect(third.hp).toBe(5); });
    it('stage completion ignores optional targets and waits for capsule collection', () => { const { s, clear } = battle(); s.enemies.forEach(e => e.alive = false); s.spawnEnemy('scout', 100, 200, 3, undefined, false); s.drop(210, 300, 'rescue'); s.step(1 / 120); expect(clear).not.toHaveBeenCalled(); for (let i = 0; i < 500; i++)
        s.step(1 / 120); expect(clear).toHaveBeenCalledTimes(1); expect(s.rescueCount).toBe(1); });
    it('fast core hits a target instead of tunneling through', () => { const { s } = battle(); s.enemies.forEach(e => e.alive = false); const e = s.spawnEnemy('armored', 210, 250, 10); const b = s.balls[0]; Object.assign(b, { x: 210, y: 400, vx: 0, vy: -3000 }); s.moveBall(b, .1); expect(e.hp).toBeLessThan(10); expect(b.vy).toBeGreaterThan(0); });
    for (let stage = 1; stage <= 5; stage++)
        it(`seeded paddle bot can finish stage ${stage}`, () => { const { s, run, clear, over } = battle(stage); run.elements = ['fire', 'lightning']; run.upgrades = { damage: 2, charge: 1 }; for (let frame = 0; frame < 120 * 600 && !s.done; frame++) {
            if (s.held)
                s.launch();
            const b = s.balls[0];
            if (b && b.vy > 0) {
                const time = Math.max(0, (660 - b.y) / b.vy);
                let x = b.x + b.vx * time;
                const l = 14, r = 406, span = r - l;
                x = ((x - l) % (2 * span) + 2 * span) % (2 * span);
                x = l + (x > span ? 2 * span - x : x);
                const enemies = s.enemies.filter(e => e.alive && (!e.role || e.role !== 'core' || s.bossPhase === 2));
                const e = enemies.sort((a, c) => Math.abs(a.x - x) - Math.abs(c.x - x))[0];
                const offset = e ? Math.max(-.85, Math.min(.85, Math.atan2(e.x - x, 660 - e.y) / (Math.PI * .36))) : 0;
                s.target = x - offset * s.paddle.width / 2;
            }
            if (s.clock > s.abilityReady)
                s.ability();
            s.step(1 / 120);
        } expect(over).not.toHaveBeenCalled(); expect(clear).toHaveBeenCalledTimes(1); console.log(`Stage ${stage}: bot ${s.clock.toFixed(1)} simulated seconds, shield ${s.shield}`); });
});
