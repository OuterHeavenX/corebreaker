import Phaser from 'phaser';
import { BOSSES, ELEMENTS, POWERS, POWER_IDS, SHIPS, STAGES, SYMBOL_TO_ENEMY, comboMultiplier, difficulty, enemyHp, stageLoop, stageRegion } from './data';
import type { BossDef } from './data';
import { rebound, RNG } from './sim';
import { impact, rank, maxShield, synergyName } from './combat';
import type { Target } from './combat';
import { audio } from './audio';
import { sweep } from './physics';
import type { EnemyType, PowerId, Progress, RunState, StageDef } from './types';
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

const W = 420, H = 760, PY = 674, TOP = 96, LEFT = 8, RIGHT = 412, WALL_Y = 708, MAX_CORES = 5;
const COLORS: Record<EnemyType, number> = { scout: 0xff8a4c, armored: 0x9aa7b8, shield: 0x7d7aff, repair: 0x65e6a7, gunship: 0xff554f, mine: 0xcf6fff, interceptor: 0xffcb5c, reflector: 0xb9c6d6, conductive: 0xfff17a, fuel: 0xff7a32, prison: 0x58e5ff, command: 0xf65cbf };
const MARKS: Record<EnemyType, string> = { scout: '•', armored: 'III', shield: '◇', repair: '+', gunship: '▼', mine: '!', interceptor: '»', reflector: '═', conductive: 'ϟ', fuel: '×', prison: 'SOS', command: '★' };
const REGION_BG = ['#07111f', '#140d12', '#0a0a1e', '#160709'];
const REGION_SKY = [0x102b40, 0x33201c, 0x1c1c44, 0x3a1218];
const REGION_GLOW = [0x4de9ff, 0xffa24d, 0x9d8cff, 0xff5c6c];
const MOD_LABEL: Record<string, string> = { moving: 'MOVING FORMATION', barrier: 'STEEL BUMPERS', plasma: 'PLASMA LANES', portal: 'PORTALS', gravity: 'GRAVITY WELL', blackout: 'BLACKOUT' };
const MOD_TOAST: Record<string, string> = { moving: 'THE FORMATION IS MOVING', barrier: 'STEEL BUMPERS DEFLECT THE CORE', plasma: 'PLASMA LANES · KEEP MOVING', portal: 'PORTALS RELOCATE THE CORE', gravity: 'A GRAVITY WELL BENDS THE CORE', blackout: 'BLACKOUT · THE CORE LIGHTS THE WAY' };
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

type Ball = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    view: Phaser.GameObjects.Arc;
    glow: Phaser.GameObjects.Arc;
    charged: boolean;
    precision: boolean;
    pierce: number;
    hits: number;
    lastHit: number;
    lastEnemy: number;
    through: number;
    portalAt: number;
    trail: number[];
};
type Enemy = Target & {
    x: number;
    y: number;
    baseX: number;
    row: number;
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
    solid: boolean;
    intro: number;
    flash: number;
};
type Drop = {
    x: number;
    y: number;
    kind: 'rescue' | 'scrap' | 'power';
    power?: PowerId;
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
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: number };
type Ring = { x: number; y: number; life: number; color: number; size: number };
type Floater = { view: Phaser.GameObjects.Text; life: number };

export class BattleScene extends Phaser.Scene {
    host!: Host;
    stage!: StageDef;
    rng!: RNG;
    paddle!: Phaser.GameObjects.Rectangle;
    aim!: Phaser.GameObjects.Graphics;
    fx!: Phaser.GameObjects.Graphics;
    ov!: Phaser.GameObjects.Graphics;
    hud!: Phaser.GameObjects.Text;
    scoreText!: Phaser.GameObjects.Text;
    comboText!: Phaser.GameObjects.Text;
    powerText!: Phaser.GameObjects.Text;
    bossText!: Phaser.GameObjects.Text;
    shieldBar!: Phaser.GameObjects.Rectangle;
    hull?: Phaser.GameObjects.Graphics;
    boss?: BossDef;
    mod = '';
    shakeUntil = 0;
    balls: Ball[] = [];
    enemies: Enemy[] = [];
    drops: Drop[] = [];
    bullets: Bullet[] = [];
    bolts: { x: number; y: number }[] = [];
    lanes: { x: number; at: number; hit: boolean }[] = [];
    portals: { x: number; y: number }[] = [];
    well?: { x: number; y: number };
    sparks: Spark[] = [];
    rings: Ring[] = [];
    floaters: Floater[] = [];
    keys: any;
    clock = 0;
    viewClock = 0;
    acc = 0;
    freeze = 0;
    slowReal = 0;
    target = 210;
    pv = 0;
    baseWidth = 94;
    held = true;
    holdUntil = 0;
    shield = 100;
    scrap = 0;
    score = 0;
    shownScore = 0;
    invulnerable = 0;
    abilityUntil = 0;
    abilityReady = 0;
    net = 0;
    phaseBlock = false;
    combo = 0;
    bestCombo = 0;
    comboUntil = 0;
    comboPulse = -9;
    slowUntil = 0;
    slowReady = 0;
    wideUntil = 0;
    blasterUntil = 0;
    overUntil = 0;
    wallUntil = 0;
    nextBolt = 0;
    nextLane = 4;
    lanesOn = false;
    pendingSplit = false;
    sincePower = 0;
    squash = -9;
    done = false;
    collectUntil = 0;
    collectStart = 0;
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

    init(h: Host) {
        this.host = h;
        this.stage = STAGES[(h.run.stage - 1) % 20];
        this.rng = new RNG(h.run.seed + h.run.stage);
        this.shield = h.run.shield;
        this.scrap = h.run.scrap;
        this.score = this.shownScore = h.run.score ?? 0;
        this.net = rank(h.run, 'catch');
        this.phaseBlock = !!rank(h.run, 'phase');
        this.rescueCount = h.run.rescued ?? 0;
    }

    u(id: string) { return rank(this.host.run, id); }
    get opts() { return this.host.progress.settings; }
    get baseSpeed() { return this.opts.assistSpeed ? 285 : 350; }

