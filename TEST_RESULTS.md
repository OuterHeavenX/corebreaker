# Test results

## Automated

`npm test`: **5 passed, 0 failed** on 2026-11-09.

Coverage targets rebound angles, anti-stall correction, final-ball rules, damage invulnerability, and seed reproducibility.

`npm run build`: **passed** (TypeScript and Vite production build).

## Browser

The production preview server returned the built `index.html` successfully. The in-app browser smoke check was blocked by a pre-existing service worker on the default localhost preview origin; an isolated port was not reachable from that browser sandbox. This is recorded as **not passed**, not silently treated as success.

Hardware status: real iPhone **not tested**; real Steam Deck **not tested**. Desktop and mobile-emulation checks must not be interpreted as hardware validation.
