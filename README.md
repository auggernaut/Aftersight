# Afterlight (sim branch)

An agent-based simulation of a valley living through the singularity. About 40 residents in 16 households act on their own, each weighing four loyalties: **self, family, community, nation**. Energy, compute and robots are plentiful but never enough: appetite for all three grows faster than anyone can build. Every few in-game months a **discovery** changes the rules. You are one resident. The central question is the original game's: who ends up owning the economic engine?

It starts as an ordinary present-day American valley town at true relative scale (**1 tile = 5 m**; the map is 1200 × 900 tiles, 6 km × 4.5 km): an interstate with a diamond interchange, a parkway and River Road following the river, an old downtown on a tight irregular grid, a postwar grid on the west side, newer curving suburbs with cul-de-sacs (about 1,900 houses), apartment complexes, a strip and big-box corridor by the interchange with big parking lots, a hospital, a high school with fields, a logistics park with a Helix fulfillment center, a Helix data hall and substation fed by a transmission line, rail, farmland and woods on the valley walls, and the metro off the east edge. Then it changes, SimCity-style, as AI and robots spread. Nothing is scheduled: as robotaxis spread, parking lots and gas stations empty; as paid work shrinks, offices go dark; delivery robots thin out shops. Each emptying lot gets redeveloped by whoever owns it, according to their interests and what has been invented: solar canopies, robot depots, server rooms, community gardens, apartments, makerspaces, vertical farms. Outside capital bids for vacant land when it has a use for it. Rooftop solar spreads house by house when it pays, and cars on the streets give way to robotaxis.

The graphics are deliberately plain: flat tiles, colored blocks, dots for people and robots. This is a rules prototype, not final art. The cozy story build that came before lives in git history on `main` (commit `f81a611`).

## Scale

Footprints are real: a house is about 12 × 10 m (2.4 × 2 tiles) on a ~25 × 40 m lot; a big-box store 120 × 100 m (24 × 20 tiles) with a parking lot about as big; the Helix fulfillment center 300 × 150 m (60 × 30); the data hall 200 × 100 m (40 × 20); campus parcels for new data halls are 200 × 100 m; solar farm parcels on farmland are 300 × 250 m (7.5 ha each, and they sit side by side, so a few make tens of hectares). People get around at 3.5 km/h along the road network.

## Run it

- Open `dist/index.html` in a browser. No server, no network.
- Rebuild after editing: `node build.js` (concatenates `src/*.js`, inlines `vendor/yuka.min.js`, writes `dist/index.html`).
- Balance check without a browser: `node test/headless.js 3` (3 years, prints indicators every 60 days). `STRAT=coop node test/headless.js 3` runs a scripted cooperative player for comparison.
- Browser smoke test: `NODE_PATH=/path/to/playwright/node_modules OUT=shots node test/smoke.js` (about 3 years at speed, every player action, fails on any console error, saves screenshots).

## Controls

| | |
|---|---|
| Zoom | mouse wheel (region → town → one person), or the region / town / you buttons |
| Pan | drag |
| Inspect | click a person or a building |
| Speed | space pauses; 1–4 = 1 hour per 10 s, 1 day per 2 s, 1 month per 6 s, 1 year per ~15 s |
| Color people by | loyalty (dominant sphere), wellbeing, or stake (how much their household owns; this mode also tints every lot by owner) |
| Lot history | click any building or lot to see what it used to be and who owned it |

## What you can do

- **Propose a co-op** (solar, compute, robot fleet). Residents with a strong community loyalty and trust in you walk to the Town Hall to pledge.
- **Invest** in the open co-op, give to the commons fund, or buy a slice of a Helix stake.
- **Build** rooftop solar or order a robot for your own bay.
- **Call a council vote**: town buyout of Helix's in-town stakes, local right of first refusal on distressed share and land sales, community-first zoning (vacant lots go to co-ops and the town before outside capital; Helix can't buy land in town), or a higher commons dividend. Adults vote according to their loyalties and their trust in you.
- **Talk to a neighbor** (click them): nudge them toward community, the nation, or family. Their household hears about it; someone you win over to community becomes an advocate for a while and makes the case to the people they meet (who can become advocates in turn), and loyalties keep spreading as people spend time together at the plaza, café, volunteer sites and council meetings.
- **Share a stake**: give half of your biggest holding to someone's household.

The bar under every productive building shows its owners: magenta Helix (outside capital), blue town commons, green co-op, gold a single household.
