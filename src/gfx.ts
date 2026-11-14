import type Phaser from 'phaser';
import { POWERS, POWER_IDS } from './data';
import type { EnemyType, ShipId } from './types';

/** Procedural art. Every texture is drawn to a canvas at 2x and displayed at half scale, so nothing is downloaded. */
export const TS = 2;
export const PAD = 8;
export type HullKind = EnemyType | 'gun' | 'plate' | 'core' | 'bumper';
type Ctx = CanvasRenderingContext2D;

export const ENEMY_COLORS: Record<HullKind, number> = { scout: 0xff8a4c, armored: 0x9aa7b8, shield: 0x7d7aff, repair: 0x65e6a7, gunship: 0xff554f, mine: 0xcf6fff, interceptor: 0xffcb5c, reflector: 0xb9c6d6, conductive: 0xfff17a, fuel: 0xff7a32, prison: 0x58e5ff, command: 0xf65cbf, gun: 0xff554f, plate: 0x9aa7b8, core: 0xf65cbf, bumper: 0xb9c6d6 };
/** Scout bricks take their colour from their row, so every wall reads as a rainbow. */
export const ROW_COLORS = [0xff4d6d, 0xff8f1f, 0xffd93d, 0x4fe36a, 0x38cfff, 0x8f7bff];
export const SHIP_COLORS: Record<ShipId, number> = { guardian: 0x4de9ff, striker: 0xff9a4d, magnetar: 0xb78cff };
export const REGION_HUES = [0x1b6f9c, 0xb5562a, 0x5a4bd6, 0xb3243a];

export const mix = (a: number, b: number, t: number) => {
    const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
export const css = (n: number, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx, w: number, h: number) => void, scale = TS) {
    if (scene.textures.exists(key))
        scene.textures.remove(key);
    const texture = scene.textures.createCanvas(key, Math.ceil(w * scale), Math.ceil(h * scale));
    if (!texture)
        return;
    const c = texture.getContext();
    c.scale(scale, scale);
    draw(c, w, h);
    texture.refresh();
}

function bevel(c: Ctx, x: number, y: number, w: number, h: number, cut: number) {
    c.beginPath();
    c.moveTo(x + cut, y);
    c.lineTo(x + w - cut, y);
    c.lineTo(x + w, y + cut);
    c.lineTo(x + w, y + h - cut);
    c.lineTo(x + w - cut, y + h);
    c.lineTo(x + cut, y + h);
    c.lineTo(x, y + h - cut);
    c.lineTo(x, y + cut);
    c.closePath();
}

function pill(c: Ctx, x: number, y: number, w: number, h: number) {
    const r = h / 2;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    c.lineTo(x + r, y + h);
    c.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
    c.closePath();
}

function line(c: Ctx, points: number[]) {
    c.beginPath();
    for (let i = 0; i < points.length; i += 2)
        i ? c.lineTo(points[i], points[i + 1]) : c.moveTo(points[i], points[i + 1]);
    c.stroke();
}

function emblem(c: Ctx, kind: HullKind) {
    switch (kind) {
        case 'scout':
            c.beginPath(); c.arc(0, 0, 2.2, 0, 7); c.fill();
            break;
        case 'armored':
        case 'plate':
            line(c, [-13, -5, -13, 5]); line(c, [13, -5, 13, 5]);
            break;
        case 'shield':
            line(c, [0, -6, 8, 0, 0, 6, -8, 0, 0, -6]);
            c.beginPath(); c.arc(0, 0, 1.6, 0, 7); c.fill();
            break;
        case 'repair':
            c.lineWidth = 3; line(c, [-6, 0, 6, 0]); line(c, [0, -5.5, 0, 5.5]);
            break;
        case 'gunship':
        case 'gun':
            c.beginPath(); c.moveTo(-7, -4); c.lineTo(7, -4); c.lineTo(0, 6); c.closePath(); c.fill();
            line(c, [-12, -4, -10, 3]); line(c, [12, -4, 10, 3]);
            break;
        case 'mine':
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4;
                line(c, [Math.cos(a) * 3.5, Math.sin(a) * 3.5, Math.cos(a) * 7, Math.sin(a) * 7]);
            }
            c.beginPath(); c.arc(0, 0, 2.4, 0, 7); c.fill();
            break;
        case 'interceptor':
            line(c, [-7, -5, -2, 0, -7, 5]); line(c, [1, -5, 6, 0, 1, 5]);
            break;
        case 'reflector':
        case 'bumper':
            line(c, [-16, -1.5, 16, -1.5]); line(c, [-16, 1.5, 16, 1.5]);
            break;
        case 'conductive':
            line(c, [3, -7, -4, 1, 2, 1, -3, 7]);
            break;
        case 'fuel':
            line(c, [-5, -5, 5, 5]); line(c, [5, -5, -5, 5]);
            c.beginPath(); c.arc(0, 0, 7.5, 0, 7); c.stroke();
            break;
        case 'prison':
            c.font = '900 10px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText('SOS', 0, .5);
            line(c, [-15, -5, -15, 5]); line(c, [15, -5, 15, 5]);
            break;
        case 'command': {
            c.beginPath();
            for (let i = 0; i < 10; i++) {
                const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3 : 7;
                i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            c.closePath(); c.fill();
            break;
        }
        case 'core':
            c.beginPath(); c.arc(0, 0, 9, 0, 7); c.stroke();
            c.beginPath(); c.arc(0, 0, 4.5, 0, 7); c.fill();
            for (const x of [-36, -26, 26, 36])
                line(c, [x, -6, x, 6]);
            line(c, [-20, 0, -12, 0]); line(c, [12, 0, 20, 0]);
            break;
    }
}

