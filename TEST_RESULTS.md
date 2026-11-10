# Verification — Reactor Rising 0.2.0

## Automated (Windows / Node / Vitest)

39 checks pass across four files. Production TypeScript/Vite build passes.

Coverage includes swept high-speed collisions, successive contacts, rebound rules, all six synergy prerequisites/cooldowns, freeze resistance, upgrade compatibility and rank limits, shop prices/caps/duplicate prevention, corrupt-save backup recovery, migration, pending offers, shop stock, multiball, Aegis expiration, invulnerability, fuel non-recursion, collection windows and boss phase/defeat transitions.

The battle suite calls the actual simulation with rendering stubbed. A seeded paddle bot (Guardian, Fire + Lightning, damage rank 2, capacitor rank 1) cleared each stage independently with no forced kills or health resets:

| Stage | Simulated seconds | Shield remaining |
|---|---:|---:|
| 1 | 54.6 | 100 |
| 2 | 55.0 | 100 |
| 3 | 61.6 | 82 |
| 4 | 53.2 | 100 |
| 5 | 76.7 | 4 |

These are simulation observations, not human pacing measurements or rendered FPS benchmarks.

## Interactive desktop browser / viewport emulation

Verified title → campaign → ship → element → arena, launch, pause, visible multiball, upgrade selection, continuation from a pending upgrade, boss-clear → shop, kit and upgrade purchases, persisted stock and currency after reload, and deployment into stage 6. Dev-only target-damage controls exercised transitions; they are not evidence of manual boss completion.

Screens inspected at desktop 1280×720 and portrait 390×844 / 320×568. On the 320×568 viewport all four controls measured 72.25×44 CSS pixels and fit inside the viewport. No console errors were captured during these checks.

## Hardware

Real iPhone: not tested by the agent. Real Steam Deck: not tested. Speaker listening, touch feel and hardware performance require device playtesting.
