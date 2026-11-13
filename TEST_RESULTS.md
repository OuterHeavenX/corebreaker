# Verification — Overcharge 0.3.0

## Automated

61 checks pass across four files (39 carried over from 0.2.0, 22 new). TypeScript type-checks cleanly against the Phaser 3.90.0 type definitions.

How this was run: the agent's environment could not install npm packages, so the test files were bundled with esbuild and executed with a small `vitest`-compatible shim, and the type-check used TypeScript 6.0 with Phaser's published `types/phaser.d.ts`. The project's own `npm test` (Vitest) and `npm run build` (tsc + Vite) run in the GitHub Actions deploy workflow and gate deployment.

New coverage: region and endless health scaling, combo and pity power drops, each power capsule's effect, deferred split while holding, energy wall bounce, overcharge pass-through versus rebound, blaster bolts and steel bumpers, moving-target overlap resolution, portals, plasma-lane damage, gravity-well speed conservation, per-boss health and parts, score/combo multiplier persistence, combo break on core loss, shot interception, and the vertical-rally re-aim.

The battle suite calls the real simulation with rendering stubbed. The original seeded paddle bot (Guardian, Fire + Lightning, damage rank 2, capacitor rank 1) still clears stages 1–5 from a fresh state:

| Stage | Simulated seconds (0.2.0 → 0.3.0) | Shield remaining (0.2.0 → 0.3.0) |
|---|---:|---:|
| 1 | 54.6 → 25.1 | 100 → 100 |
| 2 | 55.0 → 46.1 | 100 → 100 |
| 3 | 61.6 → 52.3 | 82 → 98 |
| 4 | 53.2 → 25.9 | 100 → 100 |
| 5 | 76.7 → 58.7 | 4 → 68 |

A simpler bot also runs one simulated minute on stages 6, 9, 10, 11, 13, 16 and 20 to exercise every arena modifier and boss variant, asserting finite core state throughout.

A separate carry-over simulation (not part of the suite, run before the extra brick rows were added) chained whole campaign runs on three seeds with a bot that never dodges and takes the first upgrade offered: it cleared stages 1–9 on every seed and died at stage 10 or 15. These are simulation observations, not human pacing measurements.

## Browser (headless Chrome, WebGL via SwiftShader, 390×844)

A bundle built from this source with Phaser 3.90.0 was driven by a scripted bot on all 20 stages plus an endless-loop stage (25), with every power capsule active: no page errors or console errors. A touch-emulated pass covered title → how to play → quick defense → ship → element → tap-to-launch → stage clear → upgrade choice → stage 2 with score carried → forced defeat → results with new record → record shown on the title screen. Screenshots were inspected for HUD overlap, toast placement and modifier visuals.

Stages 1–4 now carry two extra brick rows (30 bricks instead of 18) and still clear faster than 0.2.0.

Frame rate in software-rendered headless Chrome (no GPU) was about 17–21 fps at 1× and about 12 fps at 2×, dominated by full-screen textured fills that a real GPU handles easily; it says nothing about real devices, which remain untested. A layer-by-layer profile was used to remove the worst costs (tiled star layers, per-frame text re-rasterising, separate vignette and skyline quads).

## Hardware

Real iPhone, Android and Steam Deck: not tested. Speaker listening, touch feel and hardware performance require device playtesting.
