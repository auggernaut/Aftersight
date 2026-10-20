# How the sim is organized

Plain JavaScript drawing to one Canvas 2D element, plus HTML panels. `node build.js` concatenates `src/*.js` in name order inside one strict-mode function, inlines `vendor/yuka.min.js` (Yuka 0.7.8, MIT) in its own script tag, and writes `dist/index.html`. Every top-level name is shared across files; the numeric prefixes set load order. Files `01`–`08` never touch the DOM, so `test/headless.js` can run the whole simulation in Node.

| File | What it holds |
|---|---|
| `01_util.js` | Seeded RNG, formatting, Gini, calendar (30-day months, 360-day years), loyalty colors. |
| `02_rules.js` | `baseParams()` (every tunable number) and `DISCOVERIES` (tiers 1–4, then generated "generation N" discoveries forever). |
| `03_world.js` | The 200 × 140 tile valley: terrain, the town street grid, parcels for new builds, street routing, job sites, names. |
| `04_economy.js` | State `S`, ownership shares, the daily market (`econDay`), monthly appetite growth, investment by Helix / households / the town, distress sales, co-op drives, metrics and history. |
| `05_agents.js` | Yuka-based agents: movement (`Vehicle` + `FollowPathBehavior`), goals (`ActivityGoal` = move then dwell), the goal evaluators, and the visible robot workers. |
| `06_mind.js` | The Mind seam for a future local model (see below), plus template dialogue. |
| `07_sim.js` | `newWorld(seed)`, the fixed-step `simStep(dt)`, day rollover, discoveries. |
| `08_player.js` | Player actions and council votes. |
| `09_render.js` | Camera, baked terrain, buildings, ownership bars, people, robots, night. |
| `10_ui.js` | Indicators, happenings feed, inspector, action menus, chart, discovery banner. |
| `11_main.js` | Main loop, speeds, input, and `window.__SIM` test hooks. |

## Time

Agents run in hours, the economy in days. One step is 0.05 h at low speed (Yuka steering), 0.25–0.5 h at high speed (agents walk the same street path kinematically so they don't overshoot). The economy ticks once per day at midnight; appetite grows monthly; history is sampled weekly.

## Decisions (Yuka)

Each resident owns an `AgentBrain` (a `YUKA.Think`) with goal evaluators: sleep, work, family, social, volunteer, civic (national service), learn (retrain), pledge (to a co-op), council, propose (start a co-op), school and play. Each evaluator returns a desirability from the situation (time of day, household savings, job openness, open co-ops, construction in town, automation level) and is multiplied by a **character bias computed from that agent's loyalties**. For example work's bias is `0.35 + 0.9·self + 0.9·family`, volunteer's is `0.12 + 1.7·community`, civic's is `0.12 + 1.7·nation`. `arbitrate()` runs about hourly; the top four scores are kept so the inspector can show why someone is doing what they're doing.

Loyalties drift: people dwelling at the same place nudge each other toward the average (3% per encounter), and trust in the player spreads the same way.

## The Mind seam (for Muse Glimmer or another local model)

`Mind.use(provider)` installs a provider with optional `choose(agent, scored, snapshot)` (return a goal kind to override Yuka's pick) and `say(agent, topic, ctx, snapshot)` (return a line). `snapshot(agent)` is the plain-data view a prompt would get: loyalties, needs, household and stakes, job, memory, and world state. Providers must answer synchronously from a cache and do any model work in the background; the sim never waits.

## Economy in one paragraph

Solar makes energy (yield × season); homes, racks, robots and the factory consume it; shortfalls are partly imported from the national grid at a high price, and prices follow demand/supply. Powered racks make compute; locally owned racks serve local demand first, Helix sells to whoever pays, including an outside appetite that grows 7% a month. Robots need energy and compute and do the automatable share of the town's work; spare robot hours are sold outside at a falling price. Humans get the remaining hours at a wage. Every asset pays its profit to its shareholders. The town taxes resident income and Helix's local profits and pays most of it out as a per-person dividend, investing the rest in commons assets. Households with savings invest according to their loyalties (co-op, commons, best-paying stake, national bonds that speed research, or keep a family buffer); households that run out of cash sell stakes, to Helix by default or to the town under right of first refusal.
