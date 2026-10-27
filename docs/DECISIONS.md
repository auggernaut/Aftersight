# Decisions

A dated log, newest first. Each entry gives the decision and the reason for it. Commits are on `festus` unless a branch is named.

## 2026-10-27

- **Keep it SimCity-simple.** A new system has to read from the screen (a card, a chip, a panel line) and fit the existing loop of zone, build, budget and decide.
  *Why:* the point is to make ownership trade-offs feel obvious to non-experts. Every layer of rules makes that harder. When in doubt, cut.
- **No Report Card ending yet.** There is no "2036 Report Card" or scoring screen until Augustin asks for one (see [IDEAS.md](IDEAS.md)).
  *Why:* the core loop wasn't settled yet, so an ending would have locked in the wrong scoring.
- **Breakthrough cards need a running Research Lab** (3a54fe1). The lab costs $1,500 plus $10/mo and 10 compute a month. More labs and more town compute bring breakthroughs sooner.
  *Why:* breakthroughs used to just arrive. Now the player chooses to invest in research, and owned compute pays off directly. The build menu split into **Compute** and **AfterSight** for the same reason: to make the compute stack (halls, co-op, lab) one visible thing, with the town's compute and equity shown on the label.
- **Breakthroughs are paid, gated and still have to be built** (f1f79ad, 3a54fe1). Each card costs dollars and compute; compute comes from town equity or the market. A finished breakthrough unlocks a building you still place, fund and keep running. Passing hands it to someone else.
  *Why:* "progress" should be a decision with a price that is tied to ownership, not a free gift on a timer.
- **SimCity pace** (1a8ec5c): Normal is about 12 s a game month and is the default; Slow about 20 s, Fast about 3.5 s. The sim pauses while a card or the alert window is open.
  *Why:* it was too fast to read the town or the news.
- **Status alerts over engine pop-ups** (b55699d, 1a8ec5c). The engine's town/city/capital pop-ups are gone. The ticker carries short status alerts (health, jobs, wealth, water, bills, mood: at most one per topic a year). Each opens a window explaining why it happened, with the numbers.
  *Why:* the engine's pop-ups flipped back and forth as the census swung and told the player nothing. The alerts tie consequences to the player's decisions.
- **The city milestone is earned once** (b55699d). "Festus is now a city" fires after 6 straight months above 13,000 people, and the badge never goes back to TOWN.
  *Why:* the badge flickered when the Festus population swung.
- **Festus Fund, Purpose and projects** (15bf6e0). Keystone's payments and equity go into a fund that pays a January dividend, with a payout slider. Purpose sits in the top bar and feeds approval. Three projects (garden, murals, park) can be built by robots, or by neighbors working with robots.
  *Why:* this makes "equity holders vs. enclosure" and "the purpose engine" playable. Money and meaning are separate dials.
- **Data center design is part of every offer** (cc33601): cooling (evaporative/hybrid/closed-loop) and power (grid/gas/clean). Each has a cost: cleaner designs take money off other terms. Gas pays more but hurts health.
  *Why:* water and power bills are the real fights in data center towns. Design is something a mayor can actually negotiate.
- **Mayor only, no council** (cc33601). The mayor decides; voters are the only check.
  *Why:* a council vote layer added waiting and randomness without adding meaningful choices.
- **Offers improve as you push back; the developer walks and returns bigger** (f1f79ad, b55699d). A counter can bring better terms, a firm "take it or leave it", or a walk-away. After a walk Keystone comes back in 8–12 months with a better tier and a bigger plan (370 → 520 → 700 acres).
  *Why:* this mirrors real deals (developers threaten to leave and come back) and rewards negotiating without punishing any single answer forever.
- **Yes and no are survivable; negotiating is best** (310d123, balance runs). The balance target: every offer strategy can win, and negotiating wins most (currently about 80% vs. 25–40%).
  *Why:* the game argues for ownership. It doesn't lecture by making other paths unwinnable.
- **Real contested towns, Festus first** (2b9d41b). Festus, MO, where a $6B data center deal cost every incumbent up for re-election their seat in April 2026, is the first scenario. The developer is fictional (Keystone Compute Partners), and no real people are named.
  *Why:* real stakes make it matter, and a fictional developer keeps it fair and legally safe.
- **Sunny brand** (7728862, fbd349a): AfterSight with a capital S, the aSi mark, and a bright poster on the splash.
  *Why:* the game is about good futures worth fighting for. Grim art would undercut that.
- **A stable production URL** at https://aftersight-zeta.vercel.app, with noindex. It's deployed from the box with the Vercel CLI, and every deploy needs Augustin's OK.
  *Why:* temporary deploys expired within hours. noindex keeps it private until going public is decided.
- **Polyfork 3D assets: maybe later, only as rendered sprites.** If used, render them to sprite images outside the repo and commit only the sprites. Never commit the source GLB files.
  *Why:* keeps the GPL repo clean of third-party 3D source files with unclear licenses. The procedural-only art rule still holds today.

## 2026-10-26

- **Isometric look on the Micropolis engine** (`micropolis-iso`, d3ee47b): a procedural SimCity 3000-style renderer and a modern UI.
  *Why:* Augustin found the 1989 top-down tiles dated.
- **Fork micropolisJS** (`micropolis`, 384666d, 3cefbf3). It is GPL-3.0 plus the Micropolis Public Name License.
  *Why:* a proven, readable city sim to build on. As a result, any public release must be GPL-3.0 with source, can't be called SimCity, and keeps the attribution.
- **Rename to AfterSight** ("seeing what happens after SI"). The repo was renamed to auggernaut/Aftersight; code names stay `afterlight`.

## 2026-10-20

- **A sim, not a scripted story** (`sim`). The cozy story game on `main` was retired.
  *Why:* living through the singularity should come out of rules and choices, not a script. The minimal agent sim on `sim` was later dropped in favor of the Micropolis engine.
