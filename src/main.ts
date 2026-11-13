import Phaser from 'phaser';
import './style.css';
import './mobile.css';
import { audio } from './audio';
import { buy, maxShield } from './combat';
import { createGame, choices, synergy as synergyLabel } from './game';
import { ELEMENTS, POWERS, SHIPS, STAGES, UPGRADES, SYNERGY_DETAILS, VERSION, VERSION_NAME } from './data';
import { dailySeed, exportSave, fresh, importSave, load, newRun, save } from './save';
import type { Progress, RunState, Settings, ShipId, UpgradeDef } from './types';
let progress = load(), game: Phaser.Game | undefined, toastTimer = 0;
const synergy = (elements: RunState['elements']) => { const name = synergyLabel(elements); return name ? `${name} — ${SYNERGY_DETAILS[name]} Per-target cooldown: 1.2s (0.96s with Apex).` : ''; };
const app = document.querySelector<HTMLDivElement>('#app')!;
const MODE_NAMES: Record<RunState['mode'], string> = { campaign: 'CAMPAIGN', quick: 'QUICK DEFENSE', endless: 'ENDLESS', daily: 'DAILY CHALLENGE' };
const best = (mode: RunState['mode']) => progress.records[`score:${mode}`] ?? 0;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const bestLine = (mode: RunState['mode']) => best(mode) ? `<small class="best">BEST ${fmt(best(mode))}</small>` : '';
function persist() { audio.settings = progress.settings; audio.apply(); if (!save(progress))
    toast('STORAGE UNAVAILABLE · EXPORT A BACKUP'); }
function shell(content: string, gameMode = false) { app.innerHTML = `<div class="app"><header class="topbar"><div class="brand">LAST DEFENSE <small>COREBREAKER</small></div><div class="hud"><span>RANK <b>${progress.rank}</b></span><span>RESCUES <b>${progress.rescues}</b></span></div></header><main class="screen ${gameMode ? 'game' : ''}">${content}</main><footer class="footer">${VERSION_NAME} v${VERSION} · LOCAL SAVE</footer></div><div id="toast" class="toast"></div>`; }
function toast(text: string) { const el = document.querySelector('#toast'); if (!el)
    return; el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove('show'), 1800); }
