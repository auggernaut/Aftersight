# How the code is organized

Afterlight is plain JavaScript drawing to a single Canvas 2D element. There is no framework, bundler or package dependency for the game itself.

## Build

`node build.js` reads every `src/*.js` file in name order, concatenates them inside one strict-mode function, and substitutes the result for the `/*__GAME__*/` marker in `template.html`. It writes:

- `dist/index.html`: a complete standalone page you can open straight from disk.
- `dist/afterlight.html`: the same body without the outer html/head wrapper, used to publish the Artifact.

Because the files are concatenated rather than imported, every top-level name is shared across files and the numeric prefixes set the load order. Never edit `dist/` by hand.

## Source files

| File | What it holds |
|---|---|
| `01_util.js` | Math and color helpers, including `gradeRGB`, the grey-to-golden color grade driven by town warmth. |
| `02_world.js` | The 2400 × 1700 map: buildings, lots, paths, water, collision grid (16 px cells) and pathfinding. |
| `03_data.js` | Static content: residents (`RES`), technologies (`PROJECTS`), ownership models (`OWNERSHIP`), creations (kitchen, garden, pavilion), styles and build modes. |
| `04_sim.js` | The saved state `S`, household economics, days and time, the story chain (`QUEST_ORDER`), salvage and project progress. |
| `05_npc.js` | Daily schedules and movement for residents. |
| `06_dialogue.js` | All conversations, which branch on quest, mood and each resident's situation. |
| `07_render.js` | Camera and drawing of the world: ground, buildings, trees, people, the diorama shading, tilt-shift blur and the low-effects fallback (`LOW_FX`). |
| `08_projects_art.js` | Drawing of the technologies and creations as they are built, plus helper robots. |
| `09_ui.js` | HTML panels: dialogue, Ledger, Notebook, Projects, town meetings, the Next card and guide arrow. |
| `10_main.js` | Main loop, input, saving and loading, title and character creation screens, and the `window.__AL` test hooks. |

`template.html` holds the page shell, CSS and the HTML for panels.

## Story chain

The main quest runs through `QUEST_ORDER` in `src/04_sim.js`:

meet → solar (idea, plan, build) → first look at the Ledger → Teo's van → workshop (idea, plan, build) → Rosa's garden → greenhouse (idea, plan, build) → cover everyone's essentials → freedom → shared kitchen (plan, build) → first breakfast → epilogue.

## Economy in one paragraph

Each household has essential costs (housing, food, power, transport, other), a wage and a commute. Projects cost parts to build, have a daily operating cost and produce revenue plus a service (cheaper power, repairs and transport, cheaper food). Revenue after costs is split by ownership shares, with a slice to the Commons Fund. A household's required paid work is whatever its essentials still need after services and ownership income. Fewer required hours means more free time and energy, which changes routines, dialogue and the town's warmth.

## Saving

The game saves to `localStorage` under the key `afterlight-save-v1`. If the state shape changes in a way old saves can't load, bump that key.

## Testing

Both tests use Playwright with Chromium and open `dist/index.html`, so run `node build.js` first.

- `node test/smoke.js`: boots the title screen, creates a character and takes a few screenshots.
- `OPTION=equal node test/playthrough.js`: plays the full story through the real UI, using `window.__AL` only to teleport between places. `OPTION` can be `equal`, `need`, `odile` or `brightline`. Screenshots go to `/tmp/claude-0/play-<option>/` (override with `OUT`).

If Playwright is installed globally, prefix with `NODE_PATH=$(npm root -g)`.
