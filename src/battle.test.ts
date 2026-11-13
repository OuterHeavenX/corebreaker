import { vi, describe, it, expect } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {
        }, Math: { Clamp: (x: number, a: number, b: number) => Math.max(a, Math.min(b, x)) } } }));
import { BattleScene } from './game';
import { fresh, newRun } from './save';
import { comboMultiplier, enemyHp } from './data';
function visual(x = 0, y = 0, w = 1, h = 1) { const o: any = { x, y, width: w, height: h, active: true, fillColor: 0xffffff }; for (const k of ['setStrokeStyle', 'setDepth', 'setOrigin', 'setPosition', 'setFillStyle', 'setAlpha', 'setVisible', 'setText', 'setName', 'clear', 'lineStyle', 'lineBetween', 'fillStyle', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'strokePath', 'setRounded', 'setBlendMode', 'setScale', 'setSize', 'fillCircle', 'strokeCircle', 'fillTriangle', 'fillPoints', 'strokePoints', 'setResolution', 'setStroke', 'setFontStyle', 'setColor', 'setTexture', 'setTint', 'clearTint', 'setTintFill', 'setDisplaySize', 'setRotation', 'strokeRect', 'strokeRoundedRect', 'arc'])
    o[k] = () => o; o.destroy = () => { o.active = false; }; return o; }
