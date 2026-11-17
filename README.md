# makefun-best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/nonicon/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/nonicon/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Emberkeep — Last Light of the Beacon.** A wave-defense arena game: you are the keeper of the last beacon in a drowned night. Ember wisps drift in from the dark to swallow its light. Hold the line for 10 waves — move with WASD, aim with the mouse, hold click to fire bolts of light, spend the embers the fallen drop in the between-wave shop, and blast the crowd back with a shockwave when they close in. Survive all ten waves and the light endures; let the beacon fall and the night wins.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network: the game is plain static files under `game/`.

## How to play

- **WASD / arrow keys** — move the keeper
- **Mouse** — aim, **hold click** — fire light bolts
- **SPACE** — shockwave (limited charges, +1 after each wave)
- **1–6** — buy in the between-wave shop (click works too)
- **P** — pause, **M** — mute, **Enter / R** — start again

Wisps come in six kinds: slow embers, zigzagging darts, splitters that burst into motes, and armored brutes — and on the tenth wave the Night Herald walks in, a crowned boss that will not die on the beacon and pulses out motes as it advances. Kills build a combo multiplier; fallen wisps drop embers you collect to buy damage, fire rate, speed, beacon repairs, hearts, and shockwave coils.

## Layout

- `game/` — the playable game: `index.html` plus `src/` (config, seeded RNG, synthesized WebAudio sounds, input, enemies, world rules, rendering, screenshot autopilot)
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — title, mid-wave play, shop, and victory screens, staged by the game's own autopilot
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
