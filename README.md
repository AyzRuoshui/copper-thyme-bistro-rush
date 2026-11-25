# Copper & Thyme: Bistro Rush

An original offline HTML5 Canvas cooking game built for the `best-cooking-game-20261125-0137` challenge.

## Play Locally

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

## Build Output & Tests

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
node --test tests/kitchen-state.test.mjs tests/dossier-gate.test.mjs
```
