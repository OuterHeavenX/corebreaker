import type { BattleScene } from './game';
import type { RunState } from './types';
import { UPGRADES } from './data';
/** Local Vite only. Never included in the production UI. */
export function mount(get: () => BattleScene | undefined, start: (stage: number, build: boolean) => void) { const details = document.createElement('details'); details.style.cssText = 'position:fixed;right:0;top:0;z-index:100;background:#182f40;color:white;padding:8px;max-width:210px;font-size:11px'; details.innerHTML = '<summary>LOCAL QA</summary><label>Stage <input type="number" min="1" max="20" value="1" style="width:50px"></label><button data-dev="load">Load stage</button><button data-dev="build">Load elemental multiball</button><button data-dev="clear">Damage all targets</button><button data-dev="lose">Lose final core</button><button data-dev="status">Read battle status</button><output style="display:block;white-space:pre-wrap"></output>'; document.body.append(details); const output = details.querySelector('output')!; details.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { const s = get(), stage = Number(details.querySelector('input')!.value); switch (b.dataset.dev) {
    case 'load':
        start(stage, false);
        break;
    case 'build':
        start(stage, true);
        break;
    case 'clear':
        if (s) {
            for (const e of s.enemies.filter(e => e.role !== 'core'))
                s.applyDamage(e, 999, true);
            for (const e of s.enemies.filter(e => e.role === 'core'))
                s.applyDamage(e, 999, true);
        }
        break;
    case 'lose':
        if (s) {
            s.invulnerable = 0;
            for (const core of [...s.balls])
                s.loseBall(core);
        }
        break;
    case 'status':
        output.textContent = s ? JSON.stringify({ held: s.held, shield: s.shield, balls: s.balls.length, targets: s.enemies.filter(e => e.alive).length, bossPhase: s.bossPhase, defeated: s.bossDefeated, clock: Math.round(s.clock) }, null, 2) : 'No battle';
        break;
} }); }
