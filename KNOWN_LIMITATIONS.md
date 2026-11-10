# Known limitations — 0.2.0

- The requested combat/upgrade/Siege Carrier/shop/audio pass is implemented. The larger original campaign brief remains unfinished.
- Later boss operations currently reuse the new carrier component encounter; bespoke Furnace Engine, Coil Serpent and Citadel Prime choreography remains future work.
- Several named arena modifiers still do not alter physics. Reflector and command-enemy behaviors remain basic.
- Endless does not yet have a complete scaling curve, and gamepad menu navigation is incomplete.
- A seeded automated paddle bot clears stages 1–5; this does not establish human difficulty or pacing. The bot used a fixed two-element build and two damage ranks.
- Browser viewport checks are desktop emulation. No agent-operated physical iPhone or Steam Deck tests or hardware FPS measurements were performed. The user reported the previous 0.1.0 build worked on iPhone.
- Audio synthesis initializes without browser errors, but device-speaker listening and interruption behavior need physical iPhone testing.
- Saves are local to the current browser. Mid-stage reload intentionally restores the saved stage beginning.
- Phaser produces a large vendor chunk (~1.21 MB uncompressed); the total compressed JavaScript payload is about 351 KB.