function battle(stage = 1) { vi.stubGlobal('document', { hidden: false, addEventListener: () => { }, removeEventListener: () => { }, querySelector: () => null }); const s = new BattleScene(), progress = fresh(), run = newRun('campaign', 'guardian', 42); run.stage = stage; const clear = vi.fn(), over = vi.fn(); s.init({ progress, run, onHud: () => { }, onStageClear: clear, onGameOver: over, onPause: () => { }, toast: () => { } }); Object.assign(s, { cameras: { main: { setBackgroundColor: () => { }, shake: () => { }, setZoom: () => { }, centerOn: () => { } } }, add: { rectangle: visual, circle: visual, text: visual, triangle: visual, graphics: visual, image: visual }, tweens: { add: () => { }, killTweensOf: () => { } }, input: { keyboard: { addKeys: () => ({ A: {}, D: {}, LEFT: {}, RIGHT: {} }), on: () => { } }, on: () => { } }, events: { once: () => { }, on: () => { } } }); s.create(); return { s, run, clear, over }; }
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
    it('scouts fall in one hit early and targets toughen by region and endless loop', () => { expect(enemyHp('scout', 1)).toBe(1); expect(enemyHp('scout', 6)).toBe(2); expect(enemyHp('armored', 1)).toBe(3); expect(enemyHp('armored', 16)).toBe(6); expect(enemyHp('armored', 21)).toBeGreaterThan(enemyHp('armored', 1)); expect(battle(1).s.enemies[0].max).toBe(1); });
    it('every eighth combo hit and the pity counter both pay out a power capsule', () => { const { s } = battle(); s.held = false; for (let i = 0; i < 8; i++)
        s.addCombo(100, 200); expect(s.drops.filter(d => d.kind === 'power')).toHaveLength(1); const { s: t } = battle(); t.sincePower = 10; const e = t.enemies[0]; t.applyDamage(e, 99, true); expect(t.drops.some(d => d.kind === 'power')).toBe(true); expect(t.sincePower).toBe(0); });
    it('power capsules apply their effect when caught', () => { const { s } = battle(); s.held = false; s.balls[0].vy = -300; for (const id of ['wide', 'blaster', 'overcharge', 'barrier'] as const)
        s.applyPower(id); expect(s.wideUntil).toBe(12); expect(s.blasterUntil).toBe(7); expect(s.overUntil).toBe(6); expect(s.wallUntil).toBe(9); s.applyPower('split'); expect(s.balls).toHaveLength(2); for (let i = 0; i < 6; i++)
        s.applyPower('split'); expect(s.balls).toHaveLength(5); });
    it('a split caught while holding the core triggers on the next launch', () => { const { s } = battle(); s.applyPower('split'); expect(s.balls).toHaveLength(1); s.launch(); expect(s.balls).toHaveLength(2); });
    it('energy wall bounces a falling core instead of losing it', () => { const { s } = battle(); s.held = false; s.wallUntil = 99; const b = s.balls[0]; Object.assign(b, { x: 30, y: 690, vx: 0, vy: 400 }); s.target = 300; s.paddle.x = 300; s.moveBall(b, .1); expect(b.vy).toBeLessThan(0); expect(s.balls).toHaveLength(1); expect(s.shield).toBe(100); });
    it('overcharged core punches through a kill but still rebounds off a survivor', () => { const { s } = battle(); s.held = false; s.enemies.forEach(e => e.alive = false); s.overUntil = 99; const weak = s.spawnEnemy('scout', 210, 300, 1), tough = s.spawnEnemy('armored', 210, 200, 50); const b = s.balls[0]; Object.assign(b, { x: 210, y: 400, vx: 0, vy: -350 }); for (let i = 0; i < 40 && b.vy < 0; i++)
        s.moveBall(b, 1 / 60); expect(weak.alive).toBe(false); expect(tough.hp).toBeLessThan(50); expect(tough.alive).toBe(true); expect(b.vy).toBeGreaterThan(0); });
    it('blaster bolts damage targets and stop at steel bumpers', () => { const { s } = battle(); s.enemies.forEach(e => e.alive = false); const e = s.spawnEnemy('scout', 100, 200, 5), bumper = s.spawnBumper(300, 300), behind = s.spawnEnemy('scout', 300, 200, 5); s.bolts.push({ x: 100, y: 400 }, { x: 300, y: 400 }); for (let i = 0; i < 120; i++)
        s.boltStep(1 / 120); expect(e.hp).toBeLessThan(5); expect(behind.hp).toBe(5); expect(bumper.alive).toBe(true); expect(s.bolts).toHaveLength(0); });
    it('steel bumpers deflect the core, cannot be destroyed and are not required', () => { const { s, clear } = battle(6); const bumper = s.enemies.find(e => e.solid)!; s.applyDamage(bumper, 999, true); expect(bumper.alive).toBe(true); const b = s.balls[0]; s.held = false; Object.assign(b, { x: bumper.x, y: bumper.y + 60, vx: 0, vy: -350 }); s.moveBall(b, .2); expect(b.vy).toBeGreaterThan(0); expect(s.combo).toBe(0); s.enemies.filter(e => !e.solid).forEach(e => e.alive = false); for (let i = 0; i < 300; i++)
        s.step(1 / 120); expect(clear).toHaveBeenCalledTimes(1); });
    it('a target that slides over the core pushes it out and takes the hit', () => { const { s } = battle(); s.held = false; s.enemies.forEach(e => e.alive = false); const e = s.spawnEnemy('armored', 210, 300, 10); const b = s.balls[0]; Object.assign(b, { x: 190, y: 302, vx: 300, vy: -100 }); s.moveBall(b, 1 / 120); expect(e.hp).toBeLessThan(10); expect(b.x).toBeLessThan(e.x - e.w / 2); expect(b.vx).toBeLessThan(0); });
    it('portals relocate the core and plasma lanes punish a stationary ship', () => { const { s } = battle(11); expect(s.portals).toHaveLength(2); s.held = false; const b = s.balls[0]; Object.assign(b, { x: s.portals[0].x - 30, y: s.portals[0].y, vx: 300, vy: -80 }); for (let i = 0; i < 20 && b.portalAt === 0; i++)
        s.moveBall(b, 1 / 120); expect(Math.abs(b.x - s.portals[1].x)).toBeLessThan(10); const { s: p } = battle(9); expect(p.lanesOn).toBe(true); p.held = false; p.balls[0].vy = -1; p.balls[0].y = 400; p.nextLane = 0; for (let i = 0; i < 200 && p.shield === 100; i++) {
        p.balls[0].y = 400;
        p.hazardStep(p.paddle.width / 2);
        p.clock += 1 / 120;
    } expect(p.shield).toBe(94); });
    it('gravity wells bend the core without changing its speed', () => { const { s } = battle(13); s.held = false; s.enemies.forEach(e => e.alive = false); const b = s.balls[0]; Object.assign(b, { x: 120, y: 600, vx: 0, vy: -350 }); for (let i = 0; i < 30; i++)
        s.moveBall(b, 1 / 120); expect(b.vx).toBeGreaterThan(0); expect(Math.abs(Math.hypot(b.vx, b.vy) - 350)).toBeLessThan(.001); });
    it('later bosses are tougher and differentiated; the first is unchanged', () => { const hp = (stage: number) => battle(stage).s.enemies.find(e => e.role === 'core')!.max; expect(hp(5)).toBe(28); expect(hp(10)).toBe(34); expect(hp(15)).toBe(42); expect(hp(20)).toBe(56); expect(hp(25)).toBeGreaterThan(28); expect(battle(20).s.enemies.filter(e => e.role === 'plate')).toHaveLength(3); expect(battle(10).s.lanesOn).toBe(true); });
    it('a core rallying in an empty column is re-aimed off the paddle', () => { const { s } = battle(); s.held = false; s.enemies.forEach(e => e.alive = false); const e = s.spawnEnemy('scout', 60, 120, 5); const b = s.balls[0]; s.paddle.x = s.target = 300; Object.assign(b, { x: 300, y: 600, vx: 0, vy: 350 }); s.clock = 10; s.moveBall(b, .5); expect(b.vx).toBeLessThan(-50); for (let i = 0; i < 400 && e.hp === 5; i++)
        s.moveBall(b, 1 / 120); expect(e.hp).toBeLessThan(5); });
    it('score rewards combos and is saved with the run', () => { const { s, run } = battle(); expect(comboMultiplier(0)).toBe(1); expect(comboMultiplier(10)).toBe(2); expect(comboMultiplier(999)).toBe(5); s.combo = 10; s.addScore(50); expect(s.score).toBe(100); s.sync(); expect(run.score).toBe(100); });
    it('losing the last core breaks the combo; a cored bullet is destroyed', () => { const { s } = battle(); s.combo = 9; s.comboUntil = 99; s.loseBall(s.balls[0]); expect(s.combo).toBe(0); s.held = false; s.enemies.forEach(e => e.alive = false); s.spawnEnemy('armored', 60, 120, 99); const b = s.balls[0]; Object.assign(b, { x: 300, y: 400, vx: 0, vy: -100 }); s.bullets.push({ x: 300, y: 396, vx: 0, vy: 0, view: visual() }); s.step(1 / 120); expect(s.bullets).toHaveLength(0); expect(s.shield).toBe(82); });
    for (const stage of [6, 9, 11, 13, 16, 10, 20])
        it(`seeded paddle bot survives a full minute of stage ${stage} without errors`, () => { const { s, run } = battle(stage); run.elements = ['fire', 'lightning']; run.upgrades = { damage: 3, charge: 1, wide: 2, shield: 3 }; s.shield = 130; for (let frame = 0; frame < 120 * 60 && !s.done; frame++) {
            if (s.held)
                s.launch();
            const b = s.balls.filter(b => b.vy > 0).sort((a, c) => c.y - a.y)[0];
            if (b)
                s.target = b.x + b.vx * Math.max(0, (660 - b.y) / b.vy) * .9;
            s.step(1 / 120);
            for (const ball of s.balls)
                expect(Number.isFinite(ball.x + ball.y + ball.vx + ball.vy)).toBe(true);
        } expect(s.score).toBeGreaterThan(0); console.log(`Stage ${stage}: ${s.done ? 'finished' : 'running'} at ${s.clock.toFixed(1)}s, shield ${s.shield}, score ${s.score}, targets left ${s.enemies.filter(e => e.alive && e.required).length}`); });
});
