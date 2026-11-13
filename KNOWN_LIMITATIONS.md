# Known limitations — 0.3.0

- **Balance is tuned by simulation, not by people.** A paddle bot that never dodges and takes the first upgrade offered clears stages 1–9 and usually falls at the second or third boss. Human pacing, boss difficulty and the power-capsule drop rate need real playtesting.
- Bosses share the carrier hull artwork and two-phase structure; they differ in health, armor plates, aimed fire, plasma lanes and movement, not in bespoke choreography.
- Reflector and command targets exist in data but are not used by any authored layout.
- Gamepad menu navigation is still incomplete (in-battle stick, A and B work).
- **Performance on real phones is unmeasured.** The new renderer draws at 2× on high-DPI screens with additive glow layers. If it stutters, turn off *High-resolution rendering* in Settings; *Reduced motion* removes most particles.
- No physical iPhone, Android or Steam Deck testing or hardware FPS measurement was done for this version. Browser checks used headless desktop Chrome at a 390×844 touch viewport.
- Audio was checked for errors only; nobody has listened to the new cues on device speakers.
- Saves and score records are local to the current browser. Mid-stage reload intentionally restores the saved stage beginning. The daily challenge shares a seed by local date but has no online leaderboard.
- Phaser produces a large vendor chunk (~1.2 MB uncompressed).
