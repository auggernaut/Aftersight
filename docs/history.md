# What we've done so far

A running log of how Afterlight was built, what was decided, and what is still open. Newest work is at the bottom.

## 2026-10-17: First playable

Augustin wrote a full design brief: a cozy life and community sim where shared ownership of productive technology frees a tired town from exhausting work, so people can discover what they actually want to do. The first version had to include a player-made character, a robot companion, at least three residents with routines and finances, two community-owned technologies, a full transition to covered essentials, one activity afterwards (like a shared kitchen breakfast), ownership choices with visible consequences, and auto-save with restart.

What was built (plain JavaScript and Canvas 2D, no dependencies, one self-contained HTML page):

- **The town:** one neighborhood with a plaza, four homes, a corner store, the player's garage workshop, a meadow, a stream, a pond, a waterfall and an old rail depot. Free movement on open ground, collision on buildings and water.
- **Four residents:** Mara (warehouse double shifts, loves baking), Teo (delivery driver, wants to bring back his late wife Rosa's garden), Juno (barista plus a night gig, stopped drawing) and Odile (runs the corner store alone, plays accordion). Each has a household budget, a daily routine, energy, moods and dialogue that changes as their life changes.
- **Three community technologies:** Community Solar, a Robot Workshop and an Automated Greenhouse, each with styles, resident-suggested upgrades, running costs and revenue.
- **Ownership as a mechanic:** at each town meeting the player picks who pays and who owns it (equal co-op, co-op weighted by need, Odile's investment, or an outside company called Brightline). The meeting previews how each household's income, essentials and required work hours change. Concentrated ownership leaves some neighbors working longer, with two ways to fix it: Odile can share her stake, and the Commons Fund can buy the array back.
- **After work:** once essentials are covered, neighbors rest, then take up their interests. Mara proposes a shared kitchen; the player picks its style and features and whether robots build it or neighbors build it together, then hosts the first breakfast. A waterfall garden and music pavilion are also possible creations.
- **Atmosphere:** the town starts grey and muted and warms to full color as community life improves.
- **Controls and UI:** keyboard, mouse and touch; Ledger, Notebook and Projects panels; pause, three speeds, skip to next morning; a "Next" card and arrow that always point to the next objective; auto-save in the browser.

Testing: an automated Playwright playthrough drives the whole story through the real UI. It reached the ending with equal shares (16 in-game days), Odile's investment (15 days) and the outside company (19 days), with no errors and a correct resume after reload. The need-weighted option was not run end to end. The phone layout was checked by hand.

Published as the private Artifact "Afterlight" (https://claude.ai/artifact/XG5a8uLFYm3EyX8MHnvrMf).

## 2026-10-17: Diorama restyle

Augustin shared an X post (by @hakimieiqbal) showing painted concept art projected onto a 3D scene, and said they liked its cozy look: a tilted three-quarter view, rich golden greens and terracotta, chunky roofs, small villagers, and a tilt-shift blur.

Three routes were offered: restyle in code, wire in a painted backdrop, or rebuild in 3D with projection. Augustin chose the code restyle. Changes:

- Buildings got a shaded side wall, a deeper hip roof with its side and ridge showing, cast shadows and dark outlines.
- Trees, bushes and people got ink outlines and richer greens.
- The warm end of the color grade became more saturated and golden, with terracotta paths. The grey start was kept.
- A tilt-shift blur softens the top and bottom of the screen.
- Slow devices automatically drop the blur and character outlines.

Screenshots: `shots/restyle/before_warm.png`, `after_warm.png`, `after_start.png`. The pre-restyle version is kept in the project as `afterlight-backup-v1/` (not part of this repository).

Augustin's reaction was that it looked about the same. The honest reason: everything is drawn from code shapes, and the look in the post comes from painted art. They were offered three next steps (bring in painted art, a much bigger code redraw with a steeper camera and textured roofs, or keep the current look), with painted art recommended. `art-brief.md` has the image prompts, sizes and layout coordinates for the painted route. **This decision is still open.**

## Open items

- **Art direction:** waiting on Augustin's choice between painted art, a bigger code redraw, or keeping the current look. See `art-brief.md`.
- **Breakfast bug:** two of the four story playthroughs fail at the "host the first breakfast" step. The pre-restyle version fails at the same step, so the restyle did not cause it. Not yet fixed.
- **Need-weighted co-op** has not been played end to end by the automated test.
- **Performance:** after the restyle, headless frame rate dropped from about 30 to about 24 fps. Full-screen blend effects were too slow in software rendering, so contrast is baked into the color grade instead.

## 2026-10-20: playtest pass

- Fixed a soft-lock at the first breakfast: "Next morning" lands at 6:00, the breakfast window opened at 6:30, and the hint said to press Next morning again. It now opens at 6:00. Also fixed a door-knock race in the playthrough test.
- Ownership now matters: Brightline's discount ends (power then costs 110% of the original), its buyback price rises daily, and it can also build the workshop (it keeps 60% of the parts the robots make). Odile can choose to keep her stake, and the Commons Fund can buy it. The buyback works for any project.
- Endings branch on who owns the engine: "We made room, and we pay rent on it" (Brightline), "on Odile's savings", "We own the engine" (community-owned compute), and "We bought it back". The epilogue shows an ownership bar and each household's total paid hours.
- Added Community Compute: an optional project in the depot yard, suggested by Juno (her night gig is labeling images for a city AI company). Its power cost depends on who owns the array.
- Tightened the middle: upgrades cost about 30% less, households can cut up to 4.5 h of work a night (was 3.5), Mara settles into free time a day sooner, and the kitchen's base cost dropped from 40 to 25 parts. With all four paths played end to end, co-op paths finish in 13–14 days (was 15–18) and Brightline takes 20.

## 2026-10-20: pivot to a simulation (branch `sim`)

Augustin decided the game wants to be a simulation of living through the singularity rather than a scripted walkthrough. The cozy story build was retired (it remains on `main` at `f81a611`) and the repo restarted on the `sim` branch as a graphically minimal, agent-based sim using Yuka for agent decisions, with a seam left for a local model (Muse's Glimmer) later.

## 2026-10-26: micropolis branch

Augustin asked for "SimCity today": the singularity played out on a SimCity clone, with data-center backlash, riots, job loss and purposelessness alongside abundance and healing technologies. We forked micropolisJS (GPL-3.0) into the `micropolis` branch and added an Afterlight layer: compute and robots, a jobs shock, mood indicators, ownership policies, protests/riots/strikes/slumps and five discoveries. The agent sim stays on `sim`.
