# Afterlight (sim branch)

An agent-based simulation of a valley living through the singularity. About 40 residents in 16 households act on their own, each weighing four loyalties: **self, family, community, nation**. Energy, compute and robots are plentiful but never enough: appetite for all three grows faster than anyone can build. Every few in-game months a **discovery** changes the rules. You are one resident. The central question is the original game's: who ends up owning the economic engine?

It starts as an ordinary present-day American valley town: rows of houses, shops, offices, parking lots, gas stations, a car dealership, motels, a warehouse, a machine shop, farms, and one Helix data center out by the highway. Then it changes, SimCity-style, as AI and robots spread. Nothing is scheduled: as robotaxis spread, parking lots and gas stations empty; as paid work shrinks, offices go dark; delivery robots thin out shops. Each emptying lot gets redeveloped by whoever owns it, according to their interests and what has been invented: solar canopies, robot depots, server rooms, community gardens, apartments, makerspaces, vertical farms. Outside capital bids for vacant land when it has a use for it. Rooftop solar spreads house by house when it pays, and cars on the streets give way to robotaxis.

The graphics are deliberately plain: flat tiles, colored blocks, dots for people and robots. This is a rules prototype, not final art. The cozy story build that came before lives in git history on `main` (commit `f81a611`).

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
| Speed | space pauses; 1–4 = 1 hour per 2.5 s, 1 day per 2 s, 1 month per 6 s, 1 year per ~15 s |
| Color people by | loyalty (dominant sphere), wellbeing, or stake (how much their household owns; this mode also tints every lot by owner) |
| Lot history | click any building or lot to see what it used to be and who owned it |

## What you can do

- **Propose a co-op** (solar, compute, robot fleet). Residents with a strong community loyalty and trust in you walk to the Town Hall to pledge.
- **Invest** in the open co-op, give to the commons fund, or buy a slice of a Helix stake.
- **Build** rooftop solar or order a robot for your own bay.
- **Call a council vote**: town buyout of Helix's in-town stakes, local right of first refusal on distressed share sales, or a higher commons dividend. Adults vote according to their loyalties and their trust in you.
- **Talk to a neighbor** (click them): nudge them toward community, the nation, or family. Their household hears about it, and loyalties keep spreading as people spend time together at the plaza, café, volunteer sites and council meetings.
- **Share a stake**: give half of your biggest holding to someone's household.

The bar under every productive building shows its owners: magenta Helix (outside capital), blue town commons, green co-op, gold a single household.
