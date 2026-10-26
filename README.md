# Afterlight (micropolis branch)

Afterlight is a city builder about living through the singularity: a present-day town meets AI, robots and abundance. The central question is still who owns the economic engine (energy, compute, robots), and what that does to jobs, purpose and peace.

This branch is built on **[micropolisJS](https://github.com/graememcc/micropolisJS)**, Graeme McCutcheon's HTML5 port of Micropolis, the open-source release of the 1989 SimCity engine. Afterlight is a **modified version** of micropolisJS. It is not SimCity and is not affiliated with Electronic Arts. The upstream README is kept as [README.micropolisJS.md](README.micropolisJS.md).

Other branches: `sim` holds the earlier agent-based valley sim (Yuka agents); `main` holds the retired cozy story build.

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

The smoke test starts a game, builds co-op buildings, passes policies through the UI, fast-forwards four years, checks that at least one negative and one positive event fire, forces a protest, a riot and a discovery page for screenshots, builds a fusion plant and checks the save includes Afterlight state. In the browser, `window.__AL` exposes test hooks (`fastForward(months)`, `discover(id)`, `protest()`, `riot()`, `strike()`, `state()`).
