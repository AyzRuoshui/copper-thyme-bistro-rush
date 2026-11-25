# Copper & Thyme: Bistro Rush

[![make.fun · Make the best cooking game](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/AyzRuoshui/copper-thyme-bistro-rush/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/AyzRuoshui/copper-thyme-bistro-rush/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

An original offline HTML5 Canvas cooking game built for make.fun’s [“Make the best cooking game” challenge](https://make.fun/bounty/best-cooking-game-20261125-0137).

## Play locally

```sh
node serve.ts
```

Open `http://127.0.0.1:8080` in desktop Chrome. Everything runs offline from static files under `game/` with zero external network requests and procedural Web Audio sound effects.

## Controls

- **Move:** `WASD` / `Arrow Keys` or click any station to pathfind directly to it
- **Interact / Plate / Serve:** `Space` / `E` / Left Click
- **Chop / Pan Toss / Stir:** `F` / `Shift` or rapid clicks at Cutting Boards and Stoves
- **Discard to Compost:** `Q` / `X`
- **Recipe Book / Pause / Mute:** `R` / `Esc` (`P`) / `M`

## Build output and tests

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
node --test tests/kitchen-state.test.mjs tests/dossier-gate.test.mjs
```

## Screenshots

Gameplay screenshots are in [`screenshots/`](screenshots/), including service rush, prep and sear, combo service, and the title menu.

## License

MIT; see [LICENSE](LICENSE).

---

Prepared for [make.fun](https://make.fun/bounty/best-cooking-game-20261125-0137).