function home() { closeModal(); audio.mode = 'menu'; audio.intensity = 0; game?.destroy(true); game = undefined; shell(`<section class="hero"><div class="eyebrow">THE CITY STILL HAS A HEARTBEAT</div><h1>LAST DEFENSE<span>COREBREAKER</span></h1><p class="subtitle">Drive an unstable energy core through the invasion fleet. Rescue survivors. Rebuild what remains. Every rebound is a decision.</p><div class="actions">${progress.run ? '<button class="primary" data-a="continue">CONTINUE RUN</button>' : ''}<button class="primary" data-a="new">NEW RUN</button><button data-a="hangar">HANGAR</button><button data-a="how">HOW TO PLAY</button><button data-a="settings">SETTINGS</button></div>${(['campaign', 'quick', 'endless', 'daily'] as const).some(best) ? `<div class="records">${(['campaign', 'quick', 'endless', 'daily'] as const).filter(best).map(m => `<span>${MODE_NAMES[m]} <b>${fmt(best(m))}</b></span>`).join('')}</div>` : ''}</section>`); bind({ continue: () => resumeRun(), new: modeSelect, hangar, how, settings }); }
function resumeRun() { const run = progress.run!; if (run.phase === 'upgrade') {
    upgradeScreen();
    return;
} if (run.phase === 'shop') {
    shop();
    return;
} startBattle(run); }
function bind(map: Record<string, () => void>) { document.querySelectorAll<HTMLElement>('[data-a]').forEach(b => b.onclick = () => map[b.dataset.a!]?.()); }
function modeSelect() { shell(`<section class="panel"><div class="eyebrow">SELECT OPERATION</div><h2>Deployment mode</h2><div class="grid"><button class="card" data-mode="campaign"><h3>CAMPAIGN</h3><p>20 authored stages across four regions. Safe resume between stages.</p>${bestLine('campaign')}</button><button class="card" data-mode="quick"><h3>QUICK DEFENSE</h3><p>Five-stage mobile sortie with one boss.</p>${bestLine('quick')}</button><button class="card ${progress.campaignBest < 20 ? 'locked' : ''}" data-mode="endless"><h3>ENDLESS</h3><p>The campaign on repeat. Every loop hits harder. Unlocks after campaign.</p>${bestLine('endless')}</button><button class="card" data-mode="daily"><h3>DAILY CHALLENGE</h3><p>Same seed for everyone today. Chase your best score.</p>${bestLine('daily')}</button></div><p><button data-a="back">BACK</button></p></section>`); document.querySelectorAll<HTMLElement>('[data-mode]').forEach(x => x.onclick = () => { const mode = x.dataset.mode as RunState['mode']; if (mode === 'endless' && progress.campaignBest < 20) {
    toast('CLEAR CAMPAIGN TO UNLOCK');
    return;
} shipSelect(mode); }); bind({ back: home }); }
function shipSelect(mode: RunState['mode']) { shell(`<section class="panel"><div class="eyebrow">CHOOSE DEFENSE SHIP</div><h2>Hangar launch</h2><div class="grid">${SHIPS.map(s => `<button class="card ${progress.rank < s.unlockRank ? 'locked' : ''}" data-ship="${s.id}"><span class="badge">${s.ability}</span><h3>${s.name}</h3><p>${s.description}</p><small>${progress.rank < s.unlockRank ? `UNLOCK: PILOT RANK ${s.unlockRank}` : 'READY'}</small></button>`).join('')}</div><p><button data-a="back">BACK</button></p></section>`); document.querySelectorAll<HTMLElement>('[data-ship]').forEach(x => x.onclick = () => { const ship = x.dataset.ship as ShipId; const def = SHIPS.find(s => s.id === ship)!; if (progress.rank < def.unlockRank) {
    toast(`REQUIRES RANK ${def.unlockRank}`);
    return;
} progress.selectedShip = ship; progress.run = newRun(mode, ship, mode === 'daily' ? dailySeed() : Date.now() >>> 0); persist(); elementPick(); }); bind({ back: modeSelect }); }
function elementPick() { shell(`<section class="panel"><div class="eyebrow">CORE CALIBRATION</div><h2>Choose an initial modifier</h2><p>You may equip a second element later. Every pairing creates an explicit synergy.</p><div class="grid">${Object.entries(ELEMENTS).map(([id, e]) => `<button class="card" data-element="${id}"><h3>${e.name}</h3><p>${e.description}</p></button>`).join('')}</div></section>`); document.querySelectorAll<HTMLElement>('[data-element]').forEach(x => x.onclick = () => { progress.run!.elements = [x.dataset.element as any]; persist(); startBattle(progress.run!); }); }
function startBattle(run: RunState) { game?.destroy(true); shell(`<div class="game-layout"><aside class="side">MOVE<br>Drag · Mouse · A/D · Stick<br><br>LAUNCH<br>Tap · Click · Space · A<br><br>ABILITY<br>E · Shift · Button<br><br>POWER CAPSULES<br>${Object.values(POWERS).map(p => p.label).join(' · ')}</aside><div id="game" class="game-shell"></div><aside class="side">${STAGES[(run.stage - 1) % 20].objective}<br><br>${synergy(run.elements) || 'Equip two elements to activate a synergy.'}</aside></div>`, true); game = createGame('game', { progress, run, onHud: h => { const hud = document.querySelector('.hud'); if (hud)
        hud.innerHTML = `<span>CITY SHIELD <b>${Math.ceil(h.shield)}</b></span><span>SCRAP <b>${h.scrap}</b> · STAGE ${h.stage}</span>`; }, toast, onPause: pause, onStageClear: stageClear, onGameOver: gameOver }); }
function pause() { if (document.querySelector('.modal'))
    return; game?.scene.pause('battle'); modal(`<div class="eyebrow">TACTICAL PAUSE</div><h2>Action suspended</h2><p>Resume continues this battle. Returning to command restarts from the saved stage beginning.</p><div class="actions"><button class="primary" data-m="resume">RESUME</button><button data-m="settings">SETTINGS</button><button data-m="quit">RETURN TO COMMAND</button></div>`, { resume: () => { audio.unlock(); closeModal(); game?.scene.resume('battle'); }, settings: () => { closeModal(); game?.destroy(true); game = undefined; progress = load(); settings(); }, quit: () => { progress = load(); home(); } }); }
