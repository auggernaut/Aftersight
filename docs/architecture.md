# How the sim is organized

Plain JavaScript drawing to one Canvas 2D element, plus HTML panels. `node build.js` concatenates `src/*.js` in name order inside one strict-mode function, inlines `vendor/yuka.min.js` (Yuka 0.7.8, MIT) in its own script tag, and writes `dist/index.html`. Every top-level name is shared across files; the numeric prefixes set load order. Files `01`–`08` never touch the DOM, so `test/headless.js` can run the whole simulation in Node.

| File | What it holds |
|---|---|
| `01_util.js` | Seeded RNG, formatting, Gini, calendar (30-day months, 360-day years), loyalty colors. |
| `02_rules.js` | `baseParams()` (every tunable number) and `DISCOVERIES` (tiers 1–4, then generated "generation N" discoveries forever). |
| `03_world.js` | The valley at 5 m per tile, 1200 × 900 tiles: terrain and river, road polylines by class (interstate, ramps, arterials, collectors, downtown, local), rail and transmission lines, an occupancy grid used to place downtown lots, the strip, the logistics park, the data campus, civic sites and suburbs (warped postwar grid plus curving pods with cul-de-sacs), houses along residential streets, parcels for big builds. `buildRoadGraph` splits roads where they meet (the interstate only connects through its ramps) into a `YUKA.Graph`; `route()` runs `YUKA.AStar` with a path cache. |
| `04_economy.js` | State `S`, ownership shares, the daily market (`econDay`), monthly appetite growth, investment by Helix / households / the town, distress sales, co-op drives, metrics and history. |
| `04b_land.js` | Land use: lot uses and owners, how viable each present-day use stays (`landSignals`: robotaxi share, paid work vs. year 1, retail), redevelopment by owner, rooftop solar spread, eras. |
| `05_agents.js` | Yuka-based agents: movement (`Vehicle` + `FollowPathBehavior`), goals (`ActivityGoal` = move then dwell), the goal evaluators, and the visible robot workers. |
| `06_mind.js` | The Mind seam for a future local model (see below), plus template dialogue. |
| `07_sim.js` | `newWorld(seed)`, the fixed-step `simStep(dt)`, day rollover, discoveries. |
| `08_player.js` | Player actions and council votes. |
| `09_render.js` | Camera; a cached static layer (terrain, roads, rail, power, houses) baked at 2 px per tile and re-baked at most every 3 s when rooftops change; live vector roads and house detail up close; culled lots and sites; cars on the road graph; labels queued by priority with overlap rejection (big sites once they cover enough screen, small ones only up close or when selected). |
| `10_ui.js` | Indicators, happenings feed, inspector, action menus, chart, discovery banner. |
| `11_main.js` | Main loop, speeds, input, and `window.__SIM` test hooks. |

## Time

Agents run in hours, the economy in days. One step is 0.002 h at 1x (Yuka steering through the route's waypoints), 0.05–0.5 h at higher speeds (agents walk the same road path kinematically so they don't overshoot corners). Steering is used whenever a step moves an agent 1.5 tiles or less. The economy ticks once per day at midnight; appetite grows monthly; history is sampled weekly.

## Decisions (Yuka)

Each resident owns an `AgentBrain` (a `YUKA.Think`) with goal evaluators: sleep, work, family, social, volunteer, civic (national service), learn (retrain), pledge (to a co-op), council, propose (start a co-op), school and play. Each evaluator returns a desirability from the situation (time of day, household savings, job openness, open co-ops, construction in town, automation level) and is multiplied by a **character bias computed from that agent's loyalties**. For example work's bias is `0.35 + 0.9·self + 0.9·family`, volunteer's is `0.12 + 1.7·community`, civic's is `0.12 + 1.7·nation`. `arbitrate()` runs about hourly; the top four scores are kept so the inspector can show why someone is doing what they're doing.

Loyalties drift: people dwelling at the same place nudge each other toward the average (3% per encounter), and trust in the player spreads the same way.

## The Mind seam (for Muse Glimmer or another local model)

`Mind.use(provider)` installs a provider with optional `choose(agent, scored, snapshot)` (return a goal kind to override Yuka's pick) and `say(agent, topic, ctx, snapshot)` (return a line). `snapshot(agent)` is the plain-data view a prompt would get: loyalties, needs, household and stakes, job, memory, and world state. Providers must answer synchronously from a cache and do any model work in the background; the sim never waits.

## Economy in one paragraph

Solar makes energy (yield × season); homes, racks, robots and the factory consume it; shortfalls are partly imported from the national grid at a high price, and prices follow demand/supply. Powered racks make compute; locally owned racks serve local demand first, Helix sells to whoever pays, including an outside appetite that grows 7% a month. Robots need energy and compute and do the automatable share of the town's work; spare robot hours are sold outside at a falling price. Humans get the remaining hours at a wage. Every asset pays its profit to its shareholders. The town taxes resident income and Helix's local profits and pays most of it out as a per-person dividend, investing the rest in commons assets. Households with savings invest according to their loyalties (co-op, commons, best-paying stake, national bonds that speed research, or keep a family buffer); households that run out of cash sell stakes, to Helix by default or to the town under right of first refusal.

## Land use (the SimCity layer)

The world builder lays out the present-day town lot by lot: downtown frontages 15–30 m wide, strip malls, gas stations, a dealership, a motel, offices, big boxes and their parking lots, apartment blocks and warehouses. Each lot has a use and an owner: Helix, the town, one of the simulated households, an unsimulated local owner, a co-op, or (for houses) the unsimulated neighbors. Monthly, each lot's occupancy drifts toward how viable its use still is: parking and gas follow the share of trips still taken in private cars, offices follow paid human work relative to year 1, shops follow retail after delivery robots. Lots that are mostly empty get redeveloped by their owner. Helix builds whatever earns most; the town builds commons solar or compute when it can afford it; a household chooses by its loyalties (self: best-paying asset, community: garden, family: apartments, nation: makerspace); unsimulated owners repurpose along the lines of the old use (parking or gas to solar canopy, warehouse to robot depot, office to compute) or by the town's mood. A lot holds capacity in proportion to its area (`CAP_PER_TILE`), and owners build the phase they can afford. Outside capital bids for vacant land when it has a profitable use for it; under right of first refusal or community-first zoning the town buys instead, and under zoning Helix can't buy in town at all, so its new builds go to its own parcels by the highway. Big new builds go where they would in a real valley: data halls on the campus by the substation, depots and fabs in the logistics park, solar farms on farmland. Each lot keeps its history. Rooftop solar spreads house to house (the ~1,900 houses are drawn individually). Cars drive the road graph; their robotaxi share follows the same signal.

Co-ops keep 30% of their profit as a reserve (`coopRetain`). Monthly, a co-op with a reserve bids for a vacant lot in town (ahead of outside capital) and builds a new co-op asset there, or grows the one it has. Membership is open: half of the new capacity follows existing stakes and half is issued equally to every valley household, which is what pulls the ownership Gini down over time.

