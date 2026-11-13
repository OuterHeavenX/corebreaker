# Changelog

## 0.3.0 — Overcharge

Fun pass: faster early game, power capsules, a real combo and score loop, arena modifiers that finally do something, and four distinct bosses.

### New
- **Power capsules** drop from destroyed targets (10% chance, guaranteed after 11 dry kills) and from every eighth hit of an unbroken combo: SPLIT (every core splits, up to five), WIDE (+40% paddle, 12s), GUNS (twin auto-blasters, 7s), PIERCE (cores hit 50% harder and punch through kills, 6s) and WALL (floor barrier, 9s).
- **Score and records.** Hits, kills, rescues, intercepted shots and a shield bonus at stage clear all score; the combo multiplies score up to 5×. Best score per mode is saved, shown on the title screen, mode select and a new results screen with a "run it back" button.
- **Combo counter** with decay bar, rising hit pitch, and milestone payouts. Losing the last core breaks the combo.
- **Arena modifiers now change play:** moving formations (stages 4, 7, 17), steel bumpers (6, 8), plasma lanes (9, 18), portals (11, 12, 19), gravity wells (13, 14) and blackout (16).
- **Four distinct bosses.** Furnace Engine adds plasma lanes, Coil Serpent sways and aims at the ship, Citadel Prime has a third armor plate, aimed fire, lanes and faster escorts. Each has its own health.
- **Endless scaling.** Every 20-stage loop adds 60% target and boss health and faster, more frequent enemy fire.
- Cores destroy enemy shots they meet in flight.
- Tap anywhere on the playfield to launch on touch screens.
- Game feel: camera shake, hit-stop on big kills, slow-motion on the last kill, core glow and comet trails, impact rings, floating score numbers, gravity sparks, target drop-in animation, glossy targets, ship thrusters, dotted aim guide, starfield and per-region colour palettes.

### Changed
- Core launches 6% faster (350 px/s); scouts in the first region fall in one hit. Target health now scales by region instead of staying flat for all 20 stages.
- Formations are centred on the playfield (rows were offset to the left).
- City Shield regains 10 between stages.
- At sector clear, cores are recalled and pickups are vacuumed to the ship; the stage ends as soon as collection is done instead of always waiting four seconds.
- Boss phase two: only the exposed reactor fires three-shot spreads (guns previously tripled too).
- Toasts moved off the paddle line.

### Fixed
- A core could rally forever against the shielded boss reactor without the stall guidance ever triggering.
- A core rallying vertically in an emptied column is now quietly re-aimed off the paddle after six seconds.
- Stall guidance no longer steers a core straight into an obstacle.
- Moving targets could slide over a core and let it pass through; the core is now pushed out and the hit counts.
- Stage objectives claimed a required rescue on stages that had no prison ships.
- Finishing the campaign more than once added duplicate "endless" unlock entries.
- Missing favicon caused a 404 on every load.

## 0.2.0 — Reactor Rising

- Implemented burns, freeze/slow, lightning chains, kinetic armor breaks, precision hits and six bounded synergies.
- Connected all 30 upgrades, weighted choices, compatibility filtering and second-element choices.
- Added multiball, per-stage emergency catches, portable repair kits and accurate last-core loss rules.
- Rebuilt Siege Carrier as a component-based, two-phase encounter; fixed impossible boss completion.
- Added campaign depots, repairs, upgrades, consumables and paid rerolls with persisted stock/purchases.
- Added original menu, region and boss synth score; 14 sound cues, volume controls and gesture-safe audio.
- Added core trails, sparks, health strips, telegraphs, shield meter, ability timer, visible charge and hull artwork.
- Replaced overlap physics with bounded 120 Hz swept simulation; added 34 new checks (39 total).
- Fixed corrupt-save fallback and persisted pending reward/shop states; isolated stage-start checkpoints.
- Kept mobile controls outside the scaled canvas with 44px minimum touch targets.

## 0.1.0 — Signal Build

- Initial playable campaign architecture and procedural visual identity.
- Added core combat, target formations, ships, upgrades, progression, resilient local save, accessibility settings, PWA packaging, and deterministic logic tests.