/** A glossy 3D brick: bright face, lit top and left bevels, shaded bottom and right, embossed emblem. Box-shaped so the art matches the hitbox. */
function hull(c: Ctx, w: number, h: number, color: number, kind: HullKind) {
    const x = PAD, y = PAD, b = kind === 'bumper' ? 3 : 4.5, light = mix(color, 0xffffff, .6), dark = mix(color, 0x05070c, .55), steel = kind === 'armored' || kind === 'plate' || kind === 'bumper';
    const round = (px: number, py: number, pw: number, ph: number, r: number) => { c.beginPath(); c.roundRect(px, py, pw, ph, r); };
    // neon under-glow
    c.save();
    c.shadowColor = css(color, 1);
    c.shadowBlur = 9;
    round(x, y, w, h, 4);
    c.fillStyle = css(dark);
    c.fill();
    c.restore();
    // bevels: top + left lit, bottom + right shaded
    c.save();
    round(x, y, w, h, 4);
    c.clip();
    c.fillStyle = css(dark);
    c.fillRect(x, y, w, h);
    c.fillStyle = css(light);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w - b, y + b); c.lineTo(x + b, y + b); c.lineTo(x + b, y + h - b); c.lineTo(x, y + h); c.closePath(); c.fill();
    c.fillStyle = css(mix(color, 0x05070c, .72));
    c.beginPath(); c.moveTo(x + w, y + h); c.lineTo(x, y + h); c.lineTo(x + b, y + h - b); c.lineTo(x + w - b, y + h - b); c.closePath(); c.fill();
    c.restore();
    // face
    const g = c.createLinearGradient(0, y + b, 0, y + h - b);
    g.addColorStop(0, css(mix(color, 0xffffff, .28)));
    g.addColorStop(.5, css(color));
    g.addColorStop(1, css(mix(color, 0x05070c, .28)));
    round(x + b, y + b, w - b * 2, h - b * 2, 2);
    c.fillStyle = g;
    c.fill();
    if (steel) {
        c.fillStyle = 'rgba(255,255,255,.5)';
        for (const [rx, ry] of [[x + b + 3, y + b + 3], [x + w - b - 3, y + b + 3], [x + b + 3, y + h - b - 3], [x + w - b - 3, y + h - b - 3]]) {
            c.beginPath(); c.arc(rx, ry, 1.1, 0, 7); c.fill();
        }
    }
    if (kind === 'fuel') {
        c.save();
        round(x + b, y + b, w - b * 2, h - b * 2, 2);
        c.clip();
        c.strokeStyle = css(0x2a1200, .32);
        c.lineWidth = 4;
        for (let i = -h; i < w; i += 10)
            line(c, [x + i, y + h, x + i + h, y]);
        c.restore();
    }
    // glass highlight across the upper face
    const gloss = c.createLinearGradient(0, y + b, 0, y + h * .55);
    gloss.addColorStop(0, 'rgba(255,255,255,.55)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    round(x + b + 1, y + b + .5, w - b * 2 - 2, h * .42 - b, 2);
    c.fillStyle = gloss;
    c.fill();
    round(x, y, w, h, 4);
    c.lineWidth = 1;
    c.strokeStyle = css(mix(color, 0xffffff, .8), .9);
    c.stroke();
    // embossed emblem: dark drop, then bright
    c.lineWidth = 1.9;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.save();
    c.translate(x + w / 2 + .8, y + h / 2 + 1);
    c.strokeStyle = c.fillStyle = css(mix(color, 0x05070c, .7), .75);
    emblem(c, kind);
    c.restore();
    c.save();
    c.translate(x + w / 2, y + h / 2);
    c.strokeStyle = c.fillStyle = 'rgba(255,255,255,.95)';
    emblem(c, kind);
    c.restore();
}

