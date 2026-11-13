import type { Element, EnemyType, PowerId, ShipDef, StageDef, UpgradeDef } from './types';
export const VERSION = '0.3.0';
export const VERSION_NAME = 'OVERCHARGE';
export const SHIPS: ShipDef[] = [
    { id: 'guardian', name: 'GUARDIAN', width: 94, speed: 360, ability: 'Aegis Field', description: 'Balanced. Catches one lost core for 6s.', unlockRank: 1 },
    { id: 'striker', name: 'STRIKER', width: 72, speed: 400, ability: 'Overdrive', description: 'Narrow and fast. 8s boosted damage and armor piercing.', unlockRank: 3 },
    { id: 'magnetar', name: 'MAGNETAR', width: 84, speed: 320, ability: 'Magnetic Hold', description: 'Control ship. Attracts pickups and catches the core.', unlockRank: 5 }
];
const U = (id: string, name: string, description: string, rarity: 'COMMON' | 'RARE' | 'EPIC', maxRank: number, tags: string[], prereq?: string): UpgradeDef => ({ id, name, description, rarity, maxRank, tags, prereq });
export const UPGRADES: UpgradeDef[] = [
    U('wide', 'Vector Wings', 'Paddle width +12%.', 'COMMON', 3, ['paddle']), U('speed', 'Servo Burst', 'Paddle speed +10%.', 'COMMON', 3, ['paddle']), U('magnet', 'Flux Collector', 'Pickup attraction +35 units.', 'COMMON', 3, ['rescue']),
    U('damage', 'Core Compression', 'Direct core damage +20%.', 'COMMON', 4, ['core']), U('multiball', 'Echo Split', 'Spawn one capped auxiliary core each stage.', 'EPIC', 1, ['core']), U('burn', 'Long Fuse', 'Burn lasts +1.5s.', 'COMMON', 3, ['fire'], 'element-fire'),
    U('chain', 'Forked Current', 'Lightning chains to +1 target.', 'RARE', 2, ['lightning'], 'element-lightning'), U('freeze', 'Cryo Lattice', 'Freeze buildup +25%.', 'COMMON', 3, ['ice'], 'element-ice'), U('pierce', 'Sabot Core', 'Charged hits pierce +1 armor.', 'RARE', 2, ['kinetic'], 'element-kinetic'),
    U('catch', 'Failsafe Net', 'Catch one missed core per stage.', 'RARE', 1, ['defense']), U('slowmo', 'Threat Sense', 'Near misses slow time briefly.', 'RARE', 2, ['defense']), U('rescue', 'Beacon Protocol', 'Rescue rewards +30%.', 'COMMON', 3, ['rescue']),
    U('repair', 'Field Logistics', 'Shop repairs cost 20% less.', 'COMMON', 2, ['economy']), U('cooldown', 'Rapid Cycling', 'Ability cooldown -15%.', 'COMMON', 3, ['ability']), U('edge', 'Razor Return', 'Edge hits grant one piercing impact.', 'RARE', 2, ['paddle']),
    U('shield', 'Reactive Plating', 'City Shield maximum +10.', 'COMMON', 3, ['defense']), U('scrap', 'Salvage Rights', 'Scrap drops +20%.', 'COMMON', 3, ['economy']), U('crit', 'Impact Calculus', 'Precision impacts gain +15% crit chance.', 'RARE', 3, ['kinetic']),
    U('ignite', 'Wildfire', 'Burn can spread once to a nearby target.', 'RARE', 2, ['fire'], 'burn'), U('shatter', 'Deep Freeze', 'Frozen targets take +35% impact damage.', 'RARE', 2, ['ice'], 'freeze'), U('conductor', 'Arc Geometry', 'Lightning range +25%.', 'COMMON', 3, ['lightning'], 'chain'),
    U('charge', 'Capacitor Paddle', 'Three paddle hits charge the next core strike.', 'RARE', 2, ['core']), U('barrier', 'Shield Dividend', 'Aegis saves grant 12 scrap.', 'COMMON', 2, ['ability']), U('overdrive', 'Hot Chamber', 'Overdrive lasts +2s.', 'RARE', 2, ['ability']),
    U('hold', 'Stable Orbit', 'Magnetic Hold aim time +2s.', 'COMMON', 2, ['ability']), U('capsule', 'Soft Recovery', 'Missed rescues have a 25% second pass.', 'RARE', 2, ['rescue']), U('combo', 'Combo Insurance', 'Combo decays 35% slower.', 'COMMON', 3, ['core']),
    U('blast', 'Volatile Return', 'Destroying fuel cells increases blast radius.', 'RARE', 2, ['fire']), U('phase', 'Phase Jacket', 'First projectile hit each stage is blocked.', 'EPIC', 1, ['defense']), U('apex', 'Apex Protocol', 'All synergy proc cooldowns -20%.', 'EPIC', 1, ['element'])
];
export const ELEMENTS: Record<Element, {
    name: string;
    description: string;
    color: number;
}> = { fire: { name: 'FIRE', description: 'Burning damage; Thermal Shock / Plasma Arc.', color: 0xff6b35 }, ice: { name: 'ICE', description: 'Slow and freeze; Conductive Freeze / Shatter.', color: 0x70d6ff }, lightning: { name: 'LIGHTNING', description: 'Capped chains; Plasma Arc / Rail Surge.', color: 0xffe66d }, kinetic: { name: 'KINETIC', description: 'Armor breaks and precision criticals.', color: 0xd9f99d } };
export const SYNERGY_DETAILS: Record<string, string> = {
    'THERMAL SHOCK': 'Freeze, then ignite: consumes frost for a 1.2-damage burst within 65 units.',
    'CONDUCTIVE FREEZE': 'A frozen impact adds two chain targets, capped at five.',
    'PLASMA ARC': 'Chains apply a 1.5-second burn at 0.2 damage per second.',
    'SHATTER IMPACT': 'Precision rebounds deal +2 damage to frozen targets.',
    'BREACHING CHARGE': 'Breaking armor creates a 1.5-damage burst within 65 units.',
    'RAIL SURGE': 'Charged rebounds pierce up to two contacts. Charge with Striker or Capacitor Paddle.'
};
const layouts = [['ssssss', 'sasaas', 'ssssss'], ['spssps', 'aaaaaa', 'ssssss'], ['ssgsss', 'spssps', 'aaaaaa'], ['iiiii', 'saaas', 'sssss'], ['gggggg', 'aaaaaa', 'ssssss'], ['rrfrr', 'saaas', 'fffff'], ['rffrff', 'aaaaaa', 'ssssss'], ['msssm', 'fffff', 'aaaaa'], ['crrrrc', 'ffffff', 'aaaaaa'], ['ffffff', 'rrrrrr', 'gggggg'], ['hsshsh', 'aaaaaa', 'ccscc'], ['hphphp', 'ssssss', 'gggggg'], ['cciiic', 'hssss', 'aaaaa'], ['hhpphh', 'cccccc', 'ssssss'], ['hhhhhh', 'cccccc', 'aaaaaa'], ['gmrpmg', 'afssfa', 'ssssss'], ['ccggcc', 'rrffrr', 'aaaaaa'], ['hmirhm', 'caffac', 'ssssss'], ['gchhcg', 'rmffmr', 'aaaaaa'], ['hhhhhh', 'ggccgg', 'rrffrr']];
const map: Record<string, EnemyType> = { s: 'scout', a: 'armored', h: 'shield', r: 'repair', g: 'gunship', m: 'mine', i: 'interceptor', x: 'reflector', c: 'conductive', f: 'fuel', p: 'prison', d: 'command' };
export const SYMBOL_TO_ENEMY = map;
export const STAGES: StageDef[] = layouts.map((layout, i) => ({ id: i + 1, region: ['CITY OUTSKIRTS', 'INDUSTRIAL BELT', 'ORBITAL DEBRIS', 'THE INVASION CORE'][Math.floor(i / 5)], name: ['First Contact', 'Armor Line', 'Civilian Signal', 'Moving Front', 'Siege Carrier', 'Hot Works', 'Repair Cycle', 'Mine Shift', 'Fuel Run', 'Furnace Engine', 'Broken Orbit', 'Portal Lattice', 'Gravity Choir', 'Shield Web', 'Coil Serpent', 'Black Approach', 'Command Chain', 'Plasma Rise', 'Last Gate', 'Citadel Prime'][i], layout, modifier: [undefined, undefined, undefined, 'moving', 'boss', 'barrier', 'moving', 'barrier', 'plasma', 'boss', 'portal', 'portal', 'gravity', 'gravity', 'boss', 'blackout', 'moving', 'plasma', 'portal', 'boss'][i], objective: [5, 10, 15, 20].includes(i + 1) ? 'Break the armor, then destroy the reactor' : layout.some(r => r.includes('p')) ? 'Clear all targets · catch the rescue capsules' : 'Clear all targets', reward: 40 + i * 8, boss: [5, 10, 15, 20].includes(i + 1) ? ['Siege Carrier', 'Furnace Engine', 'Coil Serpent', 'Citadel Prime'][Math.floor(i / 5)] : undefined, tutorial: i < 6 ? ['Drag to move · tap to launch · paddle edges aim the core.', 'Catch falling POWER capsules. Keep your combo alive for more.', 'Catch cyan rescue capsules.', 'Press E/Shift or ABILITY.', 'Choose one upgrade after the stage.', 'Element pairs unlock named synergies.'][i] : undefined }));

