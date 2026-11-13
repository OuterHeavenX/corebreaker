import Phaser from 'phaser';
import { BOSSES, ELEMENTS, POWERS, POWER_IDS, SHIPS, STAGES, SYMBOL_TO_ENEMY, comboMultiplier, difficulty, enemyHp, stageLoop, stageRegion } from './data';
import type { BossDef } from './data';
import { rebound, RNG } from './sim';
import { impact, rank, maxShield, synergyName } from './combat';
import type { Target } from './combat';
import { audio } from './audio';
import { sweep } from './physics';
import { buildTextures, ENEMY_COLORS, ROW_COLORS, SHIP_COLORS, TS } from './gfx';
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

const W = 420, H = 760, PY = 674, TOP = 96, LEFT = 8, RIGHT = 412, WALL_Y = 708, MAX_CORES = 5, ROW_H = 31, COL_W = 54, EXTRA_ROWS = 2;
/** Canvas pixels per world unit. 2 on high-DPI screens so sprites and text stay sharp. */
let RES = 1;
const COLORS = ENEMY_COLORS;
const REGION_BG = ['#050c18', '#120a0c', '#07071a', '#140508'];
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
    color: number;
    view: Phaser.GameObjects.Image;
    glow: Phaser.GameObjects.Image;
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
    color: number;
    view: Phaser.GameObjects.Image;
    max: number;
    nextShot: number;
    telegraph: number;
    role?: 'gun' | 'plate' | 'core';
    required: boolean;
    alive: boolean;
    solid: boolean;
    intro: number;
    flash: number;
    kick: number;
};
type Drop = {
    x: number;
    y: number;
    kind: 'rescue' | 'scrap' | 'power';
    power?: PowerId;
    second: boolean;
    view: Phaser.GameObjects.Image;
};
type Bullet = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    view: Phaser.GameObjects.Image;
};
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: number };
type Debris = Spark & { size: number };
type Ring = { x: number; y: number; life: number; color: number; size: number };
type Flash = { x: number; y: number; life: number; color: number; size: number };
type Bolt = { points: number[]; life: number };
type Floater = { view: Phaser.GameObjects.Text; life: number };