function paddle(c: Ctx, w: number, color: number) {
    const x = PAD, y = PAD, h = 14, mid = x + w / 2, deep = mix(color, 0x061224, .7);
    // engine pods
    for (const side of [-1, 1]) {
        const px = mid + side * w * .275;
        c.fillStyle = css(mix(color, 0x0b1626, .55));
        bevel(c, px - 7, y + h - 3, 14, 9, 3);
        c.fill();
        c.fillStyle = css(0xfff2c9);
        c.fillRect(px - 4, y + h + 4, 8, 2);
    }
    c.save();
    c.shadowColor = css(color, .95);
    c.shadowBlur = 8;
    pill(c, x, y, w, h);
    c.fillStyle = css(deep);
    c.fill();
    c.restore();
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, css(mix(color, 0xffffff, .75)));
    g.addColorStop(.35, css(color));
    g.addColorStop(1, css(deep));
    pill(c, x, y, w, h);
    c.fillStyle = g;
    c.fill();
    // deflector strip along the top
    c.fillStyle = 'rgba(255,255,255,.85)';
    pill(c, x + 6, y + 1.5, w - 12, 2.4);
    c.fill();
    // dark inlay with chevrons pointing up
    pill(c, x + 8, y + 6, w - 16, 5.5);
    c.fillStyle = css(mix(color, 0x040912, .82), .9);
    c.fill();
    c.strokeStyle = css(mix(color, 0xffffff, .5), .8);
    c.lineWidth = 1;
    for (let i = 16; i < w / 2 - 10; i += 9)
        for (const side of [-1, 1])
            line(c, [mid + side * i - 2.5, y + 10, mid + side * i, y + 7.5, mid + side * i + 2.5, y + 10]);
    // cockpit
    c.save();
    c.shadowColor = '#ffffff';
    c.shadowBlur = 6;
    c.fillStyle = css(mix(color, 0xffffff, .85));
    c.beginPath();
    c.ellipse(mid, y + 7, 7, 4.2, 0, 0, 7);
    c.fill();
    c.restore();
    pill(c, x, y, w, h);
    c.lineWidth = 1.2;
    c.strokeStyle = css(mix(color, 0xffffff, .85));
    c.stroke();
}

function radial(c: Ctx, cx: number, cy: number, r: number, stops: [number, string][]) {
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [at, color] of stops)
        g.addColorStop(at, color);
    c.fillStyle = g;
    c.fillRect(cx - r, cy - r, r * 2, r * 2);
}

const rand = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

