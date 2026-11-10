import Phaser from 'phaser';
import { ELEMENTS, SHIPS, STAGES, SYMBOL_TO_ENEMY } from './data';
import { rebound, RNG } from './sim';
import { impact, rank, maxShield, synergyName } from './combat';
import type { Target } from './combat';
import { audio } from './audio';
import type { EnemyType, Progress, RunState, StageDef } from './types';
export { choices } from './combat';
export const synergy = synergyName;
type Host = {
    progress: Progress;
    run: RunState;
    onHud: (h: any) => void;
    onStageClear: () => void;
    onGameOver: () => void;
    onPause: () => void;
    toast: (s: string) => void;
};
const W = 420, H = 760, PY = 674;
const COLORS: Record<EnemyType, number> = { scout: 0xff8a4c, armored: 0x9aa7b8, shield: 0x7d7aff, repair: 0x65e6a7, gunship: 0xff554f, mine: 0xcf6fff, interceptor: 0xffcb5c, reflector: 0xe5f5ff, conductive: 0xfff17a, fuel: 0xff7a32, prison: 0x58e5ff, command: 0xf65cbf };
type Ball = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    view: Phaser.GameObjects.Arc;
    charged: boolean;
    precision: boolean;
    pierce: number;
    hits: number;
    lastHit: number;
    lastEnemy: number;
    trail: number[];
};
type Enemy = Target & {
    x: number;
    y: number;
    baseX: number;
    w: number;
    h: number;
    type: EnemyType;
    view: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    max: number;
    nextShot: number;
    telegraph: number;
    role?: 'gun' | 'plate' | 'core';
    required: boolean;
    alive: boolean;
};
type Drop = {
    x: number;
    y: number;
    kind: 'rescue' | 'scrap';
    second: boolean;
    view: Phaser.GameObjects.Text;
};
type Bullet = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    view: Phaser.GameObjects.Triangle;
};
import { sweep } from './physics';
export class BattleScene extends Phaser.Scene {
    host!: Host;
    stage!: StageDef;
    rng!: RNG;
    paddle!: Phaser.GameObjects.Rectangle;
    aim!: Phaser.GameObjects.Graphics;
    fx!: Phaser.GameObjects.Graphics;
    hud!: Phaser.GameObjects.Text;
    bossText!: Phaser.GameObjects.Text;
    shieldBar!: Phaser.GameObjects.Rectangle;
    hull?: Phaser.GameObjects.Graphics;
    shakeUntil = 0;
    balls: Ball[] = [];
    enemies: Enemy[] = [];
    drops: Drop[] = [];
    bullets: Bullet[] = [];
    sparks: {
        x: number;
        y: number;
        vx: number;
        vy: number;
        life: number;
        color: number;
    }[] = [];
    keys: any;
    clock = 0;
    acc = 0;
    target = 210;
    pv = 0;
    held = true;
    holdUntil = 0;
    shield = 100;
    scrap = 0;
    invulnerable = 0;
    abilityUntil = 0;
    abilityReady = 0;
    net = 0;
    phaseBlock = false;
    combo = 0;
    comboUntil = 0;
    slowUntil = 0;
    slowReady = 0;
    done = false;
    collectUntil = 0;
    bossPhase = 1;
    bossDefeated = false;
    nextEscort = 0;
    lastProgress = 0;
    splitUsed = false;
    id = 0;
    hudAt = 0;
    padButtons = false;
    padPause = false;
    consumed = false;
    rescueCount = 0;
    constructor() { super('battle'); }
    init(h: Host) { this.host = h; this.stage = STAGES[(h.run.stage - 1) % 20]; this.rng = new RNG(h.run.seed + h.run.stage); this.shield = h.run.shield; this.scrap = h.run.scrap; this.net = rank(h.run, 'catch'); this.phaseBlock = !!rank(h.run, 'phase'); this.rescueCount = h.run.rescued ?? 0; }
    u(id: string) { return rank(this.host.run, id); }
    create() {
        const s = this.host.progress.settings;
        audio.settings = s;
        audio.mode = this.stage.boss ? 'boss' : 'battle';
        audio.region = Math.floor((this.stage.id - 1) / 5);
        this.cameras.main.setBackgroundColor('#07111f');
        for (let i = 0; i < 25; i++) {
            const x = (i * 73) % 420, height = 35 + (i * 37) % 100;
            this.add.rectangle(x, 752 - height / 2, 26, height, 0x102b40);
            for (let j = 0; j < 4; j++)
                this.add.rectangle(x - 6 + (j % 2) * 12, 740 - Math.floor(j / 2) * 18, 4, 7, 0x4de9ff, .18 + (this.host.progress.rescues > 5 ? .2 : 0));
        }
        this.add.rectangle(210, 720, 400, 1, 0x2c6075);
        this.add.text(12, 12, `${this.stage.region}  //  ${this.stage.id}`, { fontFamily: 'system-ui', fontSize: '10px', color: '#8ca9bf' });
        this.add.text(12, 29, this.stage.name.toUpperCase(), { fontFamily: 'system-ui', fontSize: '18px', fontStyle: 'bold', color: '#e8fbff' });
        this.hud = this.add.text(12, 54, '', { fontFamily: 'system-ui', fontSize: '11px', color: '#b7eaff' }).setDepth(10);
        this.shieldBar = this.add.rectangle(12, 84, 396, 4, 0x55eaff).setOrigin(0, .5);
        const ship = SHIPS.find(s => s.id === this.host.run.ship)!;
        const width = Math.min(160, ship.width * (1 + .12 * this.u('wide')) * (s.assistWidth ? 1.2 : 1));
        this.paddle = this.add.rectangle(210, PY, width, 14, 0x4de9ff).setStrokeStyle(2, 0xe3ffff).setDepth(20);
        this.aim = this.add.graphics().setDepth(9);
        this.fx = this.add.graphics().setDepth(8);
        this.spawnBall(210, PY - 17);
        if (this.stage.boss)
            this.buildBoss();
        else
            this.stage.layout.forEach((row, y) => [...row].forEach((c, x) => this.spawnEnemy(SYMBOL_TO_ENEMY[c] ?? 'scout', 36 + x * 58, 119 + y * 39)));
        this.bossText = this.add.text(210, 96, '', { fontFamily: 'system-ui', fontSize: '10px', color: '#ffd6a3' }).setOrigin(.5);
        this.keys = this.input.keyboard!.addKeys('A,D,LEFT,RIGHT');
        this.input.keyboard!.on('keydown-SPACE', () => this.launch());
        this.input.keyboard!.on('keydown-E', () => this.ability());
        this.input.keyboard!.on('keydown-SHIFT', () => this.ability());
        this.input.keyboard!.on('keydown-ESC', () => this.host.onPause());
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.wasTouch && !p.isDown)
            return; if (s.directTouch || !p.wasTouch)
            this.target = p.x;
        else
            this.target += (p.position.x - p.prevPosition.x) * s.touchSensitivity; });
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { audio.unlock(); if (!p.wasTouch)
            this.launch(); });
        document.addEventListener('visibilitychange', this.visibility);
        this.events.once('shutdown', () => document.removeEventListener('visibilitychange', this.visibility));
        this.events.on('pause', () => { audio.mode = 'silent'; });
        this.events.on('resume', () => { this.acc = 0; audio.unlock(); audio.mode = this.stage.boss ? 'boss' : 'battle'; });
        if (this.stage.tutorial && !this.stage.boss)
            this.host.toast(this.stage.tutorial);
        this.sync();
    }
    visibility = () => { if (document.hidden && this.scene.isActive()) {
        audio.suspend();
        this.host.onPause();
    } };
    spawnBall(x: number, y: number, vx = 0, vy = 0) { if (this.balls.length >= 3)
        return; const color = this.host.progress.settings.highContrast ? 0xffffff : ELEMENTS[this.host.run.elements[0]]?.color ?? 0xffd166; const r = this.host.progress.settings.largeCore ? 9 : 6; const view = this.add.circle(x, y, r, color).setStrokeStyle(2, 0xffffff).setDepth(30); this.balls.push({ x, y, vx, vy, r, view, charged: false, precision: false, pierce: 0, hits: 0, lastHit: this.clock, lastEnemy: -1, trail: [] }); }
    spawnEnemy(type: EnemyType, x: number, y: number, hp?: number, role?: Enemy['role'], required = true) { const max = hp ?? (type === 'armored' ? 4 : type === 'scout' ? 2 : 3); const w = role === 'core' ? 108 : role === 'plate' ? 68 : 48, h = role ? 30 : 25; const view = this.add.rectangle(x, y, w, h, COLORS[type]).setStrokeStyle(2, 0xffffff, .65).setDepth(5); const marks: Record<EnemyType, string> = { scout: '•', armored: 'III', shield: '◇', repair: '+', gunship: '▼', mine: '!', interceptor: '»', reflector: '/', conductive: 'ϟ', fuel: '×', prison: 'SOS', command: '★' }; const label = this.add.text(x, y, role === 'core' ? 'REACTOR' : marks[type], { fontFamily: 'system-ui', fontSize: role === 'core' ? '11px' : '12px', fontStyle: 'bold', color: '#07111f' }).setOrigin(.5).setDepth(6); const e: Enemy = { id: ++this.id, x, y, baseX: x, w, h, type, view, label, max, hp: max, armor: type === 'armored' ? 3 : 0, chill: 0, frozen: 0, burn: 0, burnPower: 0, procAt: 0, boss: !!role, nextShot: this.clock + 2 + this.rng.next() * 2, telegraph: 0, role, required, alive: true }; this.enemies.push(e); return e; }
    buildBoss() { this.hull = this.add.graphics().setDepth(2); this.spawnEnemy('gunship', 75, 154, 8, 'gun'); this.spawnEnemy('gunship', 345, 154, 8, 'gun'); this.spawnEnemy('armored', 164, 195, 9, 'plate'); this.spawnEnemy('armored', 256, 195, 9, 'plate'); this.spawnEnemy('command', 210, 139, 28, 'core'); this.host.toast('SIEGE ALERT · BREAK THE ARMOR'); audio.cue('phase'); }
    launch() { audio.unlock(); if (this.done || !this.held)
        return; this.held = false; this.holdUntil = 0; const speed = this.host.progress.settings.assistSpeed ? 270 : 330; for (const b of this.balls) {
        const direction = rebound(b.x, this.paddle.x, this.paddle.width, this.pv);
        b.vx = direction.x * speed + (this.rng.next() - .5) * 30;
        b.vy = direction.y * speed;
    } audio.cue('launch'); if (this.u('multiball') && !this.splitUsed) {
        this.splitUsed = true;
        this.spawnBall(this.paddle.x + 12, PY - 22, 110, -speed);
    } this.lastProgress = this.clock; }
    ability() { audio.unlock(); if (this.done || this.clock < this.abilityReady)
        return; this.abilityReady = this.clock + 18 * (1 - .15 * this.u('cooldown')); const ship = this.host.run.ship; this.abilityUntil = this.clock + (ship === 'striker' ? 8 + 2 * this.u('overdrive') : 6); if (ship === 'magnetar') {
        const b = this.balls[0];
        if (b) {
            this.held = true;
            this.holdUntil = this.clock + 4 + 2 * this.u('hold');
            for (const other of this.balls.slice(1))
                other.view.destroy();
            this.balls = [b];
            b.vx = b.vy = 0;
        }
    } audio.cue('ability'); this.burst(this.paddle.x, PY, 0x5ceaff, 16); this.host.toast(SHIPS.find(s => s.id === ship)!.ability.toUpperCase()); }
    damage(amount: number, reason: string) { if (this.clock < this.invulnerable || this.done)
        return; this.shield = Math.max(0, this.shield - amount); this.invulnerable = this.clock + 1.2; audio.cue('damage'); this.burst(this.paddle.x, PY, 0xff7250, 18); this.host.toast(`${reason}  −${amount} SHIELD`); this.sync(); if (this.shield <= 0) {
        this.done = true;
        audio.cue('defeat');
        this.host.onGameOver();
    } }
    loseBall(b: Ball) { b.view.destroy(); this.balls = this.balls.filter(x => x !== b); if (this.balls.length)
        return; let saved = false; if (this.host.run.ship === 'guardian' && this.clock < this.abilityUntil) {
        this.abilityUntil = 0;
        saved = true;
        this.scrap += 12 * this.u('barrier');
    }
    else if (this.net > 0) {
        this.net--;
        saved = true;
    } this.bullets.forEach(b => b.view.destroy()); this.bullets = []; if (saved) {
        audio.cue('ability');
        this.host.toast('EMERGENCY CORE RECOVERED');
    }
    else
        this.damage(18, 'CORE LOST'); if (!this.done) {
        this.spawnBall(this.paddle.x, PY - 17);
        this.held = true;
    } }
    hitPaddle(b: Ball) { const v = rebound(b.x, this.paddle.x, this.paddle.width, this.pv); const speed = Math.min(500, Math.max(this.host.progress.settings.assistSpeed ? 270 : 330, Math.hypot(b.vx, b.vy) * 1.012)); b.vx = v.x * speed; b.vy = v.y * speed; b.y = PY - 7 - b.r - .1; b.hits++; const offset = Math.abs(b.x - this.paddle.x) / (this.paddle.width / 2); b.precision = offset < .2 || offset > .72; b.charged = (this.u('charge') > 0 && b.hits % 3 === 0) || (this.host.run.ship === 'striker' && b.precision); if (this.u('edge') && offset > .72)
        b.pierce = this.u('edge'); audio.cue('paddle'); this.burst(b.x, PY, b.charged ? 0xffee88 : 0x5ceaff, 8); }
    hit(e: Enemy, b: Ball) {
        if (!e.alive)
            return;
        this.lastProgress = this.clock;
        if (e.role === 'core' && this.bossPhase === 1) {
            audio.cue('armor');
            this.burst(e.x, e.y, 0xaabbee, 5);
            return;
        }
        const out = impact(e, this.host.run, this.clock, b.charged, b.precision, this.rng.next());
        let damage = out.damage;
        if (this.host.run.ship === 'striker' && this.clock < this.abilityUntil) {
            damage *= 2;
            e.armor = Math.max(0, e.armor - 1);
        }
        damage *= 1 + Math.min(10, this.combo) * .025;
        this.combo++;
        this.comboUntil = this.clock + 3 * (1 + .35 * this.u('combo'));
        this.applyDamage(e, damage, true);
        audio.cue(e.armor ? 'armor' : 'hit');
        if (out.proc) {
            this.host.toast(out.proc);
            audio.cue(this.host.run.elements.includes('lightning') ? 'lightning' : this.host.run.elements.includes('ice') ? 'ice' : 'fire');
        }
        if (out.burst)
            this.explode(e.x, e.y, 65, out.burst, e.id);
        if (out.chains) {
            const range = 100 * (1 + .25 * this.u('conductor')) + (e.type === 'conductive' ? 35 : 0);
            const near = this.enemies.filter(x => x.alive && x.id !== e.id && Math.hypot(x.x - e.x, x.y - e.y) < range).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, Math.min(5, out.chains));
            let previous = e;
            near.forEach((n, i) => { this.arc(previous.x, previous.y, n.x, n.y); this.applyDamage(n, damage * .55 ** (i + 1), false); if (out.plasma && n.alive) {
                n.burn = this.clock + 1.5;
                n.burnPower = .2;
            } previous = n; });
            if (near.length)
                audio.cue('lightning');
        }
        if (this.u('ignite') && e.burn > this.clock) {
            const neighbor = this.enemies.find(n => n.alive && n.id !== e.id && Math.hypot(n.x - e.x, n.y - e.y) < 60 + 10 * this.u('ignite'));
            if (neighbor) {
                neighbor.burn = this.clock + 2;
                neighbor.burnPower = .3;
            }
        }
        b.pierce = Math.max(b.pierce, out.pierce);
        b.charged = false;
    }
    applyDamage(e: Enemy, damage: number, allowFuel: boolean) {
        if (!e.alive || (e.role === 'core' && this.bossPhase === 1))
            return;
        const shielded = !e.role && e.type !== 'shield' && this.enemies.some(n => n.alive && n.type === 'shield' && Math.hypot(n.x - e.x, n.y - e.y) < 85);
        e.hp -= damage * (shielded ? .65 : 1);
        if (damage > .05) {
            this.burst(e.x, e.y, COLORS[e.type], e.hp <= 0 ? 12 : 4);
            e.view.setAlpha(.55);
            this.tweens.add({ targets: e.view, alpha: 1, duration: 100 });
        }
        if (e.hp > 0)
            return;
        e.alive = false;
        e.view.setVisible(false);
        e.label.setVisible(false);
        if (e.type === 'prison')
            this.drop(e.x, e.y, 'rescue');
        else if (this.rng.next() < .4)
            this.drop(e.x, e.y, 'scrap');
        if (e.type === 'fuel' && allowFuel)
            this.explode(e.x, e.y, 70 + 20 * this.u('blast'), 2, e.id);
        if (e.role === 'core') {
            this.bossDefeated = true;
            this.enemies.forEach(n => { n.alive = false; n.view.setVisible(false); n.label.setVisible(false); });
            this.burst(e.x, e.y, 0xffcd6e, 40);
            audio.cue('victory');
        }
        if (this.stage.boss && this.bossPhase === 1 && !this.enemies.some(n => n.alive && n.role === 'plate')) {
            this.bossPhase = 2;
            this.nextEscort = this.clock + 3;
            audio.cue('phase');
            this.host.toast('ARMOR DESTROYED · REACTOR EXPOSED');
            this.bullets.forEach(b => b.view.destroy());
            this.bullets = [];
        }
    }
    explode(x: number, y: number, r: number, d: number, exclude: number) { const circle = this.add.circle(x, y, r, 0xff9a45, .13).setStrokeStyle(2, 0xffcb6c).setDepth(7); this.tweens.add({ targets: circle, alpha: 0, duration: 260, onComplete: () => circle.destroy() }); for (const n of this.enemies)
        if (n.alive && n.id !== exclude && Math.hypot(n.x - x, n.y - y) < r)
            this.applyDamage(n, d, false); }
    arc(x: number, y: number, tx: number, ty: number) { const g = this.add.graphics().setDepth(8); g.lineStyle(2, 0xfff3a0, .9); g.beginPath(); g.moveTo(x, y); g.lineTo((x + tx) / 2 + 8, (y + ty) / 2 - 5); g.lineTo(tx, ty); g.strokePath(); this.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() }); }
    drop(x: number, y: number, kind: Drop['kind']) { if (this.drops.length >= 24)
        return; const view = this.add.text(x, y, kind === 'rescue' ? '✚' : '◆', { fontSize: '19px', fontFamily: 'system-ui', color: kind === 'rescue' ? '#65f3ff' : '#ffda79', backgroundColor: '#122b3d', padding: { x: 3, y: 1 } }).setOrigin(.5).setDepth(12); this.drops.push({ x, y, kind, view, second: false }); }
    shoot(e: Enemy) { if (this.bullets.length >= 33)
        return; const count = e.role && this.bossPhase === 2 ? 3 : 1; for (let i = 0; i < count; i++) {
        const view = this.add.triangle(e.x, e.y, 0, 0, 10, 0, 5, 13, 0xff8151).setStrokeStyle(1, 0xffe6b0).setDepth(13);
        this.bullets.push({ x: e.x, y: e.y + 16, vx: (i - (count - 1) / 2) * 45, vy: 125 * (this.host.progress.settings.assistBullets ? .7 : 1), view });
    } }
    burst(x: number, y: number, color: number, count: number) { if (count >= 12)
        this.shakeUntil = this.clock + .12; if (this.host.progress.settings.reducedMotion)
        count = Math.min(3, count); for (let i = 0; i < count && this.sparks.length < 120; i++) {
        const a = i * 2.399;
        this.sparks.push({ x, y, vx: Math.cos(a) * (30 + i * 3), vy: Math.sin(a) * (30 + i * 3), life: .3, color });
    } }
    step(dt: number) {
        this.clock += dt;
        if (this.done)
            return;
        const speed = SHIPS.find(s => s.id === this.host.run.ship)!.speed * (1 + .1 * this.u('speed'));
        let axis = (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) - (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0);
        const pad = this.input.gamepad?.getPad(0);
        if (pad) {
            const stick = pad.axes[0]?.getValue() ?? 0;
            if (Math.abs(stick) > .18)
                axis = stick;
            if (pad.left)
                axis = -1;
            if (pad.right)
                axis = 1;
            const down = pad.A || pad.B;
            if (down && !this.padButtons) {
                if (pad.A)
                    this.launch();
                if (pad.B)
                    this.ability();
            }
            this.padButtons = down;
            if (pad.buttons[9]?.pressed && !this.padPause)
                this.host.onPause();
            this.padPause = !!pad.buttons[9]?.pressed;
        }
        if (axis)
            this.target = this.paddle.x + axis * speed * dt;
        const half = this.paddle.width / 2;
        this.target = Phaser.Math.Clamp(this.target, half + 8, W - half - 8);
        const old = this.paddle.x;
        this.paddle.x += Phaser.Math.Clamp(this.target - old, -speed * dt, speed * dt);
        this.pv = (this.paddle.x - old) / dt;
        if (this.comboUntil < this.clock)
            this.combo = 0;
        if (this.held) {
            for (const b of this.balls) {
                b.x = this.paddle.x;
                b.y = PY - 17;
            }
            if (this.holdUntil && this.clock >= this.holdUntil)
                this.launch();
        }
        else if (!this.collectUntil) {
            for (const b of [...this.balls])
                this.moveBall(b, dt * (this.clock < this.slowUntil ? .55 : 1));
        }
        if (!this.held && !this.collectUntil)
            this.enemyStep(dt);
        for (const d of [...this.drops]) {
            d.y += dt * (this.collectUntil ? 190 : 100);
            const radius = 35 * this.u('magnet') + (this.host.run.ship === 'magnetar' ? 55 : 0);
            if (d.y > 470 && Math.abs(d.x - this.paddle.x) < radius + half)
                d.x += Math.sign(this.paddle.x - d.x) * Math.min(Math.abs(this.paddle.x - d.x), 140 * dt);
            if (Math.abs(d.y - PY) < 18 && Math.abs(d.x - this.paddle.x) < half + 12) {
                if (d.kind === 'rescue') {
                    this.rescueCount++;
                    this.scrap += Math.round(15 * (1 + .3 * this.u('rescue')));
                    audio.cue('rescue');
                    this.host.toast('RESCUE SECURED');
                }
                else {
                    this.scrap += Math.round(8 * (1 + .2 * this.u('scrap')));
                    audio.cue('scrap');
                }
                this.burst(d.x, d.y, d.kind === 'rescue' ? 0x66ffff : 0xffd166, 10);
                d.view.destroy();
                this.drops = this.drops.filter(x => x !== d);
            }
            else if (d.y > 745) {
                if (d.kind === 'rescue' && !d.second && this.rng.next() < .25 * this.u('capsule')) {
                    d.second = true;
                    d.y = 430;
                }
                else {
                    d.view.destroy();
                    this.drops = this.drops.filter(x => x !== d);
                }
            }
        }
        for (const b of [...this.bullets]) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (Math.abs(b.y - PY) < 12 && Math.abs(b.x - this.paddle.x) < half + 5) {
                if (this.phaseBlock) {
                    this.phaseBlock = false;
                    this.host.toast('PHASE JACKET BLOCKED HIT');
                }
                else
                    this.damage(6, 'PADDLE HIT');
                b.y = 800;
            }
            else if (b.y > PY - 20 && b.y < PY + 20 && Math.abs(b.x - this.paddle.x) < half + 35 && this.u('slowmo') && this.clock > this.slowReady) {
                this.slowUntil = this.clock + .6 + .2 * this.u('slowmo');
                this.slowReady = this.clock + 6;
            }
            if (b.y > 760) {
                b.view.destroy();
                this.bullets = this.bullets.filter(x => x !== b);
            }
        }
        const cleared = this.stage.boss ? this.bossDefeated : !this.enemies.some(e => e.alive && e.required);
        if (cleared && !this.collectUntil) {
            this.collectUntil = this.clock + (this.stage.boss ? 3 : 4);
            this.bullets.forEach(b => b.view.destroy());
            this.bullets = [];
            audio.cue('victory');
            this.host.toast('SECTOR CLEAR · COLLECT SURVIVORS');
        }
        if (this.collectUntil && this.clock >= this.collectUntil) {
            this.done = true;
            this.sync();
            this.host.onStageClear();
        }
    }
    moveBall(b: Ball, dt: number) {
        let remaining = dt;
        for (let i = 0; i < 8 && remaining > .000001; i++) {
            type Contact = {
                time: number;
                nx: number;
                ny: number;
                enemy?: Enemy;
                paddle?: boolean;
            };
            const candidates: Contact[] = [];
            const consider = (h: Contact | null) => { if (h && h.time >= 0 && h.time <= remaining)
                candidates.push(h); };
            if (b.vx < 0)
                consider({ time: (8 + b.r - b.x) / b.vx, nx: 1, ny: 0 });
            if (b.vx > 0)
                consider({ time: (412 - b.r - b.x) / b.vx, nx: -1, ny: 0 });
            if (b.vy < 0)
                consider({ time: (96 + b.r - b.y) / b.vy, nx: 0, ny: 1 });
            if (b.vy > 0) {
                const h = sweep(b.x, b.y, b.vx, b.vy, remaining, this.paddle.x - this.paddle.width / 2 - b.r, PY - 7 - b.r, this.paddle.x + this.paddle.width / 2 + b.r, PY + 7 + b.r);
                if (h)
                    consider({ ...h, paddle: true });
            }
            for (const e of this.enemies) {
                if (!e.alive || (b.lastEnemy === e.id && this.clock - b.lastHit < .04))
                    continue;
                const h = sweep(b.x, b.y, b.vx, b.vy, remaining, e.x - e.w / 2 - b.r, e.y - e.h / 2 - b.r, e.x + e.w / 2 + b.r, e.y + e.h / 2 + b.r);
                if (h)
                    consider({ ...h, enemy: e });
            }
            const h = candidates.sort((a, b) => a.time - b.time)[0];
            if (!h) {
                b.x += b.vx * remaining;
                b.y += b.vy * remaining;
                break;
            }
            b.x += b.vx * h.time;
            b.y += b.vy * h.time;
            remaining -= h.time;
            if (h.paddle)
                this.hitPaddle(b);
            else {
                let pierce = false;
                if (h.enemy) {
                    b.lastHit = this.clock;
                    b.lastEnemy = h.enemy.id;
                    this.hit(h.enemy, b);
                    if (b.pierce > 0) {
                        b.pierce--;
                        pierce = true;
                    }
                }
                if (!pierce) {
                    if (h.nx)
                        b.vx = -b.vx;
                    if (h.ny)
                        b.vy = -b.vy;
                }
                b.x += Math.sign(b.vx) * .1;
                b.y += Math.sign(b.vy) * .1;
            }
            remaining = Math.max(0, remaining - .00001);
        }
        if (this.clock - this.lastProgress > 9) {
            const targets = this.enemies.filter(e => e.alive);
            const nearest = targets.sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0];
            if (nearest && b.y > nearest.y + 40) {
                const angle = Phaser.Math.Clamp(Math.atan2(nearest.x - b.x, b.y - nearest.y), -1.1, 1.1), speed = Math.hypot(b.vx, b.vy);
                b.vx = Math.sin(angle) * speed;
                b.vy = -Math.cos(angle) * speed;
                this.lastProgress = this.clock;
                this.host.toast('CORE GUIDANCE CORRECTION');
            }
        }
        if (b.y > 760)
            this.loseBall(b);
    }
    enemyStep(dt: number) {
        for (const e of this.enemies) {
            if (!e.alive)
                continue;
            const frozen = e.frozen > this.clock;
            if ((e.type === 'interceptor' || (e.role && this.bossPhase === 2)) && !frozen)
                e.x = e.baseX + Math.sin(this.clock * (e.role ? .8 : 1.2)) * (e.role ? 28 : 20);
            if (e.burn > this.clock)
                this.applyDamage(e, e.burnPower * dt, false);
            if (!e.alive)
                continue;
            if (frozen) {
                e.nextShot += dt;
                continue;
            }
            if (e.chill > 0)
                e.nextShot += dt * .35;
            if (['gunship', 'mine', 'command'].includes(e.type) && (!e.role || e.role === 'gun' || this.bossPhase === 2)) {
                if (this.clock > e.nextShot - .7 && e.telegraph === 0)
                    e.telegraph = this.clock;
                if (this.clock >= e.nextShot) {
                    this.shoot(e);
                    e.nextShot = this.clock + (e.role ? 2.3 : 4);
                    e.telegraph = 0;
                }
            }
            if (e.type === 'repair' && this.clock > e.nextShot) {
                const n = this.enemies.find(n => n.alive && n.id !== e.id && n.hp < n.max);
                if (n)
                    n.hp = Math.min(n.max, n.hp + .4);
                e.nextShot = this.clock + 6;
            }
        }
        if (this.bossPhase === 2 && this.clock > this.nextEscort && this.enemies.filter(e => e.alive && !e.role).length < 3) {
            this.spawnEnemy('interceptor', 80 + (this.rng.next() * 260), 250, 2, undefined, false);
            this.nextEscort = this.clock + 9;
        }
    }
    sync() { this.host.run.shield = this.shield; this.host.run.scrap = this.scrap; this.host.run.rescued = this.rescueCount; if (this.consumed)
        this.host.run.consumable = false; this.host.onHud({ shield: this.shield, scrap: this.scrap, stage: this.stage.id }); }
    update(_: number, delta: number) {
        if (!this.paddle)
            return;
        this.acc += Math.min(.05, delta / 1000);
        let steps = 0;
        while (this.acc >= 1 / 120 && steps++ < 6) {
            this.step(1 / 120);
            this.acc -= 1 / 120;
            if (this.done)
                break;
        }
        if (this.done)
            return;
        for (const b of this.balls) {
            b.view.setPosition(b.x, b.y);
            b.view.setStrokeStyle(b.charged ? 3 : 2, b.charged ? 0xffef77 : 0xffffff);
            if (!this.host.progress.settings.reducedMotion) {
                b.trail.push(b.x, b.y);
                if (b.trail.length > 18)
                    b.trail.splice(0, 2);
            }
        }
        for (const e of this.enemies)
            if (e.alive) {
                e.view.setPosition(e.x, e.y).setFillStyle(e.frozen > this.clock ? 0x9beaff : e.burn > this.clock ? 0xff8753 : COLORS[e.type]);
                e.view.setStrokeStyle(e.armor ? 3 : 1, e.telegraph ? 0xffee99 : 0xffffff, e.telegraph ? .5 + Math.sin(this.clock * 24) * .5 : .7);
                e.label.setPosition(e.x, e.y);
                if (e.type === 'armored')
                    e.label.setText(e.armor ? 'I'.repeat(e.armor) : '◇');
            }
        this.drops.forEach(d => d.view.setPosition(d.x, d.y));
        this.bullets.forEach(b => b.view.setPosition(b.x, b.y));
        this.fx.clear();
        for (const b of this.balls) {
            this.fx.lineStyle(3, b.view.fillColor, .2);
            this.fx.beginPath();
            for (let i = 0; i < b.trail.length; i += 2) {
                if (i === 0)
                    this.fx.moveTo(b.trail[i], b.trail[i + 1]);
                else
                    this.fx.lineTo(b.trail[i], b.trail[i + 1]);
            }
            this.fx.strokePath();
        }
        for (const e of this.enemies) {
            if (!e.alive)
                continue;
            if (e.hp < e.max) {
                this.fx.fillStyle(0xffffff, .7);
                this.fx.fillRect(e.x - e.w / 2, e.y + e.h / 2 + 3, e.w * Math.max(0, e.hp / e.max), 2);
            }
            if (e.telegraph) {
                this.fx.lineStyle(1, 0xffb266, .25);
                this.fx.lineBetween(e.x, e.y + 20, e.x, PY - 30);
            }
            if (this.clock < this.shakeUntil && !this.host.progress.settings.reducedMotion)
                e.view.x += Math.sin(this.clock * 90 + e.id) * 2 * this.host.progress.settings.shake;
        }
        if (this.hull) {
            const g = this.hull;
            g.clear();
            if (!this.bossDefeated) {
                const dx = this.bossPhase === 2 ? Math.sin(this.clock * .8) * 28 : 0;
                g.fillStyle(0x162d42);
                g.lineStyle(2, 0x4d6b83);
                const points = [new Phaser.Geom.Point(40 + dx, 130), new Phaser.Geom.Point(125 + dx, 112), new Phaser.Geom.Point(295 + dx, 112), new Phaser.Geom.Point(380 + dx, 130), new Phaser.Geom.Point(365 + dx, 178), new Phaser.Geom.Point(300 + dx, 178), new Phaser.Geom.Point(275 + dx, 220), new Phaser.Geom.Point(145 + dx, 220), new Phaser.Geom.Point(120 + dx, 178), new Phaser.Geom.Point(55 + dx, 178)];
                g.fillPoints(points, true);
                g.strokePoints(points, true);
                g.fillStyle(this.bossPhase === 2 ? 0xff9050 : 0x53728d, .7);
                g.fillRect(187 + dx, 170, 46, 6);
                g.fillRect(202 + dx, 188, 16, 24);
            }
            const core = this.enemies.find(e => e.role === 'core')!;
            g.fillStyle(0x26384a);
            g.fillRect(100, 104, 220, 3);
            g.fillStyle(0xffa862);
            g.fillRect(100, 104, 220 * Math.max(0, core.hp / core.max), 3);
        }
        const dt = Math.min(.05, delta / 1000);
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const p = this.sparks[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.sparks.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            this.fx.fillStyle(p.color, p.life / .3);
            this.fx.fillRect(p.x, p.y, 3, 3);
        }
        this.aim.clear();
        if (this.held) {
            this.aim.lineStyle(1, 0x75efff, .5);
            this.aim.lineBetween(this.paddle.x, PY - 25, this.paddle.x, PY - 80);
        }
        if (this.host.run.ship === 'guardian' && this.clock < this.abilityUntil) {
            this.aim.lineStyle(4, 0x5ceaff, .8);
            this.aim.lineBetween(12, 715, 408, 715);
        }
        this.paddle.setAlpha(this.clock < this.invulnerable ? .5 + .5 * Math.abs(Math.sin(this.clock * 15)) : 1);
        if (this.clock > this.hudAt)
            this.host.onHud({ shield: this.shield, scrap: this.scrap, stage: this.stage.id });
        if (this.clock > this.hudAt) {
            this.hudAt = this.clock + .1;
            const cd = Math.max(0, Math.ceil(this.abilityReady - this.clock));
            this.hud.setText(`SHIELD ${Math.ceil(this.shield)}/${maxShield(this.host.run)}  ·  SCRAP ${this.scrap}  ·  ${this.balls.length} CORE\n${this.host.run.elements.map(e => e.toUpperCase()).join(' + ')}  ·  ${cd ? `ABILITY ${cd}s` : 'ABILITY READY'}${this.combo > 2 ? `  ×${this.combo}` : ''}`);
            this.shieldBar.width = 396 * Math.max(0, this.shield) / maxShield(this.host.run);
            this.shieldBar.setFillStyle(this.shield < 30 ? 0xff7755 : 0x55eaff);
            if (this.stage.boss) {
                const core = this.enemies.find(e => e.role === 'core')!;
                this.bossText.setText(`PHASE ${this.bossPhase} · ${this.bossPhase === 1 ? 'BREAK ARMOR' : 'REACTOR EXPOSED'} · ${Math.ceil(Math.max(0, core.hp))}/${core.max}`);
            }
            const button = document.querySelector<HTMLButtonElement>('[data-ability]');
            if (button) {
                button.textContent = cd ? `ABILITY ${cd}s` : 'ABILITY';
                button.disabled = cd > 0;
            }
        }
    }
    useConsumable() { if (!this.host.run.consumable || this.consumed)
        return; this.consumed = true; this.shield = Math.min(maxShield(this.host.run), this.shield + 25); audio.cue('ability'); this.host.toast('REPAIR KIT · +25 SHIELD'); document.querySelector('[data-kit]')?.remove(); }
}
export function createGame(parent: string, host: Host) { const game = new Phaser.Game({ type: Phaser.AUTO, parent, width: W, height: H, backgroundColor: '#07111f', input: { gamepad: true }, scene: [], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, callbacks: { postBoot: g => { g.scene.add('battle', BattleScene, true, host); } } }); const controls = document.createElement('div'); controls.className = 'play-controls'; const get = () => game.scene.getScene('battle') as BattleScene; const actions: [
    string,
    () => void,
    string?
][] = [['PAUSE', () => host.onPause()], ['LAUNCH', () => get().launch()], ['ABILITY', () => get().ability(), 'ability']]; if (host.progress.settings.leftHanded)
    actions.reverse(); if (host.run.consumable)
    actions.push(['KIT +25', () => get().useConsumable(), 'kit']); for (const [label, action, key] of actions) {
    const b = document.createElement('button');
    b.textContent = label;
    if (key)
        b.dataset[key] = '';
    b.onclick = () => { audio.unlock(); action(); };
    controls.append(b);
} document.getElementById(parent)!.parentElement!.append(controls); return game; }