    create() {
        const s = this.opts, region = stageRegion(this.host.run.stage), loop = stageLoop(this.host.run.stage);
        audio.settings = s;
        audio.mode = this.stage.boss ? 'boss' : 'battle';
        audio.region = region;
        this.cameras.main.setBackgroundColor(REGION_BG[region]);
        for (let i = 0; i < 34; i++) {
            const big = i % 5 === 0;
            const star = this.add.rectangle((i * 127 + 31) % W, 104 + (i * 89) % 500, big ? 3 : 2, big ? 3 : 2, 0xcfeaff, .1 + (i % 4) * .07).setDepth(0);
            if (!s.reducedMotion)
                this.tweens.add({ targets: star, alpha: .03, duration: 900 + (i % 7) * 260, yoyo: true, repeat: -1, delay: i * 70 });
        }
        for (let i = 0; i < 25; i++) {
            const x = (i * 73) % 420, height = 35 + (i * 37) % 100;
            this.add.rectangle(x, 752 - height / 2, 26, height, REGION_SKY[region]).setDepth(1);
            for (let j = 0; j < 4; j++)
                this.add.rectangle(x - 6 + (j % 2) * 12, 740 - Math.floor(j / 2) * 18, 4, 7, REGION_GLOW[region], .18 + (this.host.progress.rescues > 5 ? .2 : 0)).setDepth(1);
        }
        this.add.rectangle(210, 720, 400, 1, 0x2c6075).setDepth(1);
        this.mod = this.stage.boss ? 'boss' : this.stage.modifier ?? '';
        const tag = MOD_LABEL[this.mod] ? `  //  ${MOD_LABEL[this.mod]}` : '';
        this.add.text(12, 12, `${this.stage.region}  //  ${this.host.run.stage}${loop ? `  //  LOOP ${loop + 1}` : ''}${tag}`, { fontFamily: 'system-ui', fontSize: '10px', color: '#8ca9bf' }).setDepth(10);
        this.add.text(12, 29, this.stage.name.toUpperCase(), { fontFamily: 'system-ui', fontSize: '18px', fontStyle: 'bold', color: '#e8fbff' }).setDepth(10);
        this.hud = this.add.text(12, 54, '', { fontFamily: 'system-ui', fontSize: '11px', color: '#b7eaff' }).setDepth(10);
        this.scoreText = this.add.text(408, 10, '0', { fontFamily: 'system-ui', fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(1, 0).setDepth(10);
        this.comboText = this.add.text(408, 35, '', { fontFamily: 'system-ui', fontSize: '13px', fontStyle: 'bold', color: '#ffd166' }).setOrigin(1, 0).setDepth(10);
        this.powerText = this.add.text(408, 66, '', { fontFamily: 'system-ui', fontSize: '10px', fontStyle: 'bold', color: '#8cff9e' }).setOrigin(1, 0).setDepth(10);
        this.shieldBar = this.add.rectangle(12, 84, 396, 4, 0x55eaff).setOrigin(0, .5).setDepth(10);
        const ship = SHIPS.find(x => x.id === this.host.run.ship)!;
        this.baseWidth = Math.min(160, ship.width * (1 + .12 * this.u('wide')) * (s.assistWidth ? 1.2 : 1));
        this.paddle = this.add.rectangle(210, PY, this.baseWidth, 14, 0x4de9ff).setStrokeStyle(2, 0xe3ffff).setDepth(20);
        this.paddle.setRounded(6);
        this.aim = this.add.graphics().setDepth(9);
        this.fx = this.add.graphics().setDepth(8);
        this.ov = this.add.graphics().setDepth(5.5);
        this.spawnBall(210, PY - 17);
        if (this.stage.boss)
            this.buildBoss();
        else
            this.stage.layout.forEach((row, y) => [...row].forEach((c, x) => this.spawnEnemy(SYMBOL_TO_ENEMY[c] ?? 'scout', 210 - (row.length - 1) * 29 + x * 58, 119 + y * 39)));
        if (this.mod === 'barrier') {
            this.spawnBumper(105, 300);
            this.spawnBumper(315, 300);
        }
        if (this.mod === 'portal')
            this.portals = [{ x: 52, y: 440 }, { x: 368, y: 300 }];
        if (this.mod === 'gravity')
            this.well = { x: 210, y: 410 };
        this.lanesOn = this.mod === 'plasma' || !!this.boss?.lanes;
        this.bossText = this.add.text(210, 96, '', { fontFamily: 'system-ui', fontSize: '10px', color: '#ffd6a3' }).setOrigin(.5).setDepth(10);
        this.keys = this.input.keyboard!.addKeys('A,D,LEFT,RIGHT');
        this.input.keyboard!.on('keydown-SPACE', () => this.launch());
        this.input.keyboard!.on('keydown-E', () => this.ability());
        this.input.keyboard!.on('keydown-SHIFT', () => this.ability());
        this.input.keyboard!.on('keydown-ESC', () => this.host.onPause());
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (p.wasTouch && !p.isDown)
                return;
            if (s.directTouch || !p.wasTouch)
                this.target = p.x;
            else
                this.target += (p.position.x - p.prevPosition.x) * s.touchSensitivity;
        });
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            audio.unlock();
            if (!p.wasTouch)
                this.launch();
            else if (s.directTouch)
                this.target = p.x;
        });
        // A quick tap (not a drag) launches on touch screens, matching the on-screen LAUNCH button.
        this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
            if (p.wasTouch && p.getDuration() < 260 && p.getDistance() < 14)
                this.launch();
        });
        document.addEventListener('visibilitychange', this.visibility);
        this.events.once('shutdown', () => document.removeEventListener('visibilitychange', this.visibility));
        this.events.on('pause', () => { audio.mode = 'silent'; });
        this.events.on('resume', () => { this.acc = 0; audio.unlock(); audio.mode = this.stage.boss ? 'boss' : 'battle'; });
        if (this.stage.tutorial && !this.stage.boss && !loop)
            this.host.toast(this.stage.tutorial);
        else if (MOD_TOAST[this.mod])
            this.host.toast(MOD_TOAST[this.mod]);
        this.sync();
    }

    visibility = () => {
        if (document.hidden && this.scene.isActive()) {
            audio.suspend();
            this.host.onPause();
        }
    };

    spawnBall(x: number, y: number, vx = 0, vy = 0) {
        if (this.balls.length >= MAX_CORES)
            return;
        const color = this.opts.highContrast ? 0xffffff : ELEMENTS[this.host.run.elements[0]]?.color ?? 0xffd166;
        const r = this.opts.largeCore ? 9 : 6;
        const glow = this.add.circle(x, y, r * 2.6, color, .22).setDepth(29).setBlendMode(1);
        const view = this.add.circle(x, y, r, color).setStrokeStyle(2, 0xffffff).setDepth(30);
        const ball: Ball = { x, y, vx, vy, r, view, glow, charged: false, precision: false, pierce: 0, hits: 0, lastHit: this.clock, lastEnemy: -1, through: -1, portalAt: 0, trail: [] };
        this.balls.push(ball);
        return ball;
    }

    removeBall(b: Ball) {
        b.view.destroy();
        b.glow.destroy();
        this.balls = this.balls.filter(x => x !== b);
    }

    spawnEnemy(type: EnemyType, x: number, y: number, hp?: number, role?: Enemy['role'], required = true) {
        const max = hp ?? enemyHp(type, this.host.run.stage);
        const w = role === 'core' ? 108 : role === 'plate' ? 68 : 48, h = role ? 30 : 25;
        const view = this.add.rectangle(x, y, w, h, COLORS[type]).setStrokeStyle(2, 0xffffff, .65).setDepth(5);
        view.setRounded(5);
        const label = this.add.text(x, y, role === 'core' ? 'REACTOR' : MARKS[type], { fontFamily: 'system-ui', fontSize: role === 'core' ? '11px' : '12px', fontStyle: 'bold', color: '#07111f' }).setOrigin(.5).setDepth(6);
        const e: Enemy = { id: ++this.id, x, y, baseX: x, row: Math.round((y - 119) / 39), w, h, type, view, label, max, hp: max, armor: type === 'armored' ? 3 : 0, chill: 0, frozen: 0, burn: 0, burnPower: 0, procAt: 0, boss: !!role, nextShot: this.clock + 2 + this.rng.next() * 2, telegraph: 0, role, required, alive: true, solid: false, intro: this.viewClock + this.enemies.length * .028, flash: 0 };
        this.enemies.push(e);
        return e;
    }

    /** Indestructible deflector used by the "barrier" arena modifier. */
    spawnBumper(x: number, y: number) {
        const e = this.spawnEnemy('reflector', x, y, 1, undefined, false);
        e.solid = true;
        e.w = 64;
        e.h = 14;
        e.view.setSize(64, 14);
        e.view.setStrokeStyle(2, 0xffffff, .9);
        return e;
    }

    buildBoss() {
        const cfg = this.boss = BOSSES[this.stage.boss ?? ''] ?? BOSSES['Siege Carrier'];
        const loop = 1 + .6 * stageLoop(this.host.run.stage), part = (n: number) => Math.round(n * cfg.parts * loop);
        this.hull = this.add.graphics().setDepth(2);
        this.spawnEnemy('gunship', 75, 154, part(8), 'gun');
        this.spawnEnemy('gunship', 345, 154, part(8), 'gun');
        for (const x of cfg.plates === 3 ? [140, 210, 280] : [164, 256])
            this.spawnEnemy('armored', x, 195, part(9), 'plate');
        this.spawnEnemy('command', 210, 139, Math.round(cfg.hp * loop), 'core');
        this.host.toast(cfg.alert);
        audio.cue('phase');
    }

    launch() {
        audio.unlock();
        if (this.done || !this.held || this.collectUntil)
            return;
        this.held = false;
        this.holdUntil = 0;
        const speed = this.baseSpeed;
        for (const b of this.balls) {
            const direction = rebound(b.x, this.paddle.x, this.paddle.width, this.pv);
            b.vx = direction.x * speed + (this.rng.next() - .5) * 30;
            b.vy = direction.y * speed;
        }
        audio.cue('launch');
        if (this.u('multiball') && !this.splitUsed) {
            this.splitUsed = true;
            this.spawnBall(this.paddle.x + 12, PY - 22, 110, -speed);
        }
        if (this.pendingSplit) {
            this.pendingSplit = false;
            this.splitCores();
        }
        this.lastProgress = this.clock;
    }

    ability() {
        audio.unlock();
        if (this.done || this.clock < this.abilityReady)
            return;
        this.abilityReady = this.clock + 18 * (1 - .15 * this.u('cooldown'));
        const ship = this.host.run.ship;
        this.abilityUntil = this.clock + (ship === 'striker' ? 8 + 2 * this.u('overdrive') : 6);
        if (ship === 'magnetar') {
            const b = this.balls[0];
            if (b) {
                this.held = true;
                this.holdUntil = this.clock + 4 + 2 * this.u('hold');
                for (const other of this.balls.slice(1))
                    this.removeBall(other);
                b.vx = b.vy = 0;
            }
        }
        audio.cue('ability');
        this.burst(this.paddle.x, PY, 0x5ceaff, 16);
        this.ring(this.paddle.x, PY, 0x5ceaff, 70);
        this.host.toast(SHIPS.find(s => s.id === ship)!.ability.toUpperCase());
    }

    damage(amount: number, reason: string) {
        if (this.clock < this.invulnerable || this.done)
            return;
        this.shield = Math.max(0, this.shield - amount);
        this.invulnerable = this.clock + 1.2;
        audio.cue('damage');
        this.burst(this.paddle.x, PY, 0xff7250, 18);
        this.shake(2.2);
        this.host.toast(`${reason}  −${amount} SHIELD`);
        this.sync();
        if (this.shield <= 0) {
            this.done = true;
            audio.cue('defeat');
            this.host.onGameOver();
        }
    }

    loseBall(b: Ball) {
        this.removeBall(b);
        if (this.balls.length)
            return;
        let saved = false;
        if (this.host.run.ship === 'guardian' && this.clock < this.abilityUntil) {
            this.abilityUntil = 0;
            saved = true;
            this.scrap += 12 * this.u('barrier');
        }
        else if (this.net > 0) {
            this.net--;
            saved = true;
        }
        this.bullets.forEach(b => b.view.destroy());
        this.bullets = [];
        this.lanes = [];
        this.bolts = [];
        if (saved) {
            audio.cue('ability');
            this.host.toast('EMERGENCY CORE RECOVERED');
        }
        else {
            this.combo = 0;
            this.damage(18, 'CORE LOST');
        }
        if (!this.done) {
            this.spawnBall(this.paddle.x, PY - 17);
            this.held = true;
        }
    }

    hitPaddle(b: Ball) {
        const v = rebound(b.x, this.paddle.x, this.paddle.width, this.pv);
        const speed = Math.min(520, Math.max(this.baseSpeed, Math.hypot(b.vx, b.vy) * 1.012));
        b.vx = v.x * speed;
        b.vy = v.y * speed;
        b.y = PY - 7 - b.r - .1;
        b.hits++;
        const offset = Math.abs(b.x - this.paddle.x) / (this.paddle.width / 2);
        b.precision = offset < .2 || offset > .72;
        b.charged = (this.u('charge') > 0 && b.hits % 3 === 0) || (this.host.run.ship === 'striker' && b.precision);
        if (this.u('edge') && offset > .72)
            b.pierce = this.u('edge');
        // A core that has rallied for six seconds without touching a target gets a quiet assist off the paddle.
        if (this.clock - b.lastHit > 6 && this.guide(b))
            b.lastHit = this.clock;
        this.squash = this.viewClock;
        audio.cue('paddle');
        this.burst(b.x, PY, b.charged ? 0xffee88 : 0x5ceaff, 8);
    }

    addScore(points: number, useCombo = true) {
        const gained = Math.round(points * (useCombo ? comboMultiplier(this.combo) : 1));
        this.score += gained;
        return gained;
    }

    /** Every eighth hit of an unbroken combo pays out a power capsule. */
    addCombo(x: number, y: number) {
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.comboUntil = this.clock + 3 * (1 + .35 * this.u('combo'));
        this.comboPulse = this.viewClock;
        if (this.combo % 8 === 0 && !this.collectUntil) {
            this.drop(x, y, 'power');
            audio.cue('combo');
            this.host.toast(`COMBO ×${this.combo} · POWER DROP`);
        }
    }

    hit(e: Enemy, b: Ball) {
        if (!e.alive)
            return;
        if (e.solid) {
            audio.cue('clang');
            this.burst(b.x, b.y, 0xdbe6f2, 4);
            e.flash = this.viewClock + .08;
            return;
        }
        if (e.role === 'core' && this.bossPhase === 1) {
            audio.cue('armor');
            this.burst(e.x, e.y, 0xaabbee, 5);
            return;
        }
        this.lastProgress = this.clock;
        const out = impact(e, this.host.run, this.clock, b.charged, b.precision, this.rng.next());
        let damage = out.damage;
        if (this.host.run.ship === 'striker' && this.clock < this.abilityUntil) {
            damage *= 2;
            e.armor = Math.max(0, e.armor - 1);
        }
        if (this.clock < this.overUntil)
            damage *= 1.5;
        damage *= 1 + Math.min(10, this.combo) * .025;
        this.addCombo(e.x, e.y);
        this.addScore(10);
        this.applyDamage(e, damage, true);
        audio.cue(e.armor ? 'armor' : 'hit', 1 + Math.min(14, this.combo) * .04);
        if (out.proc) {
            this.host.toast(out.proc);
            audio.cue(this.host.run.elements.includes('lightning') ? 'lightning' : this.host.run.elements.includes('ice') ? 'ice' : 'fire');
        }
        if (out.burst)
            this.explode(e.x, e.y, 65, out.burst, e.id);
        if (out.chains) {
            const range = 100 * (1 + .25 * this.u('conductor')) + (e.type === 'conductive' ? 35 : 0);
            const near = this.enemies.filter(x => x.alive && !x.solid && x.id !== e.id && Math.hypot(x.x - e.x, x.y - e.y) < range).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, Math.min(5, out.chains));
            let previous = e;
            near.forEach((n, i) => {
                this.arc(previous.x, previous.y, n.x, n.y);
                this.applyDamage(n, damage * .55 ** (i + 1), false);
                if (out.plasma && n.alive) {
                    n.burn = this.clock + 1.5;
                    n.burnPower = .2;
                }
                previous = n;
            });
            if (near.length)
                audio.cue('lightning');
        }
        if (this.u('ignite') && e.burn > this.clock) {
            const neighbor = this.enemies.find(n => n.alive && !n.solid && n.id !== e.id && Math.hypot(n.x - e.x, n.y - e.y) < 60 + 10 * this.u('ignite'));
            if (neighbor) {
                neighbor.burn = this.clock + 2;
                neighbor.burnPower = .3;
            }
        }
        b.pierce = Math.max(b.pierce, out.pierce);
        b.charged = false;
    }

    /** `direct` is true for a core impact; chains, burns, bolts and blasts are secondary. */
    applyDamage(e: Enemy, damage: number, direct: boolean) {
        if (!e.alive || e.solid || (e.role === 'core' && this.bossPhase === 1))
            return;
        const shielded = !e.role && e.type !== 'shield' && this.enemies.some(n => n.alive && n.type === 'shield' && Math.hypot(n.x - e.x, n.y - e.y) < 85);
        e.hp -= damage * (shielded ? .65 : 1);
        if (damage > .05) {
            this.burst(e.x, e.y, COLORS[e.type], e.hp <= 0 ? 14 : 4);
            e.flash = this.viewClock + .07;
        }
        if (e.hp > 0)
            return;
        e.alive = false;
        e.view.setVisible(false);
        e.label.setVisible(false);
        this.ring(e.x, e.y, COLORS[e.type], e.role ? 80 : 38);
        if (!direct)
            this.addCombo(e.x, e.y);
        const gained = this.addScore(e.role === 'core' ? 2000 : e.role ? 250 : 50);
        this.float(e.x, e.y, `+${gained}`, e.role ? '#ffd166' : '#ffffff');
        const roll = this.rng.next();
        this.sincePower++;
        if (e.type === 'prison')
            this.drop(e.x, e.y, 'rescue');
        else if (!e.role && !this.collectUntil && (roll < .1 || this.sincePower >= 11))
            this.drop(e.x, e.y, 'power');
        else if (roll < .45)
            this.drop(e.x, e.y, 'scrap');
        if (e.type === 'fuel' && direct)
            this.explode(e.x, e.y, 70 + 20 * this.u('blast'), 2, e.id);
        if (e.role) {
            this.freeze = Math.max(this.freeze, .07);
            this.shake(1.6);
        }
        if (e.role === 'core') {
            this.bossDefeated = true;
            this.enemies.forEach(n => { n.alive = false; n.view.setVisible(false); n.label.setVisible(false); });
            this.burst(e.x, e.y, 0xffcd6e, 40);
            this.ring(e.x, e.y, 0xffcd6e, 180);
            this.shake(3);
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

    explode(x: number, y: number, r: number, d: number, exclude: number) {
        const circle = this.add.circle(x, y, r, 0xff9a45, .13).setStrokeStyle(2, 0xffcb6c).setDepth(7);
        this.tweens.add({ targets: circle, alpha: 0, duration: 260, onComplete: () => circle.destroy() });
        this.shake(1.3);
        this.freeze = Math.max(this.freeze, .035);
        for (const n of this.enemies)
            if (n.alive && n.id !== exclude && Math.hypot(n.x - x, n.y - y) < r)
                this.applyDamage(n, d, false);
    }

    arc(x: number, y: number, tx: number, ty: number) {
        const g = this.add.graphics().setDepth(8);
        g.lineStyle(2, 0xfff3a0, .9);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo((x + tx) / 2 + 8, (y + ty) / 2 - 5);
        g.lineTo(tx, ty);
        g.strokePath();
        this.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
    }

    drop(x: number, y: number, kind: Drop['kind']) {
        if (this.drops.length >= 24)
            return;
        let power: PowerId | undefined;
        if (kind === 'power') {
            const pool = POWER_IDS.filter(id => id !== 'split' || this.balls.length < MAX_CORES);
            power = this.rng.pick(pool);
            this.sincePower = 0;
        }
        const view = power
            ? this.add.text(x, y, POWERS[power].label, { fontSize: '10px', fontFamily: 'system-ui', fontStyle: 'bold', color: '#07111f', backgroundColor: hex(POWERS[power].color), padding: { x: 6, y: 4 } }).setOrigin(.5).setDepth(12)
            : this.add.text(x, y, kind === 'rescue' ? '✚' : '◆', { fontSize: '19px', fontFamily: 'system-ui', color: kind === 'rescue' ? '#65f3ff' : '#ffda79', backgroundColor: '#122b3d', padding: { x: 3, y: 1 } }).setOrigin(.5).setDepth(12);
        this.drops.push({ x, y, kind, power, view, second: false });
    }

    splitCores() {
        for (const b of [...this.balls]) {
            const speed = Math.hypot(b.vx, b.vy) || this.baseSpeed, angle = Math.atan2(b.vx, -b.vy) + .5;
            const twin = this.spawnBall(b.x, b.y, Math.sin(angle) * speed, -Math.cos(angle) * speed);
            if (twin)
                this.keepLively(twin);
        }
    }

    applyPower(id: PowerId) {
        const p = POWERS[id];
        if (id === 'split') {
            if (this.held)
                this.pendingSplit = true;
            else
                this.splitCores();
        }
        if (id === 'wide')
            this.wideUntil = this.clock + p.seconds;
        if (id === 'blaster')
            this.blasterUntil = this.clock + p.seconds;
        if (id === 'overcharge')
            this.overUntil = this.clock + p.seconds;
        if (id === 'barrier')
            this.wallUntil = this.clock + p.seconds;
        this.addScore(100);
        audio.cue('power');
        this.ring(this.paddle.x, PY, p.color, 60);
        this.host.toast(p.name);
    }

    shoot(e: Enemy) {
        if (this.bullets.length >= 33)
            return;
        const count = e.role === 'core' && this.bossPhase === 2 ? 3 : 1; // the exposed reactor fires spreads; guns stay single-shot
        const stage = this.host.run.stage, vy = 125 * (this.opts.assistBullets ? .7 : 1) * (1 + .06 * stageRegion(stage) + .15 * stageLoop(stage));
        const aim = this.boss?.aimed && e.role ? Phaser.Math.Clamp((this.paddle.x - e.x) / ((PY - e.y) / vy), -85, 85) : 0;
        for (let i = 0; i < count; i++) {
            const view = this.add.triangle(e.x, e.y, 0, 0, 10, 0, 5, 13, 0xff8151).setStrokeStyle(1, 0xffe6b0).setDepth(13);
            this.bullets.push({ x: e.x, y: e.y + 16, vx: aim + (i - (count - 1) / 2) * 45, vy, view });
        }
    }

    shake(power: number) {
        this.shakeUntil = this.clock + .12;
        const s = this.opts;
        if (s.reducedMotion || s.shake <= 0)
            return;
        this.cameras.main.shake(90 + power * 30, .0035 * power * s.shake);
    }

    burst(x: number, y: number, color: number, count: number) {
        if (count >= 12)
            this.shakeUntil = this.clock + .12;
        if (this.opts.reducedMotion)
            count = Math.min(3, count);
        for (let i = 0; i < count && this.sparks.length < 160; i++) {
            const a = i * 2.399 + x * .13, speed = 40 + (i * 37 % 90);
            this.sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 30, life: .28 + (i % 4) * .08, color });
        }
    }

    ring(x: number, y: number, color: number, size: number) {
        if (this.rings.length < 24 && !this.opts.reducedMotion)
            this.rings.push({ x, y, life: .32, color, size });
    }

    float(x: number, y: number, text: string, color: string) {
        if (this.floaters.length >= 12)
            return;
        const view = this.add.text(x, y - 6, text, { fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold', color }).setOrigin(.5).setDepth(15);
        this.floaters.push({ view, life: .7 });
    }

    /** Re-aims a stalled core at the nearest target it has a clear line to (steel bumpers block the line). */
    guide(b: Ball) {
        const solids = this.enemies.filter(e => e.alive && e.solid);
        const open = (e: Enemy) => !solids.some(o => sweep(b.x, b.y, e.x - b.x, e.y - b.y, 1, o.x - o.w / 2 - b.r, o.y - o.h / 2 - b.r, o.x + o.w / 2 + b.r, o.y + o.h / 2 + b.r));
        const targets = this.enemies.filter(e => e.alive && !e.solid && !(e.role === 'core' && this.bossPhase === 1) && b.y > e.y + 40);
        if (!targets.length)
            return false;
        const nearest = targets.filter(open).sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0];
        const angle = nearest ? Phaser.Math.Clamp(Math.atan2(nearest.x - b.x, b.y - nearest.y), -1.1, 1.1) : (b.x < 210 ? .7 : -.7), speed = Math.hypot(b.vx, b.vy);
        b.vx = Math.sin(angle) * speed;
        b.vy = -Math.cos(angle) * speed;
        return true;
    }

    /** Stops a core from settling into a near-horizontal path that never comes back down. */
    keepLively(b: Ball) {
        const speed = Math.hypot(b.vx, b.vy);
        if (speed < 1)
            return;
        const min = .2 * speed;
        if (Math.abs(b.vy) >= min)
            return;
        b.vy = (b.vy > 0 || (b.vy === 0 && b.y < 320) ? 1 : -1) * min;
        b.vx = (b.vx >= 0 ? 1 : -1) * Math.sqrt(speed * speed - min * min);
    }

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
        const wanted = Math.min(200, this.baseWidth * (this.clock < this.wideUntil ? 1.4 : 1));
        if (Math.abs(this.paddle.width - wanted) > .5) {
            const next = this.paddle.width + Phaser.Math.Clamp(wanted - this.paddle.width, -220 * dt, 220 * dt);
            this.paddle.setSize(next, 14);
            this.paddle.width = next;
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
        if (this.collectUntil) {
            // Sector clear: recall every core to the ship while pickups are vacuumed in.
            for (const b of this.balls) {
                b.x += (this.paddle.x - b.x) * Math.min(1, dt * 7);
                b.y += (PY - 17 - b.y) * Math.min(1, dt * 7);
            }
        }
        else if (this.held) {
            for (const b of this.balls) {
                b.x = this.paddle.x;
                b.y = PY - 17;
            }
            if (this.holdUntil && this.clock >= this.holdUntil)
                this.launch();
        }
        else {
            for (const b of [...this.balls])
                this.moveBall(b, dt * (this.clock < this.slowUntil ? .55 : 1));
        }
        if (!this.held && !this.collectUntil) {
            this.enemyStep(dt);
            this.hazardStep(half);
            if (this.clock < this.blasterUntil && this.clock >= this.nextBolt && this.bolts.length < 24) {
                this.nextBolt = this.clock + .2;
                this.bolts.push({ x: this.paddle.x - half * .7, y: PY - 12 }, { x: this.paddle.x + half * .7, y: PY - 12 });
                audio.cue('bolt');
            }
        }
        this.boltStep(dt);
        for (const d of [...this.drops]) {
            const collecting = !!this.collectUntil;
            d.y += dt * (collecting ? 260 : d.kind === 'power' ? 120 : 100);
            const radius = 35 * this.u('magnet') + (this.host.run.ship === 'magnetar' ? 55 : 0);
            if (collecting)
                d.x += Math.sign(this.paddle.x - d.x) * Math.min(Math.abs(this.paddle.x - d.x), 320 * dt);
            else if (d.y > 470 && Math.abs(d.x - this.paddle.x) < radius + half)
                d.x += Math.sign(this.paddle.x - d.x) * Math.min(Math.abs(this.paddle.x - d.x), 140 * dt);
            if (Math.abs(d.y - PY) < 18 && Math.abs(d.x - this.paddle.x) < half + 12) {
                if (d.kind === 'rescue') {
                    this.rescueCount++;
                    this.scrap += Math.round(15 * (1 + .3 * this.u('rescue')));
                    this.float(d.x, PY - 24, `+${this.addScore(250)}`, '#65f3ff');
                    audio.cue('rescue');
                    this.host.toast('RESCUE SECURED');
                }
                else if (d.kind === 'power' && d.power)
                    this.applyPower(d.power);
                else {
                    this.scrap += Math.round(8 * (1 + .2 * this.u('scrap')));
                    this.addScore(20);
                    audio.cue('scrap');
                }
                this.burst(d.x, d.y, d.kind === 'rescue' ? 0x66ffff : d.power ? POWERS[d.power].color : 0xffd166, 10);
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
            // A core that meets enemy fire in flight destroys it.
            if (!this.held && this.balls.some(c => Math.abs(c.x - b.x) < c.r + 7 && Math.abs(c.y - b.y) < c.r + 9)) {
                this.burst(b.x, b.y, 0xffb37a, 5);
                this.addScore(15);
                b.y = 800;
            }
            else if (Math.abs(b.y - PY) < 12 && Math.abs(b.x - this.paddle.x) < half + 5) {
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
        if (this.done)
            return;
        const cleared = this.stage.boss ? this.bossDefeated : !this.enemies.some(e => e.alive && e.required);
        if (cleared && !this.collectUntil) {
            this.collectStart = this.clock;
            this.collectUntil = this.clock + (this.stage.boss ? 3 : 4);
            this.bullets.forEach(b => b.view.destroy());
            this.bullets = [];
            this.lanes = [];
            this.bolts = [];
            for (const d of this.drops.filter(d => d.kind === 'power')) {
                d.view.destroy();
                this.addScore(100, false);
            }
            this.drops = this.drops.filter(d => d.kind !== 'power');
            this.slowReal = .45;
            audio.cue('victory');
            this.host.toast(this.drops.length ? 'SECTOR CLEAR · COLLECTING' : 'SECTOR CLEAR');
        }
        if (this.collectUntil && (this.clock >= this.collectUntil || (!this.drops.length && this.clock - this.collectStart > 1.3))) {
            this.done = true;
            this.addScore(Math.round(this.shield) * 3, false);
            this.shield = Math.min(maxShield(this.host.run), this.shield + 10); // field repairs between sectors
            this.sync();
            this.host.onStageClear();
        }
    }

    boltStep(dt: number) {
        for (const bolt of [...this.bolts]) {
            bolt.y -= 640 * dt;
            let spent = bolt.y < TOP;
            for (const e of this.enemies) {
                if (spent || !e.alive || Math.abs(e.x - bolt.x) > e.w / 2 + 2 || Math.abs(e.y - bolt.y) > e.h / 2 + 5)
                    continue;
                spent = true;
                if (!e.solid && !(e.role === 'core' && this.bossPhase === 1)) {
                    this.lastProgress = this.clock;
                    this.addScore(5);
                    this.applyDamage(e, .5 * (1 + .2 * this.u('damage')), false);
                }
                this.burst(bolt.x, bolt.y, 0xff9ec0, 3);
            }
            if (spent)
                this.bolts = this.bolts.filter(x => x !== bolt);
        }
    }

    /** Plasma lanes: a telegraphed column that scorches the ship if it stays put. */
    hazardStep(half: number) {
        if (this.lanesOn && this.clock >= this.nextLane && this.balls.some(b => b.vy > 0 && b.y > 430))
            this.nextLane = this.clock + .3; // never force a choice between the lane and an incoming core
        if (this.lanesOn && this.clock >= this.nextLane) {
            this.lanes.push({ x: Phaser.Math.Clamp(this.paddle.x, 34, W - 34), at: this.clock, hit: false });
            this.nextLane = this.clock + (this.stage.boss ? 8 : 6.5) / (1 + .15 * stageLoop(this.host.run.stage));
        }
        for (const lane of [...this.lanes]) {
            const t = this.clock - lane.at;
            if (t >= 1.1 && t < 1.6 && !lane.hit && Math.abs(this.paddle.x - lane.x) < half + 20) {
                lane.hit = true;
                this.damage(6, 'PLASMA LANE');
            }
            if (t >= 1.1 && t - 1 / 120 < 1.1)
                audio.cue('fire');
            if (t > 1.7)
                this.lanes = this.lanes.filter(x => x !== lane);
        }
    }

    moveBall(b: Ball, dt: number) {
        if (this.well) {
            const dx = this.well.x - b.x, dy = this.well.y - b.y, d = Math.hypot(dx, dy);
            if (d > 20 && d < 230) {
                const speed = Math.hypot(b.vx, b.vy), pull = 430 * (1 - d / 230) * dt;
                b.vx += dx / d * pull;
                b.vy += dy / d * pull;
                const now = Math.hypot(b.vx, b.vy) || 1;
                b.vx *= speed / now;
                b.vy *= speed / now;
                this.keepLively(b);
            }
        }
        // A moving target can slide over a core between steps; push the core out and count the hit.
        let stillThrough = false;
        for (const e of this.enemies) {
            if (!e.alive)
                continue;
            const hw = e.w / 2 + b.r, hh = e.h / 2 + b.r, dx = b.x - e.x, dy = b.y - e.y;
            if (Math.abs(dx) >= hw - .05 || Math.abs(dy) >= hh - .05)
                continue;
            if (e.id === b.through) {
                stillThrough = true;
                continue;
            }
            if (b.lastEnemy === e.id && this.clock - b.lastHit < .04)
                continue;
            if (hw - Math.abs(dx) < hh - Math.abs(dy)) {
                const side = dx >= 0 ? 1 : -1;
                b.x = e.x + side * (hw + .1);
                if (b.vx * side < 0)
                    b.vx = -b.vx;
            }
            else {
                const side = dy >= 0 ? 1 : -1;
                b.y = e.y + side * (hh + .1);
                if (b.vy * side < 0)
                    b.vy = -b.vy;
            }
            b.lastHit = this.clock;
            b.lastEnemy = e.id;
            this.hit(e, b);
            break;
        }
        if (!stillThrough)
            b.through = -1;
        let remaining = dt;
        for (let i = 0; i < 8 && remaining > .000001; i++) {
            type Contact = {
                time: number;
                nx: number;
                ny: number;
                enemy?: Enemy;
                paddle?: boolean;
                wall?: boolean;
            };
            const candidates: Contact[] = [];
            const consider = (h: Contact | null) => {
                if (h && h.time >= 0 && h.time <= remaining)
                    candidates.push(h);
            };
            if (b.vx < 0)
                consider({ time: (LEFT + b.r - b.x) / b.vx, nx: 1, ny: 0 });
            if (b.vx > 0)
                consider({ time: (RIGHT - b.r - b.x) / b.vx, nx: -1, ny: 0 });
            if (b.vy < 0)
                consider({ time: (TOP + b.r - b.y) / b.vy, nx: 0, ny: 1 });
            if (b.vy > 0) {
                const h = sweep(b.x, b.y, b.vx, b.vy, remaining, this.paddle.x - this.paddle.width / 2 - b.r, PY - 7 - b.r, this.paddle.x + this.paddle.width / 2 + b.r, PY + 7 + b.r);
                if (h)
                    consider({ ...h, paddle: true });
                if (this.clock < this.wallUntil && b.y <= WALL_Y - b.r)
                    consider({ time: (WALL_Y - b.r - b.y) / b.vy, nx: 0, ny: -1, wall: true });
            }
            for (const e of this.enemies) {
                if (!e.alive || e.id === b.through || (b.lastEnemy === e.id && this.clock - b.lastHit < .04))
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
                let pass = false;
                const e = h.enemy;
                if (e) {
                    b.lastHit = this.clock;
                    b.lastEnemy = e.id;
                    const armored = e.solid || (e.role === 'core' && this.bossPhase === 1);
                    this.hit(e, b);
                    if (!armored) {
                        if (b.pierce > 0) {
                            b.pierce--;
                            pass = true;
                        }
                        else if (!e.alive && this.clock < this.overUntil)
                            pass = true;
                    }
                    if (pass && e.alive)
                        b.through = e.id;
                }
                else if (h.wall) {
                    audio.cue('wall');
                    this.burst(b.x, WALL_Y, 0x8cff9e, 6);
                }
                if (!pass) {
                    if (h.nx)
                        b.vx = -b.vx;
                    if (h.ny)
                        b.vy = -b.vy;
                    this.keepLively(b);
                }
                b.x += Math.sign(b.vx) * .1;
                b.y += Math.sign(b.vy) * .1;
            }
            remaining = Math.max(0, remaining - .00001);
        }
        for (let i = 0; i < this.portals.length; i++) {
            const p = this.portals[i];
            if (this.clock < b.portalAt || Math.hypot(b.x - p.x, b.y - p.y) > 17)
                continue;
            const exit = this.portals[1 - i];
            this.burst(p.x, p.y, 0xb78cff, 8);
            b.x = exit.x;
            b.y = exit.y;
            b.portalAt = this.clock + .7;
            b.trail = [];
            this.burst(exit.x, exit.y, 0xb78cff, 8);
            this.ring(exit.x, exit.y, 0xb78cff, 40);
            audio.cue('portal');
            break;
        }
        if (this.clock - this.lastProgress > 9 && b.y > 300 && this.guide(b)) {
            this.lastProgress = this.clock;
            this.host.toast('CORE GUIDANCE CORRECTION');
        }
        if (b.y > 760)
            this.loseBall(b);
    }

    enemyStep(dt: number) {
        const loop = stageLoop(this.host.run.stage), bossMoves = this.bossPhase === 2 || !!this.boss?.sway;
        for (const e of this.enemies) {
            if (!e.alive || e.solid)
                continue;
            const frozen = e.frozen > this.clock;
            if (!frozen) {
                if (e.type === 'interceptor' && !e.role)
                    e.x = e.baseX + Math.sin(this.clock * 1.2) * 20;
                else if (e.role && bossMoves)
                    e.x = e.baseX + Math.sin(this.clock * .8) * 28;
                else if (this.mod === 'moving' && !e.role)
                    e.x = e.baseX + Math.sin(this.clock * .9) * (e.row % 2 ? -20 : 20);
            }
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
                    e.nextShot = this.clock + (e.role ? 2.3 : 4) / (1 + .1 * loop);
                    e.telegraph = 0;
                }
            }
            if (e.type === 'repair' && this.clock > e.nextShot) {
                const n = this.enemies.find(n => n.alive && !n.solid && n.id !== e.id && n.hp < n.max);
                if (n) {
                    n.hp = Math.min(n.max, n.hp + .4);
                    this.ring(n.x, n.y, 0x65e6a7, 26);
                }
                e.nextShot = this.clock + 6;
            }
        }
        if (this.bossPhase === 2 && this.clock > this.nextEscort && this.enemies.filter(e => e.alive && !e.role).length < 3) {
            this.spawnEnemy('interceptor', 80 + (this.rng.next() * 260), 250, Math.round(2 * difficulty(this.host.run.stage)), undefined, false);
            this.nextEscort = this.clock + (this.boss?.plates === 3 ? 7 : 9);
        }
    }

    sync() {
        const run = this.host.run;
        run.shield = this.shield;
        run.scrap = this.scrap;
        run.rescued = this.rescueCount;
        run.score = this.score;
        if (this.consumed)
            run.consumable = false;
        this.host.onHud({ shield: this.shield, scrap: this.scrap, stage: run.stage, score: this.score });
    }

    update(_: number, delta: number) {
        if (!this.paddle)
            return;
        const real = Math.min(.05, delta / 1000);
        this.viewClock += real;
        if (this.freeze > 0)
            this.freeze -= real;
        else {
            this.slowReal = Math.max(0, this.slowReal - real);
            this.acc += real * (this.slowReal > 0 ? .35 : 1);
            let steps = 0;
            while (this.acc >= 1 / 120 && steps++ < 6) {
                this.step(1 / 120);
                this.acc -= 1 / 120;
                if (this.done)
                    break;
            }
        }
        if (this.done)
            return;
        this.draw(real);
    }

    draw(real: number) {
        const s = this.opts, motion = !s.reducedMotion, fx = this.fx, ov = this.ov, now = this.viewClock;
        const over = this.clock < this.overUntil;
        fx.clear();
        ov.clear();
        // Cores, glow and trails
        for (const b of this.balls) {
            const color = over ? 0xff8a3c : b.view.fillColor;
            b.view.setPosition(b.x, b.y);
            b.glow.setPosition(b.x, b.y).setScale(over ? 1.5 : b.charged ? 1.25 : 1);
            b.view.setStrokeStyle(b.charged ? 3 : 2, b.charged ? 0xffef77 : over ? 0xffd9a0 : 0xffffff);
            if (motion && !this.held) {
                b.trail.push(b.x, b.y);
                if (b.trail.length > 24)
                    b.trail.splice(0, 2);
            }
            else
                b.trail.length = 0;
            const n = b.trail.length / 2;
            for (let i = 0; i < n; i++) {
                fx.fillStyle(color, .05 + .3 * i / n);
                fx.fillCircle(b.trail[i * 2], b.trail[i * 2 + 1], b.r * (.35 + .6 * i / n));
            }
        }
        // Targets
        const shaking = this.clock < this.shakeUntil && motion;
        for (const e of this.enemies) {
            if (!e.alive)
                continue;
            const t = motion ? Phaser.Math.Clamp((now - e.intro) / .32, 0, 1) : 1, ease = 1 - (1 - t) ** 3;
            let alpha = ease, x = e.x, y = e.y - (1 - ease) * 70;
            if (shaking)
                x += Math.sin(this.clock * 90 + e.id) * 2 * s.shake;
            if (this.mod === 'blackout' && !e.telegraph) {
                const near = Math.min(...this.balls.map(b => Math.hypot(b.x - e.x, b.y - e.y)));
                alpha *= Phaser.Math.Clamp(1 - (near - 95) / 85, .1, 1);
            }
            const frozen = e.frozen > this.clock, burning = e.burn > this.clock;
            e.view.setPosition(x, y).setAlpha(alpha).setFillStyle(e.flash > now ? 0xffffff : frozen ? 0x9beaff : burning ? 0xff8753 : COLORS[e.type]);
            e.view.setStrokeStyle(e.armor || e.solid ? 3 : 1, e.telegraph ? 0xffee99 : 0xffffff, e.telegraph ? .5 + Math.sin(this.clock * 24) * .5 : .7);
            e.label.setPosition(x, y).setAlpha(alpha);
            if (e.type === 'armored')
                e.label.setText(e.armor ? 'I'.repeat(e.armor) : '◇');
            ov.fillStyle(0xffffff, .2 * alpha);
            ov.fillRect(x - e.w / 2 + 3, y - e.h / 2 + 2, e.w - 6, e.h * .32);
            ov.fillStyle(0x000000, .2 * alpha);
            ov.fillRect(x - e.w / 2 + 3, y + e.h / 2 - 6, e.w - 6, 4);
            if (e.hp < e.max && !e.solid) {
                fx.fillStyle(0x000000, .5 * alpha);
                fx.fillRect(x - e.w / 2, y + e.h / 2 + 3, e.w, 2);
                fx.fillStyle(e.hp / e.max < .35 ? 0xff8a6c : 0xffffff, .85 * alpha);
                fx.fillRect(x - e.w / 2, y + e.h / 2 + 3, e.w * Math.max(0, e.hp / e.max), 2);
            }
            if (burning && motion) {
                fx.fillStyle(0xffc46b, .8);
                const flick = Math.sin(now * 30 + e.id) * 3;
                fx.fillTriangle(x - 8, y - e.h / 2, x, y - e.h / 2 - 9 - flick, x + 8, y - e.h / 2);
            }
            if (e.telegraph) {
                fx.lineStyle(1, 0xffb266, .25);
                fx.lineBetween(x, y + 20, this.boss?.aimed && e.role ? this.paddle.x : x, PY - 30);
            }
        }
        this.drops.forEach(d => d.view.setPosition(d.x, d.y + (motion ? Math.sin(now * 6 + d.x) * 2 : 0)));
        this.bullets.forEach(b => b.view.setPosition(b.x, b.y));
        // Arena modifiers
        for (const lane of this.lanes) {
            const t = this.clock - lane.at;
            if (t < 1.1) {
                fx.fillStyle(0xff7a3c, .08 + .08 * Math.abs(Math.sin(t * 14)));
                fx.fillRect(lane.x - 22, TOP, 44, 720 - TOP);
                fx.lineStyle(1, 0xffb266, .7);
                fx.lineBetween(lane.x - 22, TOP, lane.x - 22, 720);
                fx.lineBetween(lane.x + 22, TOP, lane.x + 22, 720);
            }
            else if (t < 1.6) {
                fx.fillStyle(0xffe2b0, .8 - (t - 1.1));
                fx.fillRect(lane.x - 22, TOP, 44, 720 - TOP);
                fx.fillStyle(0xffffff, .7);
                fx.fillRect(lane.x - 7, TOP, 14, 720 - TOP);
            }
        }
        this.portals.forEach((p, i) => {
            fx.lineStyle(3, i ? 0xff9ee6 : 0xb78cff, .9);
            fx.strokeCircle(p.x, p.y, 15 + Math.sin(now * 5 + i) * 2);
            fx.lineStyle(1, 0xffffff, .6);
            fx.strokeCircle(p.x, p.y, 8 + Math.sin(now * 8 + i) * 2);
            fx.fillStyle(i ? 0xff9ee6 : 0xb78cff, .18);
            fx.fillCircle(p.x, p.y, 15);
        });
        if (this.well) {
            for (let i = 0; i < 3; i++) {
                const r = 96 - ((now * 34 + i * 32) % 96);
                fx.lineStyle(1.5, 0x9d8cff, .45 * r / 96);
                fx.strokeCircle(this.well.x, this.well.y, r);
            }
            fx.fillStyle(0x9d8cff, .5);
            fx.fillCircle(this.well.x, this.well.y, 5);
        }
        // Boss hull
        if (this.hull) {
            const g = this.hull;
            g.clear();
            const core = this.enemies.find(e => e.role === 'core')!;
            if (!this.bossDefeated) {
                const dx = core.x - core.baseX;
                g.fillStyle(0x162d42);
                g.lineStyle(2, 0x4d6b83);
                const points = [[40, 130], [125, 112], [295, 112], [380, 130], [365, 178], [300, 178], [275, 220], [145, 220], [120, 178], [55, 178]].map(([x, y]) => new Phaser.Geom.Point(x + dx, y));
                g.fillPoints(points, true);
                g.strokePoints(points, true);
                g.fillStyle(this.bossPhase === 2 ? 0xff9050 : 0x53728d, .7);
                g.fillRect(187 + dx, 170, 46, 6);
                g.fillRect(202 + dx, 188, 16, 24);
            }
            g.fillStyle(0x26384a);
            g.fillRect(100, 104, 220, 3);
            g.fillStyle(0xffa862);
            g.fillRect(100, 104, 220 * Math.max(0, core.hp / core.max), 3);
        }
        // Blaster bolts
        fx.fillStyle(0xff9ec0, 1);
        for (const bolt of this.bolts)
            fx.fillRect(bolt.x - 1.5, bolt.y - 7, 3, 12);
        // Particles
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const p = this.sparks[i];
            p.life -= real;
            if (p.life <= 0) {
                this.sparks.splice(i, 1);
                continue;
            }
            p.vy += 260 * real;
            p.x += p.vx * real;
            p.y += p.vy * real;
            fx.fillStyle(p.color, Math.min(1, p.life / .3));
            fx.fillRect(p.x, p.y, 3, 3);
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.life -= real;
            if (r.life <= 0) {
                this.rings.splice(i, 1);
                continue;
            }
            const k = 1 - r.life / .32;
            fx.lineStyle(2, r.color, 1 - k);
            fx.strokeCircle(r.x, r.y, 6 + r.size * k);
        }
        for (let i = this.floaters.length - 1; i >= 0; i--) {
            const f = this.floaters[i];
            f.life -= real;
            if (f.life <= 0) {
                f.view.destroy();
                this.floaters.splice(i, 1);
                continue;
            }
            f.view.y -= 42 * real;
            f.view.setAlpha(Math.min(1, f.life / .35));
        }
        // Ship
        const half = this.paddle.width / 2, squash = Math.max(0, .12 - (now - this.squash)) / .12;
        this.paddle.setScale(1 + squash * .06, 1 - squash * .3);
        this.paddle.setFillStyle(this.clock < this.blasterUntil ? 0xff8fb5 : this.clock < this.wideUntil ? 0x8ff5ff : 0x4de9ff);
        this.paddle.setAlpha(this.clock < this.invulnerable ? .5 + .5 * Math.abs(Math.sin(this.clock * 15)) : 1);
        fx.fillStyle(0x4de9ff, .1);
        fx.fillRect(this.paddle.x - half - 5, PY - 12, this.paddle.width + 10, 24);
        if (motion) {
            const flame = 6 + Math.abs(Math.sin(now * 22)) * 6 + Math.min(8, Math.abs(this.pv) / 60);
            fx.fillStyle(0xffb35e, .7);
            fx.fillTriangle(this.paddle.x - half * .55 - 5, PY + 7, this.paddle.x - half * .55, PY + 7 + flame, this.paddle.x - half * .55 + 5, PY + 7);
            fx.fillTriangle(this.paddle.x + half * .55 - 5, PY + 7, this.paddle.x + half * .55, PY + 7 + flame, this.paddle.x + half * .55 + 5, PY + 7);
        }
        this.aim.clear();
        if (this.held && !this.collectUntil) {
            const d = rebound(this.paddle.x, this.paddle.x, this.paddle.width, this.pv);
            for (let i = 1; i <= 7; i++) {
                this.aim.fillStyle(0x75efff, .75 - i * .09);
                this.aim.fillCircle(this.paddle.x + d.x * i * 16, PY - 22 + d.y * i * 16, 2);
            }
        }
        if (this.host.run.ship === 'guardian' && this.clock < this.abilityUntil) {
            this.aim.lineStyle(4, 0x5ceaff, .8);
            this.aim.lineBetween(12, 715, 408, 715);
        }
        const wallLeft = this.wallUntil - this.clock;
        if (wallLeft > 0 && (wallLeft > 2 || Math.sin(now * 20) > 0)) {
            this.aim.lineStyle(4, 0x8cff9e, .85);
            this.aim.lineBetween(LEFT, WALL_Y, RIGHT, WALL_Y);
            this.aim.lineStyle(10, 0x8cff9e, .15);
            this.aim.lineBetween(LEFT, WALL_Y, RIGHT, WALL_Y);
        }
        // HUD
        this.shownScore += (this.score - this.shownScore) * Math.min(1, real * 10);
        if (this.score - this.shownScore < 1)
            this.shownScore = this.score;
        this.scoreText.setText(Math.round(this.shownScore).toLocaleString('en-US'));
        const mult = comboMultiplier(this.combo);
        this.comboText.setText(this.combo > 1 ? `×${this.combo} COMBO${mult > 1 ? `  ·  ${mult}× SCORE` : ''}` : '');
        this.comboText.setScale(1 + Math.max(0, .18 - (now - this.comboPulse)) * 1.6);
        if (this.combo > 1) {
            const window = 3 * (1 + .35 * this.u('combo'));
            fx.fillStyle(0xffd166, .8);
            fx.fillRect(408 - 70 * Math.max(0, (this.comboUntil - this.clock) / window), 54, 70 * Math.max(0, (this.comboUntil - this.clock) / window), 2);
        }
        if (this.clock > this.hudAt) {
            this.hudAt = this.clock + .1;
            this.host.onHud({ shield: this.shield, scrap: this.scrap, stage: this.host.run.stage, score: this.score });
            const cd = Math.max(0, Math.ceil(this.abilityReady - this.clock));
            this.hud.setText(`SHIELD ${Math.ceil(this.shield)}/${maxShield(this.host.run)}  ·  SCRAP ${this.scrap}  ·  ${this.balls.length} CORE\n${this.host.run.elements.map(e => e.toUpperCase()).join(' + ')}  ·  ${cd ? `ABILITY ${cd}s` : 'ABILITY READY'}`);
            const timers: [string, number][] = [[POWERS.wide.label, this.wideUntil], [POWERS.blaster.label, this.blasterUntil], [POWERS.overcharge.label, this.overUntil], [POWERS.barrier.label, this.wallUntil]];
            this.powerText.setText(timers.filter(([, until]) => until > this.clock).map(([label, until]) => `${label} ${Math.ceil(until - this.clock)}`).join('   '));
            this.shieldBar.width = 396 * Math.max(0, this.shield) / maxShield(this.host.run);
            this.shieldBar.setFillStyle(this.shield < 30 ? 0xff7755 : 0x55eaff);
            if (this.stage.boss) {
                const core = this.enemies.find(e => e.role === 'core')!;
                this.bossText.setText(`${(this.stage.boss ?? '').toUpperCase()} · ${this.bossPhase === 1 ? 'BREAK ARMOR' : 'REACTOR EXPOSED'} · ${Math.ceil(Math.max(0, core.hp))}/${core.max}`);
            }
            const button = document.querySelector<HTMLButtonElement>('[data-ability]');
            if (button) {
                button.textContent = cd ? `ABILITY ${cd}s` : 'ABILITY';
                button.disabled = cd > 0;
            }
        }
    }

    useConsumable() {
        if (!this.host.run.consumable || this.consumed)
            return;
        this.consumed = true;
        this.shield = Math.min(maxShield(this.host.run), this.shield + 25);
        audio.cue('ability');
        this.host.toast('REPAIR KIT · +25 SHIELD');
        document.querySelector('[data-kit]')?.remove();
    }
}

export function createGame(parent: string, host: Host) {
    const game = new Phaser.Game({ type: Phaser.AUTO, parent, width: W, height: H, backgroundColor: '#07111f', input: { gamepad: true }, scene: [], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, callbacks: { postBoot: g => { g.scene.add('battle', BattleScene, true, host); } } });
    const controls = document.createElement('div');
    controls.className = 'play-controls';
    const get = () => game.scene.getScene('battle') as BattleScene;
    const actions: [string, () => void, string?][] = [['PAUSE', () => host.onPause()], ['LAUNCH', () => get().launch()], ['ABILITY', () => get().ability(), 'ability']];
    if (host.progress.settings.leftHanded)
        actions.reverse();
    if (host.run.consumable)
        actions.push(['KIT +25', () => get().useConsumable(), 'kit']);
    for (const [label, action, key] of actions) {
        const b = document.createElement('button');
        b.textContent = label;
        if (key)
            b.dataset[key] = '';
        b.onclick = () => { audio.unlock(); action(); };
        controls.append(b);
    }
    document.getElementById(parent)!.parentElement!.append(controls);
    return game;
}
