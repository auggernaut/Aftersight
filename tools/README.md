# tools/

Helper scripts that aren't part of the game build. The Playwright scripts need Playwright from a separate install: set `NODE_PATH=<playwright>/node_modules` (on the agent box, `/workspace/pw/node_modules`). Run `npm run build` first; scripts serve `dist/` unless `BASE_URL` is given.

| Script | What it does |
|---|---|
| `deploy/aftersight-redeploy.sh [branch]` | Builds the branch and deploys `dist/` to the Vercel production URL with noindex. **Needs Augustin's OK. Run once; it deploys by itself.** Needs the Vercel CLI, logged in, and a deploy folder linked to the `aftersight` project (`DEPLOY_DIR`, default `/workspace/aftersight`, which holds `.vercel/`; never commit that). `REPO` defaults to `/workspace/Afterlight`. |
| `live-check.cjs <url>` | Opens a deployed build, starts the default map, and prints the HTTP status, the `x-robots-tag` header, the census, the title, the visible panels, the license footer and any console errors. Saves a screenshot to the file path in `OUT` (default `live-check.png`). It reports problems but doesn't exit non-zero. |
| `speed.cjs` | Measures real seconds per game month at Slow, Normal and Fast. Optional `BASE_URL`. |
| `fast-to-2032.cjs` | Plays Festus at Fast speed in real time (no fast-forward) to a win or loss, answering cards automatically. Checks pacing and console errors over a full game. |
| `screenshots/shot-*.cjs` | Screenshot sets used in reports: `shot-offer` (offer card), `shot-alerts` (ticker and alert window), `shot-fund` (Festus Fund and projects), `shot-lab` (Research Lab, build menu, breakthrough card). Env: `OUT` (default `shots`), `PREFIX`, `BASE_URL`. |
| `make-brand-icons.cjs` | Builds the favicon and app icons in `assets/brand/` from a crop of the start art (the blue tower on Main Street). Rerun, and check the crop, after remaking the start art. |
| `make-og.cjs` | Builds the link preview, `assets/brand/og-1200x630.jpg`: the name and headline at the left, the start art on the right. |
| `make-start-art.cjs` | Renders the start screen's backdrop from the game (Festus in January 2026, interface hidden) into `assets/brand/start-wide.webp` and `start-phone.webp`. Rerun after the Festus map or the renderer changes. |

Example:

```
npm run build
NODE_PATH=/workspace/pw/node_modules OUT=shots node tools/screenshots/shot-lab.cjs
NODE_PATH=/workspace/pw/node_modules node tools/live-check.cjs https://aftersight-zeta.vercel.app/
```

The end-to-end tests are in `e2e/`; see [docs/README.md](../docs/README.md#tests).
