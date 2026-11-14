# LAST DEFENSE: COREBREAKER

Original portrait-first paddle defense game built with TypeScript, Phaser 3, and Vite.

## Run

Requires Node 20.19+ or 22.12+.

```sh
npm install
npm run dev
npm test
npm run build
```

The production build is written to `dist/` with relative paths for GitHub Pages, Cloudflare Pages, and itch.io. Zip the *contents* of `dist/` so `index.html` is at the archive root.

## Controls

- Touch: relative drag; tap to launch; on-screen ability button.
- Mouse: move; click to launch.
- Keyboard: A/D or arrows; Space launch; E/Shift ability; Escape pause.
- Gamepad: left stick movement (menu focus support is in progress).

Progress saves at stage boundaries in versioned local storage with a previous-valid backup. Settings provides JSON export/import. Browser saves do not automatically sync.

## Overcharge 0.3.0

Live game: https://outerheavenx.github.io/corebreaker/

The fun pass. Destroyed targets and combo streaks drop **power capsules** — SPLIT, WIDE, GUNS, PIERCE and WALL. Every hit builds a **combo** that multiplies your **score** up to 5× and pays out a guaranteed capsule every eighth hit; best scores are kept per mode. The early game is faster (one-hit scouts, quicker core), health scales by region, and the arena modifiers are real: moving formations, steel bumpers, plasma lanes, portals, gravity wells and a blackout stage. The four bosses differ in health, armor, aim, lanes and movement, and Endless gets tougher every loop. Cores destroy enemy shots in flight, and a tap launches on touch screens.

All visuals are procedural sprites drawn at start-up: glossy rainbow brick walls, a lit city under a nebula sky, additive glow, sparks, debris, lightning and big callouts. High-DPI screens render at 2× (toggle in Settings).

Four elements and six combinations affect combat. Choose a second element instead of a stage upgrade. All 30 upgrade IDs are connected to their effects; ship-specific perks are filtered to compatible ships. Campaign bosses open a field depot with repairs, a run upgrade, a portable repair kit, and paid stock rerolls. Quick Defense ends after its boss.

Original synthesized music and sound effects unlock on your first tap/click. Adjust Music and Effects independently in Settings (zero mutes that channel). Screen shake and reduced motion are respected by every new effect. Leaving a battle or reloading restarts that stage from its saved beginning. Pending upgrade/shop choices and purchases persist immediately.

The simulation uses 120 Hz bounded fixed steps and swept expanded-box collisions. Effects are capped at 220 sparks, 70 debris chunks, 33 projectiles, 24 blaster bolts, 24 pickups, five cores, and five lightning chain targets. Secondary hits cannot recursively trigger elements or fuel explosions.

Local development only: open Vite with `?qa=1` for stage loading, a fixed elemental/multiball build, controlled target damage, core loss, and a battle-state readout. These controls are removed from production bundles.

## Earlier content status

The build contains three ships, four elemental specializations, six named synergy definitions, 30 upgrades, 12 target archetypes, 20 data-defined stages, four boss operations, progression, city milestones, campaign/quick/daily/endless mode routing, PWA metadata, offline caching, and procedural vector presentation.

See [IMPLEMENTATION.md](./IMPLEMENTATION.md), [TEST_RESULTS.md](./TEST_RESULTS.md), and [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).
