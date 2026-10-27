# Agent instructions

AfterSight is a city-builder sim on the micropolisJS engine about who owns AI, robots and compute as abundance arrives. You play the mayor of Festus, MO in 2026 against a data center developer. **Work on `main`** (the old story game is on `legacy/story-game`).

## Start here

1. [docs/README.md](docs/README.md): what it is, running locally, tests, deploy, branch map.
2. [docs/VISION.md](docs/VISION.md): why the game exists. Read it before proposing features.
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the code fits together, and where each system lives.
4. [docs/DECISIONS.md](docs/DECISIONS.md), [docs/IDEAS.md](docs/IDEAS.md), [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md), [docs/RESEARCH.md](docs/RESEARCH.md).

## Run and test

```
npm install && npm run build
export NODE_PATH=<playwright install>/node_modules    # Playwright isn't a repo dependency
OUT=shots node e2e/festus.cjs     # main end-to-end test (Festus through the real UI)
OUT=shots node e2e/mobile.cjs     # phones
OUT=shots node e2e/smoke.cjs      # starter town
N=30 node e2e/balance.cjs         # win rates per offer strategy; rerun after any tuning change
```

Tests serve `dist/`, so rebuild after every change. Set `BASE_URL` only for one command at a time (festus and mobile can test the live site). An exported `BASE_URL` quietly points later local runs at production. The tests fail on any console error. Look at the screenshots in `shots/` after visual changes.

## Conventions

- AfterSight code lives in `src/afterlight/`. Mayor-scenario logic is in `mayor.js`, with tuning constants at the top. The economy, mood and events are in `layer.js`. The Festus map is in `festus.js`. Cards, the alert window, the panel and the UI each have their own file.
- Engine edits stay small and are marked with an `Afterlight` or `Aftersight` comment. Prefer a hook into the layer over changing engine logic.
- All state that must survive a save lives in `layer.s` (it's saved under `saveData.afterlight`). Test hooks go on `window.__AL` in `game.js`.
- `isoCanvas.js` replaces GameCanvas. Keep its public methods in step with what `game.js`, `inputStatus.js` and `notification.js` call.
- All art is procedural canvas drawing (`src/afterlight/iso/`). Don't add copied or copyrighted city-builder art. 3D assets, if ever used, go in only as rendered sprites, never as source models.
- Player-facing name: **AfterSight** (capital S). Code, package and folder names still say `afterlight`; leave them.
- Writing in the game and the docs is plain and short. Cards show how each faction would react; alerts say why something happened.

## Rules

- **No deploys without Augustin's explicit OK**, every time. The deploy script deploys by itself, so run it once. Details are in [docs/README.md](docs/README.md#deploying).
- **No secrets in the repo:** no `.env*`, `.vercel/`, tokens or keys. Grep the diff before you commit.
- **Keep it SimCity-simple and playable.** New systems must read from the screen and keep all four balance strategies winnable, with negotiating winning most. Run `e2e/balance.cjs` after tuning changes.
- **License:** a modified micropolisJS under GPL-3.0, plus additional terms and the Micropolis Public Name License. Keep LICENSE, COPYING, MicropolisPublicNameLicense.md, name_license.html, the file headers and the footer and About attribution. Never call it SimCity.
- The Festus scenario uses a fictional developer (Keystone Compute Partners) and no real people's names.
- No Report Card or ending screen until Augustin asks for one.

## Project record

The central status record is `projects/afterlight.md` in [auggernaut/mind-dump](https://github.com/auggernaut/mind-dump/blob/main/projects/afterlight.md). After meaningful changes (features, fixes, releases, decisions, status changes), update it:

- refresh "Where things stand", the focus areas and the open questions
- bump `_Last updated_`
- add a short dated Log line

If you can't push to mind-dump, say so in your report.
