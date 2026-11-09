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

## Content status

The build contains three ships, four elemental specializations, six named synergy definitions, 30 upgrades, 12 target archetypes, 20 data-defined stages, four boss operations, progression, city milestones, campaign/quick/daily/endless mode routing, PWA metadata, offline caching, and procedural vector presentation.

See [IMPLEMENTATION.md](./IMPLEMENTATION.md), [TEST_RESULTS.md](./TEST_RESULTS.md), and [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).
