# Aftersight (micropolis-iso branch)

Aftersight (formerly Afterlight) is a city builder about living through the singularity: a present-day town meets AI, robots and abundance. The central question is still who owns the economic engine (energy, compute, robots), and what that does to jobs, purpose and peace.

This branch is built on **[micropolisJS](https://github.com/graememcc/micropolisJS)**, Graeme McCutcheon's HTML5 port of Micropolis, the open-source release of the 1989 SimCity engine. Aftersight is a **modified version** of micropolisJS. It is not SimCity and is not affiliated with Electronic Arts. The upstream README is kept as [README.micropolisJS.md](README.micropolisJS.md).

This branch (`micropolis-iso`) keeps the Micropolis engine and the Afterlight layer from `micropolis` and replaces the presentation: an isometric city view and a modern interface (see below). Other branches: `micropolis` has the same game with the original 1989 top-down tiles; `sim` holds the earlier agent-based valley sim (Yuka agents); `main` holds the retired cozy story build.

## License

micropolisJS is GPL-3.0 with additional terms (see [LICENSE](LICENSE) and [COPYING](COPYING)); the name "Micropolis" is covered by the [Micropolis Public Name License](MicropolisPublicNameLicense.md). Everything in this branch, including the Afterlight layer, is therefore GPL-3.0: a released version must ship its source under the same terms. The repo itself is private, which the GPL allows.

## What Afterlight adds

The Micropolis core (zoning, growth, traffic, power, land value, crime, pollution, fire, budget) is untouched in spirit; the Afterlight layer lives in `src/afterlight/` and reads the census once a game month.

- **A 2026 starter town.** New games (with the default checkbox) open on an ordinary small town: homes, shops, a factory district, a coal plant and two small solar farms, police, fire, one Helix data center and one Helix robot warehouse. It is grown for three hidden years so you start in Jan 2026 with a lived-in town.
- **Compute and robots alongside power.** New 3x3 buildings: Helix Data Center ($100, Helix owns it), Co-op Data Center ($4000, the town owns it), Helix / Co-op Robot Depot, Solar Farm, and two discovery-locked buildings, Healing Clinic and Fusion Plant. Data centers pull a lot of power (150 units, 300 after the frontier-model discovery) and make compute; depots house robots, which run on compute. Art is new pixel art painted into seven tile slots that Micropolis reserved for churches but never used.
- **Jobs shock.** Robots and compute take over a growing share of the jobs in commercial and industrial zones. Unemployment climbs while output keeps growing; this feeds Micropolis's own demand valves, so people leave town unless a citizen dividend replaces lost wages.
- **Mood.** Unemployment, Purpose, Backlash and Hope are shown in the Afterlight panel and feed the mayor's approval and the evaluation's unemployment complaint.
- **Ownership policies.** Let Helix build (Helix expands on its own every few months when allowed), Citizen dividend (20% of Helix automation income plus half of co-op profits go to residents), Community-first zoning (every Helix site gives the town a 25% stake; Helix builds half as often), Purpose programs (costs money monthly). Who owns compute and robots changes backlash, hope, purpose and how much money stays in town.
- **Events.** Negative: data center protest (a blockade that stops the data center; drawn as a protest ring on the map), riots (fires that Micropolis's fire code then spreads), general strike (robot output halts, shops and factories stall), and "The Long Afternoon" purposelessness slump (people move away). Positive discoveries arrive about once a year, each helping and straining: cheap solar, a frontier AI model, robots that build robots, the Cure (unlocks clinics, triggers a housing crunch), fusion (unlocks the fusion plant). Abundance milestones: "Basics are free" and "Post-scarcity". Big stories open as a page of The Valley Ledger.

## The isometric look

The map is drawn as a 2:1 dimetric city in the spirit of late-90s isometric city builders, all procedurally in canvas code (no copied art). Code is in `src/afterlight/iso/`:

- `isoCanvas.js` is a drop-in for micropolisJS's `GameCanvas` (same methods, so tools, bulldozer, query and notifications work unchanged). It does screen-to-tile picking, eased zoom (6 levels, wheel or pinch, anchored at the cursor), drag to pan (left-drag with no tool, right/middle-drag always, arrow keys), and painter's-order drawing. Ground is cached in 16x16-tile chunks per zoom level and only repainted when tiles change shape (traffic doesn't count); buildings are cached sprites plus shadow sprites per kind, variant and zoom; everything is culled to the view. Cars on busy roads, smoke, data center LEDs, fires, the protest camp and robots in depot yards are drawn live each frame.
- `ground.js` paints terrain: grass with soft noise, water with shallows and sand shores, woods, roads with sidewalks and lane marks that connect to their neighbours, bridges, rail, power pylons with sagging wires, rubble and zoned lots.
- `buildings.js` paints the buildings as extruded, lit boxes: houses with gable or hip roofs, townhouses to residential towers, shops to glass skyscrapers, sawtooth factories with stacks and tanks, coal and nuclear plants, civic buildings, and the Afterlight buildings (data centers in owner colour, robot depots, solar arrays, fusion torus, clinic). Height and style follow zone density and land value.
- `art.js` holds the primitives (projector, lit boxes, roofs, cylinders, trees, shadows).

The interface (`src/afterlight/ui.js`, `css/afterlight-iso.css`) is a top bar (city, date, funds, population, score, speed), a bottom toolbar with rendered iso icons and tooltips, the City pulse panel (RCI demand, mood, stats, policies, Valley news), restyled dialogs, a Valley Ledger page with a photo of the scene, and an About panel plus a footer with the micropolisJS credits and licenses. The engine's simulation code is not changed; the only core edits are small hooks (a drag-picking hook in `inputStatus.js`, the canvas swap in `game.js`).

## Build and run

```
npm install
npm run build          # webpack -> dist/
npx webpack serve      # or serve dist/ with any static server and open index.html
```

## Tests

```
NODE_PATH=/path/to/playwright/node_modules OUT=shots node e2e/smoke.cjs     # ~4 game years, fails on console errors
NODE_PATH=/path/to/playwright/node_modules RUNS=3 node e2e/compare.cjs      # hands-off vs community ownership
npm test                                                                     # upstream jest unit tests
```

The smoke test starts a game and plays it through the iso interface: it picks tools from the toolbar and clicks or drags on iso tiles to build a solar farm, a co-op data center, a co-op depot and a road, bulldozes and queries, zooms with the wheel, pans, uses the speed buttons and opens the About panel. It then passes policies through the panel, fast-forwards four years, checks that at least one negative and one positive event fire, forces a protest, a riot and a discovery page for screenshots, builds a fusion plant and checks the save includes Afterlight state. In the browser, `window.__AL` exposes test hooks (`fastForward(months)`, `discover(id)`, `protest()`, `riot()`, `strike()`, `state()`).
