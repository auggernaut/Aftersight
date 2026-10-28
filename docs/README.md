# AfterSight: developer guide

AfterSight is a city-builder sim in the browser. You are mayor of a real, contested American town in 2026, and a developer wants to build an AI data center campus there. How you deal with it decides who owns the AI and robot engine as abundance arrives, and whether the town thrives.

It is a modified version of [micropolisJS](https://github.com/graememcc/micropolisJS), the HTML5 port of Micropolis (the open-sourced 1989 SimCity engine). It is **not SimCity** and is not affiliated with Electronic Arts. The license is GPL-3.0 with additional terms (see the root [README](../README.md#license)).

- **Live:** https://aftersight-zeta.vercel.app. It is a stable Vercel production URL with `noindex, nofollow` set on purpose: it is not public yet.
- **Repo:** https://github.com/auggernaut/Aftersight. It is private. `main` is the game and the working branch.
- **Owner:** Augustin Bralley.

## The docs

| File | What's in it |
|---|---|
| [VISION.md](VISION.md) | What the game is for, the thesis, the name and the brand |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How it's built: the engine, layers, systems, file map and key functions |
| [DECISIONS.md](DECISIONS.md) | Dated decisions and the reasons for them |
| [IDEAS.md](IDEAS.md) | Ideas we've had but not built |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Known weak spots and unresolved questions |
| [RESEARCH.md](RESEARCH.md) | Sourced facts behind Festus, the deal, the ownership models and other towns |
| [history.md](history.md) | The project's earlier history (the cozy story build on `main`) |
| [../AGENTS.md](../AGENTS.md) | A short onboarding for AI agents |

## Run it locally

Node 18+ works (the box uses Node 22).

```
npm install
npm run build        # webpack -> dist/ (git-ignored)
npm run dev          # webpack dev server; or serve dist/ with any static server and open index.html
```

On the splash, choose **Play Festus, MO**, or open the new-game card and pick a town: Festus, a present-day starter town, or an empty valley.

## Tests

The end-to-end tests use Playwright from a separate install. Point `NODE_PATH` at its `node_modules`, and run `npm run build` first. Each test serves `dist/` itself, or tests a deployed build when `BASE_URL` is set (festus and mobile only).

```
export NODE_PATH=/path/to/playwright/node_modules      # on the agent box: /workspace/pw/node_modules
OUT=shots node e2e/festus.cjs     # Festus through the real UI: intro, offer, counter, accept, campus, Research Lab,
                                  # breakthrough, clinic, design asks, fund/projects, alert window, both election outcomes,
                                  # real dollars, the automation tide, Keystone leaving for good, a ticker ask, a co-op
                                  # bond, a project on the map, the built-out old town and empty lots, a new block filling
                                  # with houses while crews push rents up, robot crews halving build prices
OUT=shots node e2e/mobile.cjs     # emulated iPhone 14 and Pixel 7: tap, pan, pinch, toolbar, sheet, Festus cards, alert window
OUT=shots node e2e/smoke.cjs      # starter town: tools, zoom/pan, policies, 4 game years, events, save
N=30 node e2e/balance.cjs         # headless Festus balance: win rates for negotiate / firm / yes / no autoplayers (all of
                                  # them zone homes and shops) and `cards` (negotiates, never builds), and each town's
                                  # unemployment, Purpose, ownership share, path, population and peak rent in April 2032
RUNS=3 node e2e/compare.cjs       # starter town: hands-off vs community-ownership mayor
BASE_URL=https://aftersight-zeta.vercel.app/index.html OUT=shots node e2e/festus.cjs   # against the live site
npm test                          # upstream jest unit tests
```

Every test fails if the page logs a console error. `tools/` holds screenshot, timing and live-check scripts; see [tools/README.md](../tools/README.md).

Test hooks live on `window.__AL` (defined in `src/game.js`):

- `fastForward(months)` runs the sim flat out.
- `card()` and `decide(option, asks)` read and answer the current decision card.
- `mayor()`, `state()` and `census()` read state.
- `build(tool, x, y)` and `findSite()` place buildings.
- `quickAsk()` and `decideQuick(option)` read and answer the town hall ask waiting in the ticker (`decide()` also answers it when no card is open).
- `income()` and `path()` read the household income mix and the town's path.
- `force('Counter'|'Court'|'Vote', v)` forces a random outcome.
- `election(i, vote)` and `bump(deltas)` drive elections and faction moods.
- The layer itself is `__AL.layer`. Setting `__AL.layer.autoDecide = fn` makes an autoplayer.

## Deploying

**Deploys need Augustin's explicit OK every time.** The production URL above is a Vercel project (`auggernauts-projects/aftersight`) that is deployed from the agent box with the Vercel CLI. There is no Git integration.

```
bash tools/deploy/aftersight-redeploy.sh        # defaults to main
```

The script checks out the branch and pulls. It builds, copies `dist/` into a deploy folder linked to the Vercel project, and writes `vercel.json` with an `X-Robots-Tag: noindex, nofollow` header. It also adds a robots meta tag to every HTML file, then runs `vercel deploy --prod`. It deploys by itself, so run it once and don't run a separate `vercel deploy` afterwards. After a deploy, check that `curl -sI https://aftersight-zeta.vercel.app/ | grep -i robots` still shows noindex, and run `e2e/festus.cjs` and `e2e/mobile.cjs` with `BASE_URL`.

Never commit `.vercel/`, `.env*` or tokens.

## Branch map

Every branch is pushed to `origin`. `main` contains all the others in its history. The Festus work was developed on a `festus` branch, which was merged into `main` (fast-forward) and deleted on 2026-10-27.

| Branch | What it is |
|---|---|
| `main` | **The game and current work.** The isometric Micropolis build plus the Festus, MO mayor scenario and everything since. Deployed to the live URL. GitHub's default branch. |
| `micropolis-iso` | The isometric renderer, modern UI and mobile controls on the Micropolis engine, before Festus. |
| `micropolis` | The first fork: the Afterlight layer on micropolisJS with the original 1989 top-down tiles. |
| `sim` | An earlier, retired restart: a minimal agent-based valley sim (Yuka agents, loyalties, ownership shares). |
| `legacy/story-game` (also tag `legacy-story-game`) | The original cozy story game (Mara, Teo, Juno, Odile), retired. This was `main` until 2026-10-27 (f81a611). |

The status record for the whole project is `projects/afterlight.md` in [auggernaut/mind-dump](https://github.com/auggernaut/mind-dump/blob/main/projects/afterlight.md).