function stageClear() { game?.scene.pause('battle'); audio.mode = 'menu'; const run = progress.run!; const key = `${run.mode}:${run.stage}`; if (!run.claimed.includes(key)) {
    run.claimed.push(key);
    run.scrap += STAGES[(run.stage - 1) % 20].reward;
    progress.xp += 25 + run.stage * 2;
    progress.rank = 1 + Math.floor(progress.xp / 120);
    if (run.mode === 'campaign')
        progress.campaignBest = Math.max(progress.campaignBest, run.stage);
    if (progress.rank >= 3 && !progress.unlocks.includes('striker'))
        progress.unlocks.push('striker');
    if (progress.rank >= 5 && !progress.unlocks.includes('magnetar'))
        progress.unlocks.push('magnetar');
} if (run.mode === 'campaign' && run.stage >= 20) {
    ending();
    return;
} if ((run.mode === 'quick' || run.mode === 'daily') && run.stage >= 5) {
    results('SIEGE CARRIER DESTROYED');
    return;
} run.phase = run.stage % 5 === 0 ? 'shop' : 'upgrade'; run.offers = choices(run).map(u => u.id); run.shopBought = false; run.shopRerolls = 0; persist(); if (run.phase === 'shop')
    shop();
else
    upgradeScreen(); }
function upgradeScreen() { const run = progress.run!; const opts = (run.offers ?? choices(run).map(u => u.id)).map(id => UPGRADES.find(u => u.id === id)).filter((u): u is UpgradeDef => !!u); const elements = run.elements.length < 2 ? Object.entries(ELEMENTS).filter(([id]) => !run.elements.includes(id as any)) : []; modal(`<div class="eyebrow">STAGE SECURED</div><h2>Choose one upgrade</h2><p>Score ${fmt(run.score ?? 0)} · Shield ${Math.ceil(run.shield)} · Scrap ${run.scrap} · ${synergy(run.elements) || 'Single element core'}</p><div class="grid">${opts.map(u => upgradeCard(u)).join('')}${elements.map(([id, e]) => `<button class="card" data-m="element-${id}"><span class="rarity">SECOND ELEMENT</span><h3>${e.name}</h3><p>${e.description}</p><p>${synergy([...run.elements, id as any])}</p></button>`).join('')}</div>${!opts.length ? '<button data-m="supply">SUPPLY CACHE · +20 SCRAP</button>' : ''}`, { ...Object.fromEntries(opts.map(u => [`u-${u.id}`, () => { run.upgrades[u.id] = (run.upgrades[u.id] ?? 0) + 1; if (u.id === 'shield')
            run.shield += 10; audio.cue('ability'); nextStage(); }])), ...Object.fromEntries(elements.map(([id]) => [`element-${id}`, () => { run.elements.push(id as any); audio.cue('ability'); nextStage(); }])), supply: () => { run.scrap += 20; nextStage(); } }); }
function shop() { const run = progress.run!, repairCost = Math.ceil(40 * (1 - .2 * (run.upgrades.repair ?? 0))), reroll = 15 + 15 * (run.shopRerolls ?? 0); const offers = (run.offers ?? []).map(id => UPGRADES.find(u => u.id === id)).filter((u): u is UpgradeDef => !!u); modal(`<div class="eyebrow">CARRIER DOWN · FIELD DEPOT</div><h2>Refit before the next region</h2><p>SCRAP ${run.scrap} · SHIELD ${Math.ceil(run.shield)}/${maxShield(run)}</p><div class="grid"><button class="card" data-m="repair" ${run.scrap < repairCost || run.shield >= maxShield(run) ? 'disabled' : ''}><h3>Repair +35</h3><p>${repairCost} scrap · capped at maximum shield</p></button><button class="card" data-m="kit" ${run.scrap < 30 || run.consumable ? 'disabled' : ''}><h3>Portable repair kit</h3><p>30 scrap · activate in battle for +25 shield. Carry one.</p></button>${!run.shopBought ? offers.map(u => `<button class="card r-${u.rarity}" data-m="buy-${u.id}" ${run.scrap < 60 ? 'disabled' : ''}><span class="rarity">${u.rarity} · 60 SCRAP</span><h3>${u.name}</h3><p>${u.description}</p></button>`).join('') : '<p>Upgrade purchased.</p>'}</div><div class="actions"><button data-m="reroll" ${run.scrap < reroll || run.shopBought ? 'disabled' : ''}>REROLL · ${reroll}</button><button class="primary" data-m="continue">DEPLOY STAGE ${run.stage + 1}</button><button data-m="home">SAVE & COMMAND</button></div>`, { repair: () => { if (buy(run, 'repair')) {
        persist();
        audio.cue('rescue');
    } shop(); }, kit: () => { if (buy(run, 'consumable'))
        persist(); shop(); }, ...Object.fromEntries(offers.map(u => [`buy-${u.id}`, () => { if (!run.shopBought && buy(run, 'upgrade', u.id)) {
            run.shopBought = true;
            persist();
            audio.cue('ability');
        } shop(); }])), reroll: () => { if (run.scrap >= reroll && !run.shopBought) {
        run.scrap -= reroll;
        run.shopRerolls = (run.shopRerolls ?? 0) + 1;
        run.offers = choices(run, run.shopRerolls * 7919).map(u => u.id);
        persist();
    } shop(); }, continue: nextStage, home }); }