/** Timed pickups dropped by destroyed targets and combo milestones. */
export const POWER_IDS: PowerId[] = ['split', 'wide', 'blaster', 'overcharge', 'barrier'];
export const POWERS: Record<PowerId, { label: string; name: string; color: number; seconds: number; help: string }> = {
    split: { label: 'SPLIT', name: 'CORE SPLIT', color: 0xffd166, seconds: 0, help: 'Every core splits in two (up to five).' },
    wide: { label: 'WIDE', name: 'WIDE WINGS', color: 0x4de9ff, seconds: 12, help: 'Paddle grows 40% for 12 seconds.' },
    blaster: { label: 'GUNS', name: 'TWIN BLASTERS', color: 0xff6b9d, seconds: 7, help: 'Paddle auto-fires bolts for 7 seconds.' },
    overcharge: { label: 'PIERCE', name: 'OVERCHARGED CORE', color: 0xff8a3c, seconds: 6, help: 'Cores hit harder and punch through kills for 6 seconds.' },
    barrier: { label: 'WALL', name: 'ENERGY WALL', color: 0x8cff9e, seconds: 9, help: 'A floor wall bounces every core for 9 seconds.' }
};
export interface BossDef { hp: number; parts: number; plates: number; aimed: boolean; lanes: boolean; sway: boolean; alert: string; }
export const BOSSES: Record<string, BossDef> = {
    'Siege Carrier': { hp: 28, parts: 1, plates: 2, aimed: false, lanes: false, sway: false, alert: 'SIEGE ALERT · BREAK THE ARMOR' },
    'Furnace Engine': { hp: 34, parts: 1.15, plates: 2, aimed: false, lanes: true, sway: false, alert: 'FURNACE ENGINE · DODGE THE PLASMA LANES' },
    'Coil Serpent': { hp: 42, parts: 1.3, plates: 2, aimed: true, lanes: false, sway: true, alert: 'COIL SERPENT · IT TRACKS YOUR SHIP' },
    'Citadel Prime': { hp: 56, parts: 1.5, plates: 3, aimed: true, lanes: true, sway: true, alert: 'CITADEL PRIME · END THE INVASION' }
};
/** Endless wraps the 20 authored stages; every loop is tougher. */
export const stageLoop = (stage: number) => Math.floor((stage - 1) / 20);
export const stageRegion = (stage: number) => Math.floor(((stage - 1) % 20) / 5);
export const difficulty = (stage: number) => 1 + .3 * stageRegion(stage) + .6 * stageLoop(stage);
export function enemyHp(type: EnemyType, stage: number) { const base = type === 'armored' ? 3.4 : type === 'scout' ? 1.2 : 3; return Math.max(1, Math.round(base * difficulty(stage))); }
/** Score multiplier from the live combo: +0.5 per five hits, capped at x5. */
export const comboMultiplier = (combo: number) => Math.min(5, 1 + Math.floor(combo / 5) * .5);
