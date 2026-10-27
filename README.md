# AfterSight

AfterSight is a city-builder sim about living through the arrival of AI, robots and abundance. You are the mayor of a real, contested town in 2026, and a developer wants a $6B AI data center campus there. Your choices decide **who owns the engine** (compute, robots, energy) and whether the town ends up thriving, enclosed, idle, strained or shrinking.

- **Play:** https://aftersight-zeta.vercel.app (unlisted, noindex)
- **Start here:** [docs/README.md](docs/README.md) (run, test, deploy, branch map), [AGENTS.md](AGENTS.md) for AI agents
- **Docs:** [Vision](docs/VISION.md) · [Architecture](docs/ARCHITECTURE.md) · [Decisions](docs/DECISIONS.md) · [Ideas](docs/IDEAS.md) · [Open questions](docs/OPEN_QUESTIONS.md) · [Research](docs/RESEARCH.md)

It is built on **[micropolisJS](https://github.com/graememcc/micropolisJS)**, Graeme McCutcheon's HTML5 port of Micropolis, the open-source release of the 1989 SimCity engine. AfterSight is a **modified version** of micropolisJS. It is not SimCity and is not affiliated with Electronic Arts. The upstream README is kept as [README.micropolisJS.md](README.micropolisJS.md). `main` is the game and the working branch; earlier versions live on `micropolis-iso`, `micropolis`, `sim` and `legacy/story-game`.

## Quick start

```
npm install
npm run build                                            # webpack -> dist/
npm run dev                                              # or serve dist/ and open index.html
NODE_PATH=<playwright>/node_modules OUT=shots node e2e/festus.cjs   # main end-to-end test
```

More tests and tools: [docs/README.md](docs/README.md#tests) and [tools/README.md](tools/README.md).

## License

micropolisJS is GPL-3.0 with additional terms (see [LICENSE](LICENSE) and [COPYING](COPYING)); the name "Micropolis" is covered by the [Micropolis Public Name License](MicropolisPublicNameLicense.md). Everything in this branch, including the Afterlight layer, is therefore GPL-3.0: a released version must ship its source under the same terms. The repo itself is private, which the GPL allows.

## Festus, Missouri (2026)

The main scenario, picked from the splash ("Play Festus, MO") or the new-game Town list. A river town on the Mississippi with I-55, a Main Street and farmland, and an empty site by the interstate that a fictional developer, Keystone Compute Partners, wants for a $6B data center campus. You are the mayor:

- **Approval** (top bar) is a weighted mix of five factions: residents, farmers, workers, business and schools. They react to power bills, water, noise, taxes, jobs, school money and secrecy.
- **The automation tide.** Machines take a growing share of the region's work every year, campus or no campus, and each breakthrough pushes it further whoever makes it. What the town owns decides whether dividends replace the lost wages.
- **Household income** (top bar and City pulse) is wages, ownership (the Festus Fund's dividend) and transfers. City pulse also names the town's **path**: building a stake, thriving owners, rich few, checks without purpose, boom and strain, or no deal and decline.
- **Elections** in April 2028, 2030 and 2032. Under 50% and the voters oust you. Win three, or win one with the town owning 25%+ of the compute it hosts and paying a dividend of $1,000+ a resident a year. Election night names the path.
- **Offers** come as cards that lead with the money to the town, jobs, water and power (the rest under "All terms"): accept, reject, or counter with one or two asks. Keystone answers months later with better terms, a firm "take it or leave it", or walks to a neighboring town and comes back later with a better tier; after the third walk it builds across the river for good. Later tiers add equity, a kids' trust, compute royalties and a town AI co-op hall.
- **Breakthroughs** are decisions, and they only come while a **Research Lab** runs: each card shows the cost in dollars and compute. Compute comes from the town's equity in the data centers; the rest is bought on the market. Finished research unlocks a building (Healing Clinic, Fusion Plant) that you then place, pay for and keep up. Passing hands it to someone else.
- **Festus Fund and Purpose.** Keystone's payments, the town's equity share of what the halls earn ($1.5M a hall a month, three times that after a frontier model), the deal's co-op hall and any town-owned halls go into a fund that pays every resident a dividend each January (payout slider in City pulse). Purpose (top bar) drains as machines take the work and rises with ownership, the apprenticeship guild and town projects built by robots or by neighbors with robots. Eight projects, from a garden to The Lantern, show up on the map and can get another season when they fade.
- **Co-op bonds.** When voters back a bond, the town can build a data center of its own from the Compute menu; its revenue pays the bond first and the rest goes to the Fund.
- **Alerts.** The news ticker carries short status alerts (health, jobs, wealth, water, bills, mood, path); click one for why it happened, what you can do, faction changes and the numbers.
- Between those, factions come to City Hall with asks (a sound wall, a water guarantee, local hiring, publishing the deal, a tax cut, a school levy, spending the surplus, growing the town without a campus, an apprenticeship guild, a co-op bond, new river wells). Everyday asks wait in the ticker and don't stop the game; reopening a bad deal and a furious faction get a card. A declined ask comes back louder; the yearly ones repeat. Each election opens with a campaign choice.
- Money is shown in real dollars: one game dollar is $1,000.
- Pacing: at most one decision card every 6 game months (about 70 s at Normal speed), unless it answers something you just did. All four offer strategies can win; negotiating wins most (see `e2e/balance.cjs`).

Code: `src/afterlight/festus.js` (map), `src/afterlight/mayor.js` (factions, offers, research, elections, pacing), `src/afterlight/cards.js` (decision card UI). Hooks for tests: `__AL.mayor()`, `__AL.card()`, `__AL.decide(option, asks)`, `__AL.quickAsk()`, `__AL.decideQuick(option)`, `__AL.income()`, `__AL.path()`, `__AL.force('Counter'|'Court'|'Vote', v)`, `__AL.election(i, vote)`, `__AL.bump(deltas)`.

## The starter town (original Afterlight layer)

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