function upgradeCard(u: UpgradeDef) { return `<button class="card upgrade r-${u.rarity}" data-m="u-${u.id}"><span class="rarity">${u.rarity} · RANK ${((progress.run!.upgrades[u.id] ?? 0) + 1)}/${u.maxRank}</span><h3>${u.name}</h3><p>${u.description}</p></button>`; }
function nextStage() { closeModal(); const run = progress.run!; run.stage++; run.phase = 'battle'; delete run.offers; run.seed = (run.seed * 1664525 + 1013904223) >>> 0; persist(); startBattle(run); }
function gameOver() { results('CITY SHIELD COLLAPSED'); }
function results(title: string) {
    closeModal();
    audio.mode = 'menu';
    game?.destroy(true);
    game = undefined;
    const run = progress.run!, score = run.score ?? 0, key = `score:${run.mode}`, previous = progress.records[key] ?? 0, record = score > previous;
    if (record)
        progress.records[key] = score;
    progress.rescues += run.rescued ?? 0;
    progress.xp += Math.floor(run.stage * 8 + (run.rescued ?? 0) * 2);
    progress.rank = 1 + Math.floor(progress.xp / 120);
    progress.run = undefined;
    persist();
    shell(`<section class="panel"><div class="eyebrow">AFTER-ACTION REPORT · ${MODE_NAMES[run.mode]}</div><h2>${title}</h2><div class="scoreline ${record ? 'record' : ''}"><span>${record ? 'NEW RECORD' : 'SCORE'}</span><b>${fmt(score)}</b><small>${record ? (previous ? `PREVIOUS BEST ${fmt(previous)}` : 'FIRST RECORDED RUN') : `BEST ${fmt(previous)}`}</small></div><div class="grid stats"><div class="card"><h3>STAGE</h3><p>${run.stage}</p></div><div class="card"><h3>SERVICE XP</h3><p>${progress.xp} · RANK ${progress.rank}</p></div><div class="card"><h3>RESCUED THIS RUN</h3><p>${run.rescued ?? 0}</p></div></div><div class="actions" style="margin-top:16px"><button class="primary" data-a="again">RUN IT BACK</button><button data-a="home">RETURN TO COMMAND</button></div></section>`);
    bind({ home, again: () => shipSelect(run.mode) });
}
function ending() { progress.campaignBest = 20; if (!progress.unlocks.includes('endless'))
    progress.unlocks.push('endless'); persist(); results('CITADEL PRIME DESTROYED'); }
