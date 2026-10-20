# Afterlight

A cozy neighborhood life sim. You step off the evening bus into a tired little town with your robot companion, meet four overworked neighbors, and help them build technology they own together until everyone's essentials are covered and they finally have time for what they actually want to do.

## Launch

- **Play in a browser:** open `dist/index.html` (double-click it, or drag it into any modern browser). No install, no server, no internet needed except for the fonts.
- **Rebuild after editing source:** `node build.js` concatenates `src/*.js` into `template.html` and writes `dist/index.html` (standalone) and `dist/afterlight.html` (the published version).
- **Automated playthrough:** `OPTION=equal node test/playthrough.js` (also `need`, `odile`, `brightline`). Needs Playwright; screenshots go to `/tmp/claude-0/play-<option>/`.

## Controls

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Move | WASD or arrow keys, or click the ground | Tap the ground |
| Talk / interact | E, Space or Enter, or click a person or place | Tap a person or place |
| Ledger, Notebook, Projects | L, N, B | Top-right buttons |
| Pause, speed | P, 1 / 2 / 3 | Top-left buttons |
| Skip to next morning | Z | Moon button |
| Zoom | Mouse wheel or + / − | |
| Close a panel | Esc | × button |

The game saves itself in your browser. Menu → Start over wipes the save.

## How it plays

The **Next** card in the bottom-left always says what to do, and an arrow points to it.

1. **Meet the neighbors.** Mara (warehouse double shifts), Teo (delivery driver), Juno (barista by day, image-labeling gigs by night) and Odile (runs the corner store alone). Each has a household budget, a daily routine and an interest they no longer have time for.
2. **Community Solar.** Draft a design at the workbench in your garage, gather salvage for parts, then call a town meeting at the plaza notice board. Choose who pays and who owns it: an equal co-op, a co-op weighted by need, Odile's investment, or an outside company. The meeting shows exactly how each household's income, essentials and required work hours change.
3. **Watch the Ledger.** Ownership income lowers the paid work each household needs. Free hours and energy rise, routines change, and the town gets warmer and more colorful.
4. **Robot Workshop and Greenhouse.** Teo's broken van and his late wife Rosa's garden lead to the next projects. Upgrades (battery, plaza canopy, extra bay, cargo bikes, aquaponics) come from residents' ideas.
5. **Cover everyone's essentials.** Ownership choices matter: concentrated ownership leaves some neighbors working longer. Odile can choose to share her stake, and the Commons Fund can buy the array back from the company.
5b. **Community Compute (optional).** After the workshop, Juno suggests server racks in the old depot yard, running on the array and renting compute to the valley. Its power is nearly free only if the street owns the array.
6. **Free time.** With work no longer required, neighbors rediscover what they love. Mara proposes a shared kitchen; you plan its style and features and choose whether robots build it or people build it by hand. Then host the first breakfast.

**Ownership has consequences.** Brightline's discount ends two days after its array goes up (power then costs 10% more than before), and its buyback price rises every day. If Brightline builds the workshop, most of the parts it makes go to the city. Odile can keep her stake, and the Commons Fund can buy it from her. The ending changes depending on who owns the street's engine, and it shows each household's total paid hours.

There are no streaks, timers or fail states. Waiting, wandering and talking are always fine.
