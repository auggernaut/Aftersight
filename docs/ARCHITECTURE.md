# Architecture

AfterSight = **the Micropolis engine** (unchanged in spirit) + **the AfterSight layer** (`src/afterlight/`) + **an isometric renderer and modern UI**. It is plain JavaScript and TypeScript bundled with webpack into a static site. There is no server and no framework; jQuery is used in the UI.

## 1. The engine: micropolisJS

`src/*.js|ts` is Graeme McCutcheon's micropolisJS, a port of Micropolis (the 1989 SimCity engine, open-sourced by EA). It simulates zoning, growth, traffic, power, land value, crime, pollution, fire and the budget on a 120x100 tile map. Tile values are 0–1023 (`src/tileValues.ts`), with flag bits on top (`src/tileFlags.ts`). The map scanner (`mapScanner.js`) visits zone-centre tiles and runs per-tile actions. A full census completes once per game month.

Core edits are small and marked with `Afterlight` or `Aftersight` comments:

| File | Hook |
|---|---|
| `simulation.js` | Creates `this.afterlight = new AfterlightLayer(...)`; calls `afterlight.monthly(simData)` each game month, `beginScan()` and `registerHandlers()`; saves and loads layer state; the start year is 2026; the speed thresholds (see Pacing) |
| `census.js` | `al*` counters filled by the layer's scanner handlers (`alDCCount`, `alLabOn`, `alClinicOn`, `alPowerDraw`, …) |
| `powerManager.js` | Adds `afterlight.extraPower(census)`: solar and fusion supply minus data center, depot, lab and clinic draw |
| `valves.js` | The automation jobs shock (`alJobFactor`) and Festus's demand-valve leak (`alValveLeak = 0.8`), which damps a 14-month boom-bust population cycle |
| `evaluation.js` | Automation joblessness and hope/backlash feed the engine's own approval and complaints |
| `gameTools.js` | AfterSight building tools (`dcHelix`, `dcCoop`, `lab`, `solar`, `depotHelix`, `depotCoop`, `clinic`, `fusion`) |
| `game.js` | Scenario setup (Festus, starter or empty); swaps in the iso canvas; panel, cards, alert window and UI; `window.__AL` test hooks; drops the engine's town/city/capital pop-ups; routes `AL_NEWS` messages to the ticker and newspaper |
| `notification.js` | The ticker takes free text plus a context object; a click calls `onOpen(detail)`, which opens the alert window |
| `budgetWindow.js` | Amounts go through `money()` from `afterlight/money.js`, so Festus shows real dollars |
| `animationManager.js` | Three industrial smoke animations no longer cycle into tiles 884–892 (the Research Lab's slot) |
| `zoneUtils.js`, `blockMapUtils.js`, `queryTool.js`, `inputStatus.js`, `micropolis.js` | Zone size for AfterSight tiles, data center light pollution, query names, iso drag picking, painting AfterSight art into the tile set |

## 2. The AfterSight layer: `src/afterlight/`

| File | Role |
|---|---|
| `layer.js` | `AfterlightLayer`: the state object `s` (everything saves with the game), the monthly update (compute, robots, automation, unemployment, Purpose/Backlash/Hope, policies, events, milestones), map scanner handlers, `news()`, `findSite()`, `placeBuilding()`, the discovery effects (`discover`). In Festus, automation is the regional tide, Purpose has its own formula, and the events are resident blockades and the Long Afternoon only. `installMayor()` mixes `mayor.js` into its prototype. |
| `mayor.js` | Everything the mayor decides (about 1,700 lines). Factions and approval, elections, Keystone offers and tiers, facility design, breakthroughs and the Research Lab, the automation tide, household income and paths, town hall asks (cards and the ticker lane), co-op bonds, the Festus Fund, town projects, status alerts, alert context and the card director. All tuning constants are at the top. |
| `money.js` | Money formatting. `money()` shows game dollars as real dollars in Festus (one game dollar is $1,000: `$200k`, `$1.5M`, `$20M`) and plain dollars elsewhere; `usd()` formats amounts already in real dollars (per-resident dividends and income); `moneyText()` rewrites tool tips. `setRealDollars()` is switched by the scenario (on start and on load). |
| `festus.js` | The Festus, MO map: seeded terrain, Mississippi, bluffs, I-55, Main Street, farm fields, the data center `SITE`, `HALL_SPOTS`, `PLANS` (370/520/700 acres, 2/4/6 halls) and map `LABELS` |
| `starterTown.js` | The present-day starter town (with one Helix data center, a robot depot, solar and a Research Lab) and `prewarm()` |
| `buildings.js` | Tile slots for AfterSight buildings: the seven unused 3x3 "church" slots (956–1018) plus the Research Lab at 884–892. Also `NAMES`, `isALTile`, `centreOf` and 2D pixel art for the legacy tile set. |
| `cards.js` | `CardWindow`: one modal for every decision card (offer, research, ask, campaign, project, intro). Shows rows, options, faction-reaction chips and the counter-ask picker. Rows flagged as key (a fourth element) lead; the rest fold under "All terms". |
| `alertModal.js` | `AlertWindow`: the detail window behind the ticker and River news. Shows the full text, "Why", "What you can do", faction values and changes, key numbers, "Show on map" and "Open City pulse". A town hall ask from the ticker is decided here (two answers with faction chips). Esc, X or a click outside closes it. |
| `panel.js` | `AfterlightPanel`: the City pulse panel. Festus leads with the mayor (approval, path chip, a waiting town hall ask, factions, goal, deal line, research line), household income with Purpose, the Festus Fund with the payout slider, town projects and River news; demand, mood, stats and policies sit under "More". Also refreshes the Compute section chip and the tool lock states (the co-op hall locks until a bond). |
| `ui.js` | `AfterlightUI`: top bar (date, funds in real dollars in Festus, population, approval, Purpose, and the household income mix in Festus or the engine's score elsewhere), speed buttons (`setSpeed`), rendered iso tool icons, tooltips, mobile sheet |
| `iso/isoCanvas.js` | `IsoCanvas`, a drop-in for micropolisJS's `GameCanvas` (same public methods). 2:1 dimetric picking, 6 zoom levels, pan, touch (`_bindTouch`), chunk-cached ground, cached building sprites, live animation (cars, smoke, LEDs, fires, protests). `classify()` maps zone-centre tile values to building kinds. |
| `iso/buildings.js`, `iso/ground.js`, `iso/art.js` | Procedural canvas art: buildings (including `dataCenter`, `depot`, `solar`, `fusion`, `clinic`, `lab`), terrain and roads, and drawing primitives. **No copied art.** |

Styles are in `css/afterlight-iso.css`. The phone layout is the media-query blocks: `(max-width: 760px), (max-height: 500px)`. Markup, including the toolbar, is in `index.html`.

### The monthly loop

`simulation.js` calls `layer.monthly(simData)` once a game month (4 city-time units, 64 sim frames). `monthly()` updates the economy and mood, then calls `mayorMonthly()`. That runs, in order: deal and ownership money → fund → projects → construction → faction targets and smoothing → approval → research and labs → city milestone → path → the scripted Festus events (April 2026 poll, December 2026 court ruling) → elections → developer → director (cards) → the ticker ask lane → alerts.

## 3. Festus systems (mayor.js)

### Factions, approval and elections

- **Five factions** (`FACTIONS`), each 0–100: Residents (weight 0.30), Farmers (0.12), Workers (0.22), Business (0.16) and Schools (0.20). Approval is their weighted sum.
- **How factions move.** Each month a faction moves 25% of the way toward a target computed in `_factionTargets()`. Targets depend on:
  - bills, water stress and noise
  - the NDA (secrecy), tax pain and joblessness (smoothed over about a year; in Festus a dividend that replaces lost wages takes up to half the sting out)
  - how fair the deal is (its tier), ownership's share of household income (capped), equity and clinics
  - gas fumes, river worry, Purpose and net worth
  - having said no: a bonus that fades over 42 months (`FREE_FADE`), and the home-grown plan (twice at most)
- **One-off decisions** add to a decaying memory (`bump()`, which keeps 90% a month).
- **No council.** The mayor decides everything; voters are the only check.
- **Elections** happen in April 2028, 2030 and 2032 (`ELECTIONS = [27, 51, 75]`, in months since January 2026). The vote is approval ±2. Under 50% is game over.
- **Winning:** win 3 elections, or win one while the town owns 25%+ of local compute (`WIN_SHARE`) and pays a dividend of at least $1,000 a resident a year (`MIN_DIVIDEND`, Festus). Election night names the town's path and its numbers, and the three-term headline says which town the mayor won in.
- **The campaign card.** In the 3 months before each vote a campaign card offers three choices: a town hall tour ($600, which boosts the two angriest factions), a property tax freeze, or running on your record.

### Keystone offers (Festus developer)

- **Tiers.** `TIERS[0..4]` are full term sets that get better for the town as they go up:
  - tax abatement %/years, PILOT, school fund, jobs, who pays utility upgrades, NDA
  - equity %, then in later tiers a wealth fund, kids' trust, compute royalty and one co-op hall
  - a facility design: `cooling` (evap/hybrid/closed) and `power` (grid/gas/clean)
- **The offer card** shows the terms plus acres, MW and water. You can **accept**, **reject**, or **counter** with 1–2 `ASKS`.
- **How a counter resolves.** Keystone answers 2–3 months later. The chance of a better offer (`p`) is `0.35 + 0.5·leverage − 0.12·(asks−1) − 0.08·hard`. Leverage rises with time, approval, past walk-aways, a power surplus and the frontier model breakthrough. A success applies the asks and goes up a tier if you asked for two things. A failure costs patience and brings a "take it or leave it" offer. Out of patience, Keystone walks.
- **Walking away.** Rejecting, or running out of patience, makes Keystone take its campus across the river (`devWalks`). The site goes back to hay. Keystone returns 8–12 months later a tier higher, asking for a bigger plan (`PLANS` 1–2: 520 then 700 acres, 4 then 6 halls). It also pays more of the upgrade bill and adds $200k of PILOT. After the third walk (`GONE_AFTER`) it builds across the river for good (`dev.status = 'gone'`).
- **After signing.** Halls go up over 4 months (`_construction`). Later expansion offers add 2 halls a tier better. A bad deal (tier 1 or lower) can be reopened through a residents' ask, which always gets a card; accepting a re-signed deal moves factions by what changed, and a published agreement stays public. The December 2026 court ruling can void an NDA deal, which forces a public re-sign.
- **Facility design** (`COOLING`, `POWER`, the `cooling`/`clean`/`gas` asks):
  - Closed-loop cooling uses about 10% of evaporative water but takes about $250/yr off other benefits.
  - Clean power takes about $150/yr off and carries only 30% of the campus load on the grid.
  - Gas adds $150/yr PILOT and takes the campus off the grid, but its fumes cut Residents and Schools.
  - Grid power raises everyone's bills (Ameren).
  - Water use is measured against the Jefferson County Water Authority's collector wells on the Mississippi (`s.water`). The authority adds capacity for each hall (`WELL_UPGRADE`).
  - `_dealTier()` counts design money as effective PILOT, so trading cash for a cleaner design doesn't count as a worse deal.

### The automation tide (Festus)

`tideTarget()` sets the share of the region's work that machines do: 3% at the start, rising by 30 points between months 12 and 72 and 10 more by month 120, plus a bump for each breakthrough that exists anywhere (`TIDE.bumps`: frontier model and self-building robots +10 each, cheap solar +2, fusion +3). A breakthrough counts when the town finishes it, when it passes (someone else deploys it), or when the world reaches it on its own (frontier model by month 36, robots by month 54). `s.tide` moves 15% a month toward the target, and `s.automation = 1 − (1 − tide)(1 − local)`, where `local` comes only from the town's own robot depots. Hosting compute no longer automates the town; it is the same tide with or without a campus. The starter town keeps the original local model.

### Household income and paths (Festus)

- **`incomeMix()`** gives each resident's yearly income in real dollars: wages (`WAGE` $31,500 × employment), ownership (the Fund's last dividend per resident) and transfers (`TRANSFER` $11,000 × unemployment), plus `ownShare` and `cover` (dividends as a share of the wages lost to automation). It feeds factions, Purpose, the top bar and City pulse.
- **`pathNow()`** names the path from income mix, Purpose and strain: `owners` (ownership 8%+ of income and Purpose 45+), `strain` (a deal plus water over 95%, bills over 0.3 or gas fumes), `decline` (no deal, a walk, and almost no stake), `checks` (Purpose under 40), `building` (ownership 4%+ of income or a fifth of local compute), `enclosure` (a deal and little stake), `early`. A new path counts after three months and is news (`_pathMonthly`, at most every 6 months). `PATHS` holds the names and one-line descriptions; `pathLine()` writes the sentence used on election night and in the alert window.

### Breakthroughs and the Research Lab

- **Five breakthroughs** in order (`RESEARCH`, `RESEARCH_ORDER`): perovskite solar, frontier model, self-building robot lines, the Cure, compact fusion. Each card shows a dollar cost and a compute need over N months.
- **Paying for compute.** Compute comes from `researchCompute()`: the town's own compute (co-op halls, equity share of the campus, royalty) minus what labs use. The rest is bought at `computePrice()`, which is $3/unit plus dependence.
- **Pass or invest.** Passing hands the breakthrough to someone else, with a faction penalty, and some passes raise dependence. Finishing calls `discover()`, which may unlock a building. That building still has to be placed, paid for and kept up: the clinic costs $1,200 plus $15/mo, the fusion plant $8,000 plus $40/mo.
- **The Research Lab** (`lab` tool, $1,500, 3x3, needs power). Each lab costs $10/mo upkeep and uses 10 town compute a month (bought at market price if the town lacks it).
  - **Cards need a running lab.** Breakthrough cards appear **only while a lab runs**, on a lab clock (`R.clock` vs `R.next`, counted in lab-months).
  - **Clock speed** per month is `labSpeed()`: 1 for one lab, +0.5 per extra lab (two extra at most), and up to +1 more from town compute (`/150`).
  - **Timing.** The first breakthrough comes 5 lab-months in (Festus). After a finish the next is 5 lab-months later; after a pass, 7.
  - **With no lab** there is one news hint, and active research pauses. A lab the town can't pay for goes dark.

### Festus Fund, co-op bonds, Purpose and projects

- **What a hall earns.** `hallValue()` is `HALL_VALUE` ($1,500 game = $1.5M a month) per hall, tripled after a frontier model. Property tax (`HALL_TAX`, less any abatement) still goes to the city budget.
- **Festus Fund** (`_dealMoney`, `_fundMonthly`). Keystone's PILOT, the town's equity share of Keystone's halls, all of the deal's co-op hall and 35% of each bonded hall (`BOND_SHARE` 0.65 services the bond) flow into the fund, not the budget (`s.fundParts`, `fundSources()`). The fund grows 0.4% a month. Each January it pays out `0.04 + 0.36·slider` of itself (the Reinvest↔Pay out slider in the panel) as a per-resident dividend (`DOLLARS` = $1,000 per game dollar). Dividends add to per-resident **net worth**, which feeds Residents.
- **Co-op bonds.** The `coop_bond` ask (from month 30 or after a frontier model, with a deal or a walk behind it) and the second home-grown plan each add a bond, two at most (`MAX_BONDS`). Each bond lets the player build one town-owned data center (`dcCoop`, $4M down); `bondPermits()` and `isUnlocked('dcCoop')` enforce it. Bonded halls employ a few people.
- **Purpose** (`layer.js` monthly, Festus formula): 70 − unemployment × 90 × sting − automation × 15 + guild 6 + project boost + ownership share of income × 40 + clinics × 2 − slump 8 − Cure 6 − 6 with no campus after a walk (+2 per home-grown plan). The sting is `(1 − 0.6·cover)`, and × 0.6 with the apprenticeship guild. It moves 15% a month toward the target, is shown in the top bar and City pulse, and feeds approval (`purp = (purpose − 60)/10`, clamped).
- **The apprenticeship guild** is the `purposeProgram` policy, reached in Festus through the `guild` ask. It costs `guildCost()` a month.
- **Projects** (`PROJECTS`, `PROJECT_ORDER`): garden, murals, market hall, tool library, youth league, riverfront park, observatory and The Lantern (needs abundance 55%+). They earn nothing. Cost = `base × ((1−labor) + labor × (1 − 0.9·abundance))`, where `abundance()` = 0.12 per discovery + 0.5·automation + 0.4·town share (max 0.9).
  - **Robots only:** cheaper and faster, Purpose ×0.6. **Neighbors + robots:** 15% dearer, takes longer, Purpose ×1.5.
  - The Purpose boost fades over 24 months to a 30% floor. Once it is down to 60% (`RENEW_AT`), a new season costs 30% of the build (`RENEW_COST`) and restores it.
  - An opened project is placed on the map (`_placeProject`: trees and a fountain on clear land near Main Street, the river or the bluffs, never on fields or the campus parcels).
  - Residents suggest a project when Purpose is under 65, and a new season when nothing new is affordable.

### Cards, pacing and alerts

- **The director** (`_director`) shows at most one decision card every `CARD_GAP` = 6 game months, never two at once. A furious faction (under 30) gets an ask first. Then come a due breakthrough (needs a lab), reopening a bad deal (asks with `card: true`), a project suggestion, or Keystone returning early. In Festus an ordinary ask only gets a card after a long quiet spell.
- **The ticker ask lane** (`_quickAskLane`, Festus). Every `QUICK_GAP` = 5 months the unhappiest faction's ready ask goes to the ticker as `s.quickAsk`, with its stakes scaled by `QUICK_SCALE` = 0.5. It doesn't pause the game or use a card slot. The mayor decides it in the alert window or from the Town hall line in City pulse (`decideQuick`); left alone for `QUICK_EXPIRE` = 3 months it lapses and can come back after 15. `decide()` routes to it when no card is open, so autoplayers and tests use the same call.
- **Offers and campaigns** come from `_developer` and `_elections` and share the gap.
- **Status alerts** (`_alerts`) are short ticker notes about health, jobs, household wealth, water, bills and mood. There is at most one per topic per year, at least 4 months apart, and never in a card month. Big stories open as a newspaper page.
- **The alert window.** Every `news()` item carries a `ctx` from `newsContext()`: the topic, a "why" line (including that month's decision), a "what you can do" line (`LEVERS`, Festus), faction values and changes, and key numbers (including household income and the path). `AlertWindow` shows it. The sim pauses while it is open (`game.dialogOpen`).
- **The city milestone** "Festus is now a city" fires once, after 6 months above 13,000 people. The badge never goes back to TOWN.

### Pacing and speeds

A game month is 64 sim frames. Frame thresholds are in `simulation.js` `_simFrame`:

| Speed | Threshold | Measured time per month |
|---|---|---|
| Slow | 310 ms | ~20–22 s |
| Normal (default) | 185 ms | ~12 s |
| Fast | 45 ms | ~3.5 s |

At Fast, the whole game (January 2026 to the April 2032 election) takes about 4.6 minutes. Cards and timers count game months, so they scale with speed.

### Build menu

The bottom toolbar (in `index.html`) has these groups: Inspect, Transport, Zones, Services, Power (coal, nuclear, solar), **Compute** (Keystone/Helix hall, co-op data center, Research Lab), and **AfterSight** (Helix and co-op robot depots, clinic, fusion). The Compute group label (`#alComputeChip`) shows the town's compute a month and its equity share. Locked tools show a padlock until their breakthrough; in Festus the co-op data center stays locked until voters back a bond. In Festus, tool tips show real dollars. On phones the strip scrolls sideways and both new sections show a label tile. On desktops narrower than 1,360px the buttons shrink and the strip scrolls.

## 4. Other scenarios

- **Starter town** (`scenario: 'starter'`): an ordinary 2026 town, grown for 3 hidden years. Helix is the developer, and its expansion is a policy. This is the original Afterlight layer: policies (let Helix build, citizen dividend, community-first zoning, purpose programs), protests, riots, strikes, a "Long Afternoon" slump, and abundance milestones.
- **Empty valley** (`scenario: 'empty'`): classic Micropolis, starting from bare land.

## 5. Data and assets

- `assets/brand/`: poster, aSi mark, icons, manifest and the Festus thumbnail. `images/` and `sprites/` are upstream.
- Festus map data is code (`festus.js`), not a data file.
- The game saves to localStorage, with layer state under `saveData.afterlight`.

## 6. Tests and the balance harness

`e2e/*.cjs` (Playwright, run against `dist/`) and `tools/` are described in [README.md](README.md#tests).

`e2e/balance.cjs` plays N headless Festus games per offer strategy with `fastForward`. Every strategy:

- builds one Research Lab early, away from the campus parcels
- invests in breakthroughs when funds are over $2,500
- funds projects when it can afford them
- says yes to affordable asks, on cards and in the ticker
- builds a town-owned data center whenever voters have backed a bond and there's money and power for it

The strategies differ only in how they answer offers:

- **negotiate:** holds out for closed-loop cooling and clean power, and takes a good firm offer
- **firm:** counters, then takes the firm offer
- **yes:** accepts everything
- **no:** rejects everything

It prints win rates, the gaps between cards (ticker asks excluded), and where each town stands in April 2032: unemployment, Purpose, ownership's share of household income, the dividend and the path. A mayor who loses keeps watching as a citizen, so every town is measured. Recent results at N=30 (the automation tide, October 2026): negotiate 30, firm 15, yes 15, no 11. In April 2032 negotiating towns are building a stake or thriving owners (8% of income from ownership, about $2,200 a resident a year), firm and yes towns are mostly rich few (2–3%), and no-deal towns are building a small stake of their own through bonds. Expect ±3 noise between runs; the yes strategy turns on whether it survives the 2028 vote, which depends on a reopened deal and the court ruling.

Before the tide (old model, for comparison): negotiate about 24, firm 7–10, yes 8–12, no 10–12, with winning negotiators at about 48% unemployment and Purpose 18 by 2032.

## 7. Deploy

`tools/deploy/aftersight-redeploy.sh` builds and deploys to Vercel with noindex (see [README.md](README.md#deploying)). **Only with Augustin's OK.**