export function buildTextures(scene: Phaser.Scene, o: { ship: ShipId; width: number; region: number; W: number; H: number; restored: boolean }) {
    const hue = REGION_HUES[o.region], next = rand(1337 + o.region * 97);
    // --- light primitives
    make(scene, 'orb', 64, 64, c => radial(c, 32, 32, 32, [[0, 'rgba(255,255,255,1)'], [.22, 'rgba(255,255,255,.62)'], [.55, 'rgba(255,255,255,.16)'], [1, 'rgba(255,255,255,0)']]), 1);
    make(scene, 'hot', 24, 24, c => radial(c, 12, 12, 12, [[0, '#ffffff'], [.55, '#ffffff'], [.8, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]));
    // --- targets
    const kinds: [HullKind, number, number][] = (Object.keys(ENEMY_COLORS) as HullKind[]).map(k => [k, k === 'core' ? 108 : k === 'plate' ? 68 : k === 'bumper' ? 64 : 48, k === 'bumper' ? 14 : k === 'core' || k === 'plate' || k === 'gun' ? 30 : 25]);
    for (const [kind, w, h] of kinds)
        make(scene, `e-${kind}`, w + PAD * 2, h + PAD * 2, c => hull(c, w, h, ENEMY_COLORS[kind], kind));
    ROW_COLORS.forEach((rowColor, i) => make(scene, `e-scout-${i}`, 48 + PAD * 2, 25 + PAD * 2, c => hull(c, 48, 25, rowColor, 'scout')));
    // --- ship
    const color = SHIP_COLORS[o.ship];
    make(scene, 'paddle', o.width + PAD * 2, 14 + PAD * 2 + 8, c => paddle(c, o.width, color));
    make(scene, 'paddle-wide', o.width * 1.4 + PAD * 2, 14 + PAD * 2 + 8, c => paddle(c, o.width * 1.4, color));
    // --- enemy fire
    make(scene, 'bolt', 18, 28, c => {
        radial(c, 9, 17, 9, [[0, 'rgba(255,240,200,1)'], [.35, 'rgba(255,150,70,.9)'], [1, 'rgba(255,90,40,0)']]);
        const g = c.createLinearGradient(0, 2, 0, 20);
        g.addColorStop(0, 'rgba(255,120,60,0)');
        g.addColorStop(1, 'rgba(255,235,190,1)');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(9, 1); c.lineTo(12.5, 17); c.lineTo(9, 23); c.lineTo(5.5, 17); c.closePath(); c.fill();
    });
    // --- pickups
    make(scene, 'scrap', 26, 26, c => {
        c.translate(13, 13);
        c.shadowColor = '#ffcc55'; c.shadowBlur = 7;
        c.beginPath();
        for (let i = 0; i < 6; i++)
            c.lineTo(Math.cos(i * Math.PI / 3 + .52) * 8, Math.sin(i * Math.PI / 3 + .52) * 8);
        c.closePath();
        const g = c.createLinearGradient(-8, -8, 8, 8);
        g.addColorStop(0, '#fff3c0'); g.addColorStop(.5, '#ffc640'); g.addColorStop(1, '#b06a12');
        c.fillStyle = g; c.fill();
        c.shadowBlur = 0; c.strokeStyle = '#fff6d8'; c.lineWidth = 1; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.55)';
        line(c, [-4, -4, 0, 0, 5, -3]); line(c, [0, 0, -1, 6]);
    });
    make(scene, 'rescue', 34, 34, c => {
        c.translate(17, 17);
        radial(c, 0, 0, 17, [[0, 'rgba(120,250,255,.55)'], [1, 'rgba(120,250,255,0)']]);
        c.shadowColor = '#7af4ff'; c.shadowBlur = 8;
        c.beginPath(); c.arc(0, 0, 10, 0, 7);
        const g = c.createLinearGradient(0, -10, 0, 10);
        g.addColorStop(0, '#e9ffff'); g.addColorStop(.5, '#4fdcf0'); g.addColorStop(1, '#126079');
        c.fillStyle = g; c.fill();
        c.shadowBlur = 0; c.strokeStyle = '#ffffff'; c.lineWidth = 1.3; c.stroke();
        c.fillStyle = '#06222e';
        c.fillRect(-1.8, -6, 3.6, 12); c.fillRect(-6, -1.8, 12, 3.6);
    });
    for (const id of POWER_IDS)
        make(scene, `cap-${id}`, 62, 34, c => {
            const p = POWERS[id];
            c.save();
            c.shadowColor = css(p.color); c.shadowBlur = 9;
            pill(c, 7, 8, 48, 18);
            c.fillStyle = css(mix(p.color, 0x000000, .5)); c.fill();
            c.restore();
            const g = c.createLinearGradient(0, 8, 0, 26);
            g.addColorStop(0, css(mix(p.color, 0xffffff, .7))); g.addColorStop(.5, css(p.color)); g.addColorStop(1, css(mix(p.color, 0x000000, .45)));
            pill(c, 7, 8, 48, 18); c.fillStyle = g; c.fill();
            c.strokeStyle = '#ffffff'; c.lineWidth = 1.3; c.stroke();
            c.fillStyle = 'rgba(255,255,255,.5)'; pill(c, 12, 9.5, 38, 3); c.fill();
            c.fillStyle = '#071019'; c.font = '900 10px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(p.label, 31, 17.8);
        });
    // --- backdrop
    make(scene, 'bg', o.W, o.H, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, css(mix(hue, 0x02040a, .9)));
        g.addColorStop(.55, css(mix(hue, 0x03060d, .8)));
        g.addColorStop(1, css(mix(hue, 0x05070d, .55)));
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 7; i++) {
            const x = next() * w, y = 90 + next() * (h - 260), r = 90 + next() * 150, tone = mix(hue, i % 2 ? 0xff6ad5 : 0x3fd0ff, .25 + next() * .3);
            radial(c, x, y, r, [[0, css(tone, .16 + next() * .1)], [1, css(tone, 0)]]);
        }
        // a distant planet limb for depth
        const px = w * (.2 + next() * .6), py = 190 + next() * 120, pr = 46 + next() * 30;
        c.save();
        c.beginPath(); c.arc(px, py, pr, 0, 7); c.clip();
        radial(c, px - pr * .4, py - pr * .45, pr * 1.6, [[0, css(mix(hue, 0xffffff, .35), .5)], [.5, css(mix(hue, 0x000000, .3), .42)], [1, css(0x000000, .5)]]);
        c.restore();
        c.strokeStyle = css(mix(hue, 0xffffff, .55), .55);
        c.lineWidth = 1.5;
        c.beginPath(); c.arc(px, py, pr, Math.PI * .95, Math.PI * 1.75); c.stroke();
        radial(c, px, py, pr * 1.5, [[0, css(hue, 0)], [.62, css(hue, 0)], [.7, css(mix(hue, 0xffffff, .3), .14)], [1, css(hue, 0)]]);
        // horizon glow behind the city
        const hz = c.createLinearGradient(0, h - 230, 0, h);
        hz.addColorStop(0, css(hue, 0)); hz.addColorStop(1, css(mix(hue, 0xffffff, .2), .4));
        c.fillStyle = hz;
        c.fillRect(0, h - 230, w, 230);
        // city skyline, two depth layers with lit windows
        c.save();
        c.translate(0, h - 150);
        skyline(c, w, 150);
        c.restore();
        // vignette baked in, so the whole backdrop is a single full-screen quad
        c.save();
        c.translate(w / 2, h / 2);
        c.scale(1, h / w);
        radial(c, 0, 0, w * .95, [[0, 'rgba(0,0,0,0)'], [.6, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.6)']]);
        c.restore();
    });
    function skyline(c: Ctx, w: number, h: number) {
        for (const [depth, tone, base] of [[0, .78, 96], [1, .9, 62]] as const) {
            let x = -10;
            while (x < w) {
                const bw = 18 + next() * 26, bh = base * (.45 + next() * .75);
                const g = c.createLinearGradient(0, h - bh, 0, h);
                g.addColorStop(0, css(mix(hue, 0x04070d, tone - .12)));
                g.addColorStop(1, css(mix(hue, 0x04070d, tone + .06)));
                c.fillStyle = g;
                c.fillRect(x, h - bh, bw, bh);
                if (next() < .35)
                    c.fillRect(x + bw / 2 - 1, h - bh - 8 - next() * 10, 2, 20);
                c.fillStyle = css(mix(hue, 0xffffff, .25), .5);
                c.fillRect(x, h - bh, bw, .8);
                for (let wy = h - bh + 6; wy < h - 8; wy += 7)
                    for (let wx = x + 4; wx < x + bw - 4; wx += 6)
                        if (next() < (o.restored ? .5 : .28) * (depth ? 1 : .6)) {
                            c.fillStyle = css(next() < .7 ? mix(hue, 0xffffff, .55) : 0xffd79a, .35 + next() * .5);
                            c.fillRect(wx, wy, 2.4, 3.2);
                        }
                x += bw + 1 + next() * 4;
            }
        }
    }
    make(scene, 'danger', 210, 380, (c, w, h) => {
        c.translate(w / 2, h / 2);
        c.scale(1, h / w);
        radial(c, 0, 0, w * .92, [[0, 'rgba(255,40,40,0)'], [.55, 'rgba(255,40,40,0)'], [1, 'rgba(255,50,40,.85)']]);
    }, 1);
    // --- boss hull
    make(scene, 'hull', 360, 130, c => {
        const pts = [10, 28, 95, 10, 265, 10, 350, 28, 335, 76, 270, 76, 245, 118, 115, 118, 90, 76, 25, 76];
        const path = () => { c.beginPath(); for (let i = 0; i < pts.length; i += 2) i ? c.lineTo(pts[i], pts[i + 1]) : c.moveTo(pts[i], pts[i + 1]); c.closePath(); };
        c.save(); c.shadowColor = css(hue, .9); c.shadowBlur = 10; path(); c.fillStyle = '#0b1622'; c.fill(); c.restore();
        const g = c.createLinearGradient(0, 8, 0, 120);
        g.addColorStop(0, '#3d5872'); g.addColorStop(.3, '#1d3349'); g.addColorStop(1, '#0a1420');
        path(); c.fillStyle = g; c.fill();
        c.save(); path(); c.clip();
        c.strokeStyle = 'rgba(140,180,210,.22)'; c.lineWidth = 1;
        for (let x = 30; x < 350; x += 22)
            line(c, [x, 0, x - 12, 130]);
        line(c, [0, 46, 360, 46]);
        c.fillStyle = css(mix(hue, 0xffffff, .5), .85);
        for (let x = 40; x < 330; x += 14)
            if (x < 150 || x > 210)
                c.fillRect(x, 20, 5, 2);
        c.restore();
        path(); c.lineWidth = 1.6; c.strokeStyle = '#6f93b3'; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1;
        line(c, [95, 11, 265, 11]);
    });
}
