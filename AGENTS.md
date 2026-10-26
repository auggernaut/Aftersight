# Agent instructions

## Project record

This repo is part of the **Afterlight** project. Its central status record is `projects/afterlight.md` in [auggernaut/mind-dump](https://github.com/auggernaut/mind-dump/blob/main/projects/afterlight.md).

Whenever you make meaningful changes here (features, fixes, releases, decisions, status changes), also update that file in mind-dump: refresh "Where things stand", focus areas, and open questions as needed, bump the `_Last updated_` date, and add a dated one-line entry to its Log. Keep entries short and factual. If you can't push to mind-dump, say so in your final report so a human can update it.

## micropolis branch

- This branch is a modified micropolisJS (GPL-3.0 + additional terms + Micropolis Public Name License). Keep LICENSE, COPYING, MicropolisPublicNameLicense.md, name_license.html, the file headers and the footer attribution intact. Never call it SimCity.
- Afterlight code lives in `src/afterlight/`; hooks into the core are small and marked with "Afterlight" comments (simulation.js, census.js, powerManager.js, valves.js, evaluation.js, gameTools.js, game.js, gameCanvas.js, notification.js, queryTool.js, micropolis.js).
- On `micropolis-iso`, `src/afterlight/iso/isoCanvas.js` replaces GameCanvas (keep its public methods in step with what game.js, inputStatus.js and notification.js call), `src/afterlight/ui.js` + `css/afterlight-iso.css` are the interface. All art is procedural canvas drawing; don't add copyrighted city-builder art. After visual changes, run e2e/smoke.cjs and look at the screenshots.
- Build with `npm run build` (output in `dist/`, git-ignored). Smoke test: `NODE_PATH=<playwright>/node_modules OUT=shots node e2e/smoke.cjs`.