export class BattleScene extends Phaser.Scene {
    host!: Host;
    stage!: StageDef;
    rng!: RNG;
    paddle!: Phaser.GameObjects.Rectangle;
    paddleView!: Phaser.GameObjects.Image;
    paddleKey = 'paddle';
    aim!: Phaser.GameObjects.Graphics;
    fx!: Phaser.GameObjects.Graphics;
    glow!: Phaser.GameObjects.Graphics;
    backGlow!: Phaser.GameObjects.Graphics;
    stars: { x: number; y: number; layer: number; tint: number }[] = [];
    comboTier = -1;
    danger!: Phaser.GameObjects.Image;
    flashRect!: Phaser.GameObjects.Rectangle;
    bannerText!: Phaser.GameObjects.Text;
    bannerSub!: Phaser.GameObjects.Text;
    hud!: Phaser.GameObjects.Text;
    scoreText!: Phaser.GameObjects.Text;
    comboText!: Phaser.GameObjects.Text;
    powerText!: Phaser.GameObjects.Text;
    bossText!: Phaser.GameObjects.Text;
    shieldBar!: Phaser.GameObjects.Rectangle;
    hull?: Phaser.GameObjects.Image;
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
    debrisBits: Debris[] = [];
    rings: Ring[] = [];
    flashes: Flash[] = [];
    arcs: Bolt[] = [];
    floaters: Floater[] = [];
    frame = 0;
    flashAlpha = 0;
    dangerPulse = 0;
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
        const s = this.opts, stage = this.host.run.stage, region = stageRegion(stage), loop = stageLoop(stage), tone = REGION_GLOW[region];
        audio.settings = s;
        audio.mode = this.stage.boss ? 'boss' : 'battle';
        audio.region = region;
        audio.intensity = 0;
        const cam = this.cameras.main;
        cam.setBackgroundColor(REGION_BG[region]);
        cam.setZoom(RES);
        cam.centerOn(W / 2, H / 2);
        const ship = SHIPS.find(x => x.id === this.host.run.ship)!;
        this.baseWidth = Math.min(160, ship.width * (1 + .12 * this.u('wide')) * (s.assistWidth ? 1.2 : 1));
        if ((this.textures as any)?.createCanvas)
            buildTextures(this, { ship: ship.id, width: this.baseWidth, region, W, H, restored: this.host.progress.rescues > 5 });
        // Backdrop: nebula, three parallax star layers, city skyline
        this.add.image(W / 2, H / 2, 'bg').setDisplaySize(W, H).setDepth(0);
        this.stars = Array.from({ length: 70 }, (_, i) => ({ x: (i * 197 + 31) % W, y: TOP + (i * 131) % (H - TOP - 60), layer: i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0, tint: i % 5 === 0 ? tone : 0xffffff }));
        this.backGlow = this.add.graphics().setDepth(.5).setBlendMode(1);
        this.add.rectangle(210, 720, 404, 1, tone, .55).setDepth(1);
        for (let i = 0; i < 9 && !s.reducedMotion; i++) {
            const light = this.add.rectangle(18 + (i * 97) % 390, 742 - (i * 31) % 70, 3, 4, i % 3 ? tone : 0xffd79a, .9).setDepth(1);
            this.tweens.add({ targets: light, alpha: .1, duration: 500 + (i % 5) * 330, yoyo: true, repeat: -1, delay: i * 190 });
        }
        // HUD
        this.mod = this.stage.boss ? 'boss' : this.stage.modifier ?? '';
        const tag = MOD_LABEL[this.mod] ? `  //  ${MOD_LABEL[this.mod]}` : '';
        this.add.rectangle(W / 2, 46, W, 92, 0x02060c, .55).setDepth(9.5);
        this.add.rectangle(W / 2, 92.5, W, 1, tone, .45).setDepth(9.5);
        this.label(12, 12, `${this.stage.region}  //  ${stage}${loop ? `  //  LOOP ${loop + 1}` : ''}${tag}`, 10, '#8ca9bf', false);
        this.label(12, 28, this.stage.name.toUpperCase(), 18, '#e8fbff').setFontStyle('bold italic');
        this.hud = this.label(12, 54, '', 11, '#b7eaff', false);
        this.scoreText = this.label(408, 8, '0', 22, '#ffffff').setOrigin(1, 0).setFontStyle('bold italic').setStroke('#04101c', 4);
        this.comboText = this.label(408, 35, '', 13, '#ffd166').setOrigin(1, 0).setFontStyle('bold italic').setStroke('#04101c', 3);
        this.powerText = this.label(408, 66, '', 10, '#8cff9e').setOrigin(1, 0);
        this.add.rectangle(12, 84, 396, 4, 0x0d2233).setOrigin(0, .5).setDepth(10);
        this.shieldBar = this.add.rectangle(12, 84, 396, 4, 0x55eaff).setOrigin(0, .5).setDepth(10);
        this.bossText = this.label(210, 96, '', 10, '#ffd6a3').setOrigin(.5);
        // Ship
        this.paddle = this.add.rectangle(210, PY, this.baseWidth, 14, 0x4de9ff).setVisible(false);
        this.paddleView = this.add.image(210, PY + 4, 'paddle').setScale(1 / TS).setDepth(20);
        this.glow = this.add.graphics().setDepth(8).setBlendMode(1);
        this.fx = this.add.graphics().setDepth(9);
        this.aim = this.add.graphics().setDepth(9).setBlendMode(1);
        // Screen overlays
        this.danger = this.add.image(W / 2, H / 2, 'danger').setDisplaySize(W, H).setDepth(41).setAlpha(0);
        this.flashRect = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff).setDepth(42).setBlendMode(1).setAlpha(0);
        this.bannerText = this.add.text(210, 336, '', { fontFamily: 'system-ui, sans-serif', fontSize: '34px', fontStyle: 'bold italic', color: '#ffffff' }).setOrigin(.5).setDepth(45).setAlpha(0).setResolution(RES).setStroke('#03101c', 7);
        this.bannerSub = this.add.text(210, 368, '', { fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#cfefff' }).setOrigin(.5).setDepth(45).setAlpha(0).setResolution(RES).setStroke('#03101c', 4);
        this.spawnBall(210, PY - 17);
        // Targets: the authored formation sits under two extra rows, packed into a wall
        if (this.stage.boss)
            this.buildBoss();
        else {
            const cols = Math.max(...this.stage.layout.map(r => r.length));
            const wall = [...Array(EXTRA_ROWS).fill('s'.repeat(cols)), ...this.stage.layout];
            wall.forEach((row, y) => [...row].forEach((c, x) => this.spawnEnemy(SYMBOL_TO_ENEMY[c] ?? 'scout', 210 - (row.length - 1) * COL_W / 2 + x * COL_W, 119 + y * ROW_H)));
        }
        if (this.mod === 'barrier') {
            this.spawnBumper(105, 330);
            this.spawnBumper(315, 330);
        }
        if (this.mod === 'portal')
            this.portals = [{ x: 52, y: 450 }, { x: 368, y: 330 }];
        if (this.mod === 'gravity')
            this.well = { x: 210, y: 430 };
        this.lanesOn = this.mod === 'plasma' || !!this.boss?.lanes;
        this.keys = this.input.keyboard!.addKeys('A,D,LEFT,RIGHT');
        this.input.keyboard!.on('keydown-SPACE', () => this.launch());
        this.input.keyboard!.on('keydown-E', () => this.ability());
        this.input.keyboard!.on('keydown-SHIFT', () => this.ability());
        this.input.keyboard!.on('keydown-ESC', () => this.host.onPause());
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (p.wasTouch && !p.isDown)
                return;
            if (s.directTouch || !p.wasTouch)
                this.target = p.x / RES;
            else
                this.target += (p.position.x - p.prevPosition.x) / RES * s.touchSensitivity;
        });
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            audio.unlock();
            if (!p.wasTouch)
                this.launch();
            else if (s.directTouch)
                this.target = p.x / RES;
        });
        // A quick tap (not a drag) launches on touch screens, matching the on-screen LAUNCH button.
        this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
            if (p.wasTouch && p.getDuration() < 260 && p.getDistance() < 14 * RES)
                this.launch();
        });
        document.addEventListener('visibilitychange', this.visibility);
        this.events.once('shutdown', () => document.removeEventListener('visibilitychange', this.visibility));
        this.events.on('pause', () => { audio.mode = 'silent'; });
        this.events.on('resume', () => { this.acc = 0; audio.unlock(); audio.mode = this.stage.boss ? 'boss' : 'battle'; });
        if (this.stage.boss)
            this.banner('WARNING', (this.stage.boss ?? '').toUpperCase() + ' INBOUND', 0xff5c6c, 1300);
        else
            this.banner(`STAGE ${stage}`, this.stage.name.toUpperCase(), tone, 1000);
        if (this.stage.tutorial && !this.stage.boss && !loop)
            this.host.toast(this.stage.tutorial);
        else if (MOD_TOAST[this.mod])
            this.host.toast(MOD_TOAST[this.mod]);
        this.sync();
    }

    label(x: number, y: number, text: string, size: number, color: string, bold = true) {
        return this.add.text(x, y, text, { fontFamily: 'system-ui, sans-serif', fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color }).setResolution(RES).setDepth(10);
    }

    /** Big centre-screen callout that slams in and fades. */
    banner(title: string, sub = '', color = 0xffffff, hold = 800) {
        const t = this.bannerText, u = this.bannerSub, motion = !this.opts.reducedMotion;
        this.tweens.killTweensOf([t, u]);
        t.setText(title).setColor(hex(color)).setAlpha(motion ? 0 : 1).setScale(motion ? 2.2 : 1, 1);
        u.setText(sub).setAlpha(motion ? 0 : 1);
        if (motion) {
            this.tweens.add({ targets: t, alpha: 1, scaleX: 1, duration: 150, ease: 'Cubic.easeOut' });
            this.tweens.add({ targets: u, alpha: 1, duration: 200, delay: 90 });
        }
        this.tweens.add({ targets: [t, u], alpha: 0, duration: 280, delay: hold });
    }

    screenFlash(color: number, alpha: number) {
        if (this.opts.reducedMotion)
            return;
        this.flashRect.setFillStyle(color);
        this.flashAlpha = Math.max(this.flashAlpha, alpha);
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
        const glow = this.add.image(x, y, 'orb').setDisplaySize(r * 8, r * 8).setTint(color).setDepth(29).setBlendMode(1);
        const view = this.add.image(x, y, 'hot').setDisplaySize(r * 2.7, r * 2.7).setDepth(30);
        const ball: Ball = { x, y, vx, vy, r, color, view, glow, charged: false, precision: false, pierce: 0, hits: 0, lastHit: this.clock, lastEnemy: -1, through: -1, portalAt: 0, trail: [] };
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
        const w = role === 'core' ? 108 : role === 'plate' ? 68 : 48, h = role ? 30 : 25, row = Math.max(0, Math.round((y - 119) / ROW_H));
        const rainbow = type === 'scout' && !role, color = rainbow ? ROW_COLORS[row % ROW_COLORS.length] : COLORS[role ?? type];
        const view = this.add.image(x, y, rainbow ? `e-scout-${row % ROW_COLORS.length}` : `e-${role ?? type}`).setScale(1 / TS).setDepth(5);
        const e: Enemy = { id: ++this.id, x, y, baseX: x, row, w, h, type, color, view, max, hp: max, armor: type === 'armored' ? 3 : 0, chill: 0, frozen: 0, burn: 0, burnPower: 0, procAt: 0, boss: !!role, nextShot: this.clock + 2 + this.rng.next() * 2, telegraph: 0, role, required, alive: true, solid: false, intro: this.viewClock + (row * 6 + Math.abs(x - 210) / COL_W) * .022, flash: 0, kick: -9 };
        this.enemies.push(e);
        return e;
    }

    /** Indestructible deflector used by the "barrier" arena modifier. */
    spawnBumper(x: number, y: number) {
        const e = this.spawnEnemy('reflector', x, y, 1, undefined, false);
        e.solid = true;
        e.w = 64;
        e.h = 14;
        e.color = COLORS.bumper;
        e.view.setTexture('e-bumper');
        return e;
    }

    buildBoss() {
        const cfg = this.boss = BOSSES[this.stage.boss ?? ''] ?? BOSSES['Siege Carrier'];
        const loop = 1 + .6 * stageLoop(this.host.run.stage), part = (n: number) => Math.round(n * cfg.parts * loop);
        this.hull = this.add.image(210, 167, 'hull').setScale(1 / TS).setDepth(2);
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
        this.ring(this.paddle.x, PY, 0xffffff, 130);
        this.screenFlash(SHIP_COLORS[ship], .18);
        this.host.toast(SHIPS.find(s => s.id === ship)!.ability.toUpperCase());
    }

    damage(amount: number, reason: string) {
        if (this.clock < this.invulnerable || this.done)
            return;
        this.shield = Math.max(0, this.shield - amount);
        this.invulnerable = this.clock + 1.2;
        audio.cue('damage');
        this.burst(this.paddle.x, PY, 0xff7250, 18);
        this.flashAt(this.paddle.x, PY, 0xff5040, 60);
        this.screenFlash(0xff3030, .22);
        this.dangerPulse = .9;
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
        this.burst(b.x, PY - 7, b.charged ? 0xffee88 : 0x5ceaff, 8);
        this.flashAt(b.x, PY - 8, b.charged ? 0xffee88 : 0x9ff3ff, b.charged ? 30 : 20);
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
        if (this.combo === 12 && !this.collectUntil) {
            this.banner('FEVER', 'KEEP THE COMBO ALIVE', 0xff9a3c, 650);
            this.screenFlash(0xff9a3c, .16);
        }
        if (this.combo % 8 === 0 && !this.collectUntil) {
            this.drop(x, y, 'power');
            audio.cue('combo');
            this.banner(`COMBO ×${this.combo}`, this.combo >= 24 ? 'UNSTOPPABLE · POWER DROP' : this.combo >= 16 ? 'ON FIRE · POWER DROP' : 'POWER DROP', this.combo >= 16 ? 0xff9a3c : 0xffd166, 650);
            this.screenFlash(0xffd166, .12);
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
        this.flashAt(b.x, b.y, b.charged ? 0xffef77 : b.color, b.charged ? 26 : 15);
        this.applyDamage(e, damage, true);
        audio.cue(e.armor ? 'armor' : 'hit', 1 + Math.min(14, this.combo) * .04);
        if (out.proc) {
            this.float(e.x, e.y - 16, out.proc, '#ffe08a');
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
            this.burst(e.x, e.y, e.color, e.hp <= 0 ? 14 : 4);
            e.flash = this.viewClock + .07;
            e.kick = this.viewClock;
        }
        if (e.hp > 0)
            return;
        e.alive = false;
        e.view.setVisible(false);
        this.ring(e.x, e.y, e.color, e.role ? 80 : 38);
        this.flashAt(e.x, e.y, 0xffffff, e.role ? 46 : 22);
        this.flashAt(e.x, e.y, e.color, e.role ? 90 : 40);
        this.debris(e.x, e.y, e.color, e.role ? 12 : 6);
        audio.cue(e.role ? 'bigboom' : 'boom');
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
            this.enemies.forEach(n => { n.alive = false; n.view.setVisible(false); });
            this.burst(e.x, e.y, 0xffcd6e, 40);
            this.ring(e.x, e.y, 0xffcd6e, 180);
            this.ring(e.x, e.y, 0xffffff, 260);
            for (let i = 0; i < 6; i++)
                this.flashAt(e.x + Math.sin(i * 2.3) * 110, e.y + Math.cos(i * 1.7) * 40, i % 2 ? 0xff8a3c : 0xffe08a, 60);
            this.debris(e.x, e.y, 0x6f93b3, 24);
            this.screenFlash(0xffe6b0, .7);
            this.freeze = Math.max(this.freeze, .18);
            this.banner('REACTOR DESTROYED', (this.stage.boss ?? '').toUpperCase() + ' IS DOWN', 0xffd166, 1500);
            this.shake(3);
            audio.cue('victory');
        }
        if (this.stage.boss && this.bossPhase === 1 && !this.enemies.some(n => n.alive && n.role === 'plate')) {
            this.bossPhase = 2;
            this.nextEscort = this.clock + 3;
            audio.cue('phase');
            this.banner('REACTOR EXPOSED', 'ARMOR DESTROYED · FINISH IT', 0xff9050, 1100);
            this.screenFlash(0xff9050, .4);
            this.bullets.forEach(b => b.view.destroy());
            this.bullets = [];
        }
    }

    explode(x: number, y: number, r: number, d: number, exclude: number) {
        this.flashAt(x, y, 0xfff0c0, r * .7);
        this.flashAt(x, y, 0xff8a3c, r);
        this.ring(x, y, 0xffcb6c, r);
        this.burst(x, y, 0xffb060, 16);
        this.debris(x, y, 0xff8a3c, 8);
        audio.cue('boom');
        this.shake(1.3);
        this.freeze = Math.max(this.freeze, .035);
        for (const n of this.enemies)
            if (n.alive && n.id !== exclude && Math.hypot(n.x - x, n.y - y) < r)
                this.applyDamage(n, d, false);
    }

    /** Jagged lightning between two points, drawn additively for a few frames. */
    arc(x: number, y: number, tx: number, ty: number) {
        if (this.arcs.length >= 12)
            return;
        const points = [x, y], dx = tx - x, dy = ty - y, len = Math.hypot(dx, dy) || 1;
        for (let i = 1; i < 5; i++) {
            const jitter = Math.sin(i * 12.9 + this.clock * 37 + x) * Math.min(9, len * .12);
            points.push(x + dx * i / 5 - dy / len * jitter, y + dy * i / 5 + dx / len * jitter);
        }
        points.push(tx, ty);
        this.arcs.push({ points, life: .17 });
        this.flashAt(tx, ty, 0xfff3a0, 16);
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
        const view = this.add.image(x, y, power ? `cap-${power}` : kind).setScale(1 / TS).setDepth(12);
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
        this.flashAt(this.paddle.x, PY, p.color, 70);
        this.screenFlash(p.color, .14);
        this.banner(p.name, p.help.toUpperCase(), p.color, 750);
    }

    shoot(e: Enemy) {
        if (this.bullets.length >= 33)
            return;
        const count = e.role === 'core' && this.bossPhase === 2 ? 3 : 1; // the exposed reactor fires spreads; guns stay single-shot
        const stage = this.host.run.stage, vy = 125 * (this.opts.assistBullets ? .7 : 1) * (1 + .06 * stageRegion(stage) + .15 * stageLoop(stage));
        const aim = this.boss?.aimed && e.role ? Phaser.Math.Clamp((this.paddle.x - e.x) / ((PY - e.y) / vy), -85, 85) : 0;
        this.flashAt(e.x, e.y + e.h / 2, 0xffb37a, 16);
        for (let i = 0; i < count; i++) {
            const view = this.add.image(e.x, e.y, 'bolt').setScale(1 / TS).setDepth(13);
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

    /** Streak sparks that fly out, fall and fade. */
    burst(x: number, y: number, color: number, count: number) {
        if (count >= 12)
            this.shakeUntil = this.clock + .12;
        if (this.opts.reducedMotion)
            count = Math.min(3, count);
        for (let i = 0; i < count && this.sparks.length < 220; i++) {
            const a = i * 2.399 + x * .13 + this.clock * 7, speed = 70 + ((i * 53 + (y | 0) * 7) % 190);
            this.sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 40, life: .22 + (i % 5) * .07, color });
        }
    }

    /** Solid chunks thrown from a destroyed target. */
    debris(x: number, y: number, color: number, count: number) {
        if (this.opts.reducedMotion)
            return;
        for (let i = 0; i < count && this.debrisBits.length < 70; i++) {
            const a = i * 1.71 + x * .31 + this.clock * 3;
            this.debrisBits.push({ x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 5, vx: Math.cos(a) * (50 + (i * 37) % 110), vy: -70 - (i * 59) % 150, life: .5 + (i % 4) * .1, color, size: 3 + (i % 3) * 1.5 });
        }
    }

    /** A soft additive bloom of light. */
    flashAt(x: number, y: number, color: number, size: number) {
        if (this.flashes.length < 36 && !this.opts.reducedMotion)
            this.flashes.push({ x, y, life: .16, color, size });
    }

    ring(x: number, y: number, color: number, size: number) {
        if (this.rings.length < 24 && !this.opts.reducedMotion)
            this.rings.push({ x, y, life: .32, color, size });
    }

    float(x: number, y: number, text: string, color: string) {
        if (this.floaters.length >= 12)
            return;
        const view = this.add.text(x, y - 6, text, { fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontStyle: 'bold italic', color }).setOrigin(.5).setDepth(15).setResolution(RES).setStroke('#03101c', 3);
        this.floaters.push({ view, life: .75 });
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
                    this.ring(d.x, PY, 0x66ffff, 50);
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
                this.flashAt(b.x, b.y, 0xffb37a, 18);
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
            if (!this.stage.boss)
                this.banner('SECTOR CLEAR', this.drops.length ? 'COLLECTING SALVAGE' : `BEST COMBO ×${this.bestCombo}`, 0x8cff9e, 1100);
            this.screenFlash(0xffffff, .3);
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
                this.flashAt(bolt.x, bolt.y, 0xff9ec0, 12);
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
                    this.flashAt(b.x, WALL_Y, 0x8cff9e, 26);
                }
                else
                    this.burst(b.x, b.y, 0x9fdcff, 3);
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
        const s = this.opts, motion = !s.reducedMotion, fx = this.fx, glow = this.glow, now = this.viewClock;
        const over = this.clock < this.overUntil, fever = Math.min(1, this.combo / 12), ship = SHIP_COLORS[this.host.run.ship];
        this.frame++;
        fx.clear();
        glow.clear();
        // Backdrop: stars streak past faster as the combo climbs
        if (motion)
            for (const star of this.stars) {
                star.y += real * [14, 38, 95][star.layer] * (1 + fever * 2.5);
                if (star.y > H - 50) {
                    star.y = TOP;
                    star.x = (star.x * 7 + 113) % W;
                }
            }
        const back = this.backGlow, streak = 1 + fever * 5;
        back.clear();
        for (const star of this.stars) {
            const size = [1, 1.5, 2.2][star.layer];
            back.fillStyle(star.tint, [.35, .6, .95][star.layer]);
            back.fillRect(star.x, star.y, size, size * (star.layer ? streak : 1));
        }
        if (fever > .6 && motion) {
            const pulse = .05 + .05 * Math.sin(now * 9);
            for (const x of [0, W - 14]) {
                glow.fillStyle(0xffb347, pulse);
                glow.fillRect(x, TOP, 14, H - TOP);
                glow.fillStyle(0xffe08a, pulse * 1.6);
                glow.fillRect(x ? W - 4 : 0, TOP, 4, H - TOP);
            }
        }
        // Cores: white-hot centre, coloured halo, comet trail
        for (const b of this.balls) {
            const color = over ? 0xff8a3c : b.color, halo = b.r * (over ? 11 : b.charged ? 9.5 : 8) * (1 + .06 * Math.sin(now * 20));
            b.view.setPosition(b.x, b.y);
            b.glow.setPosition(b.x, b.y).setTint(color).setDisplaySize(halo, halo);
            if (motion && !this.held) {
                b.trail.push(b.x, b.y);
                const cap = 2 * Math.round(26 + fever * 16);
                if (b.trail.length > cap)
                    b.trail.splice(0, b.trail.length - cap);
            }
            else
                b.trail.length = 0;
            const n = b.trail.length / 2;
            for (let i = 0; i < n; i++) {
                const t = i / n;
                glow.fillStyle(color, .03 + .32 * t * t);
                glow.fillCircle(b.trail[i * 2], b.trail[i * 2 + 1], b.r * (.3 + .8 * t));
            }
            if (b.charged) {
                glow.lineStyle(2, 0xffef77, .9);
                glow.strokeCircle(b.x, b.y, b.r + 4 + Math.sin(now * 24) * 1.5);
            }
        }
        // Targets
        const shaking = this.clock < this.shakeUntil && motion;
        for (const e of this.enemies) {
            if (!e.alive)
                continue;
            const t = motion ? Phaser.Math.Clamp((now - e.intro) / .3, 0, 1) : 1, ease = 1 - (1 - t) ** 3;
            const kick = motion ? Math.max(0, .12 - (now - e.kick)) / .12 : 0, bob = motion && !e.solid ? Math.sin(now * 2.2 + e.id * 1.7) * 1.1 : 0;
            let alpha = ease, x = e.x, y = e.y - (1 - ease) * 90 - kick * 3 + bob;
            if (shaking)
                x += Math.sin(this.clock * 90 + e.id) * 2 * s.shake;
            if (this.mod === 'blackout' && !e.telegraph) {
                const near = Math.min(...this.balls.map(b => Math.hypot(b.x - e.x, b.y - e.y)));
                alpha *= Phaser.Math.Clamp(1 - (near - 95) / 85, .08, 1);
            }
            const frozen = e.frozen > this.clock, burning = e.burn > this.clock;
            e.view.setPosition(x, y).setAlpha(alpha).setScale((1 + kick * .12) / TS);
            if (e.flash > now)
                e.view.setTintFill(0xffffff);
            else if (frozen)
                e.view.setTint(0x9fe8ff);
            else if (burning)
                e.view.setTint(0xffb890);
            else
                e.view.clearTint();
            if (e.armor > 0 && !e.solid) {
                const span = e.armor * 6 - 2;
                for (let i = 0; i < e.armor; i++) {
                    fx.fillStyle(0x0b1420, .8 * alpha);
                    fx.fillRect(x - span / 2 + i * 6 - .5, y - 5, 5, 10);
                    fx.fillStyle(0xffffff, .95 * alpha);
                    fx.fillRect(x - span / 2 + i * 6, y - 4.5, 4, 9);
                }
            }
            if (e.hp < e.max && !e.solid) {
                fx.fillStyle(0x000000, .6 * alpha);
                fx.fillRect(x - e.w / 2 + 3, y + e.h / 2 - 3.5, e.w - 6, 2.5);
                fx.fillStyle(e.hp / e.max < .35 ? 0xff5d5d : 0xffffff, .95 * alpha);
                fx.fillRect(x - e.w / 2 + 3, y + e.h / 2 - 3.5, (e.w - 6) * Math.max(0, e.hp / e.max), 2.5);
            }
            if (frozen) {
                glow.lineStyle(1.5, 0xcff6ff, .7 * alpha);
                glow.strokeRect(x - e.w / 2 - 1, y - e.h / 2 - 1, e.w + 2, e.h + 2);
                glow.lineBetween(x - e.w / 2 + 4, y - e.h / 2, x - e.w / 2 + 12, y + e.h / 2);
                glow.lineBetween(x + e.w / 2 - 14, y - e.h / 2, x + e.w / 2 - 6, y + e.h / 2);
            }
            if (burning && motion && (this.frame + e.id * 3) % 5 === 0 && this.sparks.length < 200)
                this.sparks.push({ x: x + Math.sin(now * 13 + e.id) * e.w * .4, y: y - e.h / 2, vx: Math.sin(e.id + now * 5) * 20, vy: -70 - (this.frame % 3) * 20, life: .35, color: 0xffa040 });
            if (e.telegraph) {
                const charge = Math.min(1, (this.clock - e.telegraph) / .7);
                glow.fillStyle(0xffb266, .35 + .3 * Math.sin(now * 30));
                glow.fillCircle(x, y + e.h / 2 + 2, 3 + charge * 7);
                glow.lineStyle(1, 0xffb266, .22);
                glow.lineBetween(x, y + 20, this.boss?.aimed && e.role ? this.paddle.x : x, PY - 30);
            }
            if (e.role === 'core') {
                if (this.bossPhase === 1) {
                    glow.lineStyle(2, 0x9fd0ff, .45 + .3 * Math.sin(now * 5));
                    glow.strokeRoundedRect(x - e.w / 2 - 5, y - e.h / 2 - 5, e.w + 10, e.h + 10, 9);
                }
                else {
                    glow.fillStyle(0xff7a3c, .22 + .18 * Math.sin(now * 12));
                    glow.fillCircle(x, y, 26 + Math.sin(now * 12) * 3);
                }
            }
        }
        // Pickups
        for (const d of this.drops) {
            const bob = motion ? Math.sin(now * 6 + d.x) * 2 : 0, color = d.power ? POWERS[d.power].color : d.kind === 'rescue' ? 0x66f3ff : 0xffd166;
            d.view.setPosition(d.x, d.y + bob);
            if (d.kind === 'scrap' && motion)
                d.view.setRotation(now * 3 + d.x);
            glow.fillStyle(color, .13 + .06 * Math.sin(now * 10 + d.x));
            glow.fillCircle(d.x, d.y + bob, d.power ? 22 : 14);
        }
        // Enemy fire
        for (const b of this.bullets) {
            b.view.setPosition(b.x, b.y).setRotation(-Math.atan2(b.vx, b.vy));
            glow.lineStyle(4, 0xff7a3c, .3);
            glow.lineBetween(b.x, b.y - 2, b.x - b.vx * .1, b.y - b.vy * .1);
            glow.fillStyle(0xffc27a, .35);
            glow.fillCircle(b.x, b.y + 3, 6);
        }
        // Arena modifiers
        for (const lane of this.lanes) {
            const t = this.clock - lane.at;
            if (t < 1.1) {
                glow.fillStyle(0xff7a3c, .07 + .08 * Math.abs(Math.sin(t * 14)));
                glow.fillRect(lane.x - 22, TOP, 44, 720 - TOP);
                glow.lineStyle(1.5, 0xffb266, .8);
                glow.lineBetween(lane.x - 22, TOP, lane.x - 22, 720);
                glow.lineBetween(lane.x + 22, TOP, lane.x + 22, 720);
                glow.fillStyle(0xffd9a0, .7);
                glow.fillRect(lane.x - 22 * (1 - t / 1.1), 716, 44 * (1 - t / 1.1), 3);
            }
            else if (t < 1.6) {
                const k = 1 - (t - 1.1) / .5;
                glow.fillStyle(0xff8a3c, .55 * k);
                glow.fillRect(lane.x - 26, TOP, 52, 720 - TOP);
                glow.fillStyle(0xffe2b0, .8 * k);
                glow.fillRect(lane.x - 16, TOP, 32, 720 - TOP);
                glow.fillStyle(0xffffff, k);
                glow.fillRect(lane.x - 6, TOP, 12, 720 - TOP);
            }
        }
        this.portals.forEach((p, i) => {
            const color = i ? 0xff9ee6 : 0xb78cff;
            glow.fillStyle(color, .22);
            glow.fillCircle(p.x, p.y, 20 + Math.sin(now * 5 + i) * 2);
            for (let k = 0; k < 3; k++) {
                const a = now * (i ? -3 : 3) + k * 2.094;
                glow.lineStyle(3, color, .9);
                glow.beginPath();
                glow.arc(p.x, p.y, 15, a, a + 1.3);
                glow.strokePath();
            }
            glow.lineStyle(1.5, 0xffffff, .7);
            glow.strokeCircle(p.x, p.y, 7 + Math.sin(now * 8 + i) * 2);
        });
        if (this.well) {
            for (let i = 0; i < 4; i++) {
                const r = 100 - ((now * 34 + i * 25) % 100);
                glow.lineStyle(1.5, 0x9d8cff, .5 * r / 100);
                glow.strokeCircle(this.well.x, this.well.y, r);
            }
            glow.fillStyle(0x9d8cff, .35);
            glow.fillCircle(this.well.x, this.well.y, 14 + Math.sin(now * 6) * 2);
            glow.fillStyle(0xffffff, .8);
            glow.fillCircle(this.well.x, this.well.y, 4);
        }
        // Boss
        if (this.hull) {
            const core = this.enemies.find(e => e.role === 'core')!;
            this.hull.setPosition(210 + core.x - core.baseX, 167).setVisible(!this.bossDefeated);
            fx.fillStyle(0x0d1b2a, .9);
            fx.fillRect(90, 103, 240, 5);
            fx.fillStyle(this.bossPhase === 2 ? 0xff7a3c : 0x7fa6c9);
            fx.fillRect(91, 104, 238 * Math.max(0, core.hp / core.max), 3);
            glow.fillStyle(this.bossPhase === 2 ? 0xff7a3c : 0x7fa6c9, .35);
            glow.fillRect(91, 102, 238 * Math.max(0, core.hp / core.max), 7);
        }
        // Blaster bolts
        for (const bolt of this.bolts) {
            glow.fillStyle(0xff5c9d, .35);
            glow.fillRect(bolt.x - 4, bolt.y - 10, 8, 20);
            glow.fillStyle(0xffd0e2, 1);
            glow.fillRect(bolt.x - 1.5, bolt.y - 8, 3, 15);
        }
        // Particles
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const p = this.sparks[i];
            p.life -= real;
            if (p.life <= 0) {
                this.sparks.splice(i, 1);
                continue;
            }
            p.vy += 300 * real;
            p.x += p.vx * real;
            p.y += p.vy * real;
            glow.lineStyle(2, p.color, Math.min(1, p.life / .22));
            glow.lineBetween(p.x, p.y, p.x - p.vx * .04, p.y - p.vy * .04);
        }
        for (let i = this.debrisBits.length - 1; i >= 0; i--) {
            const p = this.debrisBits[i];
            p.life -= real;
            if (p.life <= 0) {
                this.debrisBits.splice(i, 1);
                continue;
            }
            p.vy += 520 * real;
            p.x += p.vx * real;
            p.y += p.vy * real;
            const size = p.size * Math.min(1, p.life / .3);
            fx.fillStyle(p.color, Math.min(1, p.life / .25));
            fx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
            fx.fillStyle(0xffffff, .5 * Math.min(1, p.life / .25));
            fx.fillRect(p.x - size / 2, p.y - size / 2, size, 1);
        }
        for (let i = this.flashes.length - 1; i >= 0; i--) {
            const f = this.flashes[i];
            f.life -= real;
            if (f.life <= 0) {
                this.flashes.splice(i, 1);
                continue;
            }
            const k = f.life / .16;
            glow.fillStyle(f.color, .55 * k);
            glow.fillCircle(f.x, f.y, f.size * (1.1 - .5 * k));
            glow.fillStyle(0xffffff, .5 * k);
            glow.fillCircle(f.x, f.y, f.size * .35 * k);
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.life -= real;
            if (r.life <= 0) {
                this.rings.splice(i, 1);
                continue;
            }
            const k = 1 - r.life / .32;
            glow.lineStyle(1 + 4 * (1 - k), r.color, 1 - k);
            glow.strokeCircle(r.x, r.y, 6 + r.size * k);
        }
        for (let i = this.arcs.length - 1; i >= 0; i--) {
            const a = this.arcs[i];
            a.life -= real;
            if (a.life <= 0) {
                this.arcs.splice(i, 1);
                continue;
            }
            for (const [width, color, alpha] of [[6, 0xffe066, .35], [2, 0xffffff, 1]] as const) {
                glow.lineStyle(width, color, alpha * a.life / .17);
                glow.beginPath();
                glow.moveTo(a.points[0], a.points[1]);
                for (let k = 2; k < a.points.length; k += 2)
                    glow.lineTo(a.points[k], a.points[k + 1]);
                glow.strokePath();
            }
        }
        for (let i = this.floaters.length - 1; i >= 0; i--) {
            const f = this.floaters[i];
            f.life -= real;
            if (f.life <= 0) {
                f.view.destroy();
                this.floaters.splice(i, 1);
                continue;
            }
            f.view.y -= 46 * real;
            f.view.setAlpha(Math.min(1, f.life / .35)).setScale(1 + Math.max(0, f.life - .6) * 2.5);
        }
        // Ship
        const half = this.paddle.width / 2, squash = motion ? Math.max(0, .12 - (now - this.squash)) / .12 : 0;
        const wide = this.paddle.width > this.baseWidth * 1.2, key = wide ? 'paddle-wide' : 'paddle';
        if (key !== this.paddleKey) {
            this.paddleKey = key;
            this.paddleView.setTexture(key);
        }
        const blink = this.clock < this.invulnerable ? .45 + .55 * Math.abs(Math.sin(this.clock * 15)) : 1;
        this.paddleView.setPosition(this.paddle.x, PY + 4 + squash * 2).setScale(this.paddle.width / (this.baseWidth * (wide ? 1.4 : 1)) * (1 + squash * .05) / TS, (1 - squash * .22) / TS).setAlpha(blink);
        if (this.clock < this.blasterUntil)
            this.paddleView.setTint(0xffb0cc);
        else
            this.paddleView.clearTint();
        glow.fillStyle(ship, .1 + squash * .25);
        glow.fillRect(this.paddle.x - half - 6, PY - 13, this.paddle.width + 12, 26);
        if (motion) {
            const flame = 7 + Math.abs(Math.sin(now * 26)) * 6 + Math.min(10, Math.abs(this.pv) / 50);
            for (const side of [-1, 1]) {
                const px = this.paddle.x + side * this.paddle.width * .275;
                glow.fillStyle(0xff9a3c, .7);
                glow.fillTriangle(px - 6, PY + 15, px, PY + 15 + flame * 1.5, px + 6, PY + 15);
                glow.fillStyle(0xfff2c9, .9);
                glow.fillTriangle(px - 3, PY + 15, px, PY + 15 + flame * .8, px + 3, PY + 15);
            }
        }
        if (this.clock < this.blasterUntil)
            for (const side of [-1, 1]) {
                fx.fillStyle(0xffd0e2);
                fx.fillRect(this.paddle.x + side * half * .7 - 2, PY - 14, 4, 9);
            }
        this.aim.clear();
        if (this.held && !this.collectUntil) {
            const d = rebound(this.paddle.x, this.paddle.x, this.paddle.width, this.pv);
            for (let i = 1; i <= 8; i++) {
                const k = ((now * 1.6 + i / 8) % 1);
                this.aim.fillStyle(0x9ff3ff, .8 - k * .7);
                this.aim.fillCircle(this.paddle.x + d.x * (i + k) * 15, PY - 22 + d.y * (i + k) * 15, 2.2);
            }
        }
        if (this.host.run.ship === 'guardian' && this.clock < this.abilityUntil) {
            this.aim.lineStyle(10, 0x5ceaff, .18);
            this.aim.lineBetween(12, 715, 408, 715);
            this.aim.lineStyle(3, 0xbff6ff, .9);
            this.aim.lineBetween(12, 715, 408, 715);
        }
        const wallLeft = this.wallUntil - this.clock;
        if (wallLeft > 0 && (wallLeft > 2 || Math.sin(now * 20) > 0)) {
            this.aim.lineStyle(12, 0x8cff9e, .16);
            this.aim.lineBetween(LEFT, WALL_Y, RIGHT, WALL_Y);
            this.aim.lineStyle(3, 0xd6ffdc, .95);
            this.aim.lineBetween(LEFT, WALL_Y, RIGHT, WALL_Y);
            const shimmer = LEFT + ((now * 260) % (RIGHT - LEFT));
            this.aim.fillStyle(0xffffff, .8);
            this.aim.fillRect(shimmer - 12, WALL_Y - 2, 24, 4);
        }
        // Screen overlays
        this.dangerPulse = Math.max(0, this.dangerPulse - real * 1.6);
        const low = this.shield < 30 && this.shield > 0 ? .3 + .3 * Math.abs(Math.sin(now * 4)) : 0;
        this.danger.setAlpha(Math.max(low, this.dangerPulse)).setVisible(Math.max(low, this.dangerPulse) > .01);
        this.flashAlpha = Math.max(0, this.flashAlpha - real * 2.4);
        this.flashRect.setAlpha(this.flashAlpha).setVisible(this.flashAlpha > .01);
        // HUD
        audio.intensity = fever;
        this.shownScore += (this.score - this.shownScore) * Math.min(1, real * 10);
        if (this.score - this.shownScore < 1)
            this.shownScore = this.score;
        this.scoreText.setText(Math.round(this.shownScore).toLocaleString('en-US'));
        const mult = comboMultiplier(this.combo), punch = Math.max(0, .18 - (now - this.comboPulse));
        this.comboText.setText(this.combo > 1 ? `×${this.combo} ${fever >= 1 ? 'FEVER' : 'COMBO'}${mult > 1 ? `  ${mult}×` : ''}` : '');
        const tier = this.combo >= 20 ? 2 : this.combo >= 10 ? 1 : 0;
        if (tier !== this.comboTier) {
            this.comboTier = tier;
            this.comboText.setColor(['#ffd166', '#ff9a3c', '#ff6fae'][tier]); // re-rasterises the text, so only on change
        }
        this.comboText.setScale(1 + punch * 2.2);
        this.scoreText.setScale(1 + punch * .8);
        if (this.combo > 1) {
            const window = 3 * (1 + .35 * this.u('combo')), left = Math.max(0, (this.comboUntil - this.clock) / window);
            fx.fillStyle(0xffd166, .9);
            fx.fillRect(408 - 80 * left, 55, 80 * left, 2);
        }
        glow.fillStyle(this.shield < 30 ? 0xff7755 : 0x55eaff, .3);
        glow.fillRect(12, 80, this.shieldBar.width, 8);
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
    RES = host.progress.settings.crisp === false ? 1 : Math.min(2, Math.max(1, Math.ceil(window.devicePixelRatio || 1)));
    const game = new Phaser.Game({ type: Phaser.AUTO, parent, width: W * RES, height: H * RES, backgroundColor: '#050c18', input: { gamepad: true }, scene: [], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, callbacks: { postBoot: g => { g.scene.add('battle', BattleScene, true, host); } } });
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