function modal(html: string, actions: Record<string, () => void>) { closeModal(); document.body.insertAdjacentHTML('beforeend', `<div class="modal"><section class="panel">${html}</section></div>`); document.querySelectorAll<HTMLElement>('[data-m]').forEach(x => x.onclick = () => actions[x.dataset.m!]?.()); }
function closeModal() { document.querySelector('.modal')?.remove(); }
function hangar() { shell(`<section class="panel"><div class="eyebrow">PERMANENT PROGRESSION</div><h2>City restoration</h2><p>Pilot Rank ${progress.rank} · Service XP ${progress.xp} · Total rescues ${progress.rescues}</p><div class="grid">${['Residential lights', 'Transit station', 'Field hospital', 'Defense tower', 'Memorial garden'].map((x, i) => `<div class="card ${progress.rescues < (i + 1) * 5 ? 'locked' : ''}"><h3>${x}</h3><p>${progress.rescues >= (i + 1) * 5 ? 'RESTORED' : `${(i + 1) * 5 - progress.rescues} more rescues required`}</p></div>`).join('')}</div><p><button data-a="back">BACK</button></p></section>`); bind({ back: home }); }
function how() { shell(`<section class="panel"><div class="eyebrow">FIELD MANUAL</div><h2>How to play</h2><p>Move the defense ship to reflect the core. Where the core meets the paddle controls its angle: center hits rise vertically; edge hits cut diagonally. Destroy every required target, catch cyan rescue capsules and gold scrap, and dodge orange enemy fire. A core that meets enemy fire in flight destroys it.</p><p><b>Power capsules</b> fall from destroyed targets, and every eighth hit of an unbroken combo guarantees one:</p><ul class="powers">${Object.values(POWERS).map(p => `<li><b style="color:#${p.color.toString(16).padStart(6, '0')}">${p.label}</b> ${p.help}</li>`).join('')}</ul><p>Combos also multiply your score, up to 5×. Losing your last core breaks the combo. Later regions add moving formations, steel bumpers, plasma lanes, portals, gravity wells and blackouts.</p><p>Missing the final core or taking a projectile hit damages City Shield. A run ends at zero. Upgrades reset after a run; Service XP, ships, records, and city restoration persist.</p><p>Saves remain in this browser and do not sync automatically. Export a JSON backup when moving devices.</p><p><button data-a="back">BACK</button></p></section>`); bind({ back: home }); }
function settings() { const s = progress.settings; shell(`<section class="panel"><div class="eyebrow">SYSTEMS</div><h2>Settings & accessibility</h2>${range('music', 'Music', s.music, 0, 1, .05)}${range('sfx', 'Effects', s.sfx, 0, 1, .05)}${range('shake', 'Screen shake', s.shake, 0, 1, .05)}${range('touchSensitivity', 'Touch sensitivity', s.touchSensitivity, .5, 2, .1)}${toggle('reducedMotion', 'Reduced motion', s)}${toggle('crisp', 'High-resolution rendering (turn off if it stutters)', s)}${toggle('highContrast', 'High-contrast core', s)}${toggle('largeCore', 'Larger core (easier collisions)', s)}${toggle('directTouch', 'Direct-position touch', s)}${toggle('leftHanded', 'Left-handed ability button', s)}${toggle('assistSpeed', 'Assist: slower core', s)}${toggle('assistWidth', 'Assist: wider paddle', s)}${toggle('assistBullets', 'Assist: slower projectiles', s)}<div class="actions" style="margin-top:18px"><button data-a="export">EXPORT SAVE</button><label><input id="import" type="file" accept="application/json" hidden><button type="button" data-a="import">IMPORT SAVE</button></label><button class="danger" data-a="reset">RESET PROGRESS</button><button class="primary" data-a="back">DONE</button></div></section>`); document.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(x => x.oninput = () => { const k = x.dataset.setting as keyof Settings; (s as any)[k] = x.type === 'checkbox' ? x.checked : Number(x.value); persist(); }); bind({ export: () => exportSave(progress), import: () => document.querySelector<HTMLInputElement>('#import')!.click(), reset: () => { if (confirm('Reset all progress and settings? This cannot be undone.')) {
        progress = fresh();
        persist();
        home();
    } }, back: home }); document.querySelector<HTMLInputElement>('#import')!.onchange = async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (!f)
    return; try {
    progress = importSave(await f.text());
    toast('SAVE IMPORTED');
    settings();
}
catch (err) {
    alert(String(err));
} }; }
function range(k: keyof Settings, label: string, v: number, min: number, max: number, step: number) { return `<label class="setting"><span>${label}</span><input data-setting="${k}" type="range" min="${min}" max="${max}" step="${step}" value="${v}"></label>`; }
function toggle(k: keyof Settings, label: string, s: Settings) { return `<label class="setting"><span>${label}</span><input data-setting="${k}" type="checkbox" ${s[k] ? 'checked' : ''}></label>`; }
if ('serviceWorker' in navigator)
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));
audio.settings = progress.settings;
document.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
document.addEventListener('keydown', () => audio.unlock());
document.addEventListener('visibilitychange', () => { if (document.hidden)
    audio.suspend(); });
home();
if ((import.meta as any).env.DEV && new URLSearchParams(location.search).has('qa'))
    import('./dev').then(({ mount }) => mount(() => game?.scene.getScene('battle') as any, (stage, build) => { closeModal(); progress.run = newRun('campaign', 'guardian', 42); progress.run.stage = stage; progress.run.scrap = 200; progress.run.elements = build ? ['fire', 'lightning'] : ['ice']; if (build)
        progress.run.upgrades = { multiball: 1, damage: 2, charge: 1, wide: 2 }; persist(); startBattle(progress.run); }));
