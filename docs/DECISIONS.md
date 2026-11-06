# Decisions

A dated log, newest first. Each entry gives the decision and the reason for it. Commits are on `main` (developed on the former `festus` branch) unless a branch is named.

## 2026-11-05 (ready to share, branch `mvp-polish`)

Getting AfterSight to the point where Augustin can send people a link. A first-minutes playthrough on a laptop and a phone found the game itself in shape and the way in cluttered.

- **The source is public.** The repo is public, and the game links to it from the start screen, the header and About.
  *Why:* AfterSight is GPL: anyone who gets the game is entitled to its source.
- **One click into Festus.** The start screen leads with Festus and a Continue button when a game is saved. Play Festus skips the new-game form (a real town needs no name field, and the game is tuned at Easy). The random map and the empty valley sit behind a Sandbox link with their form, a map preview and Back.
- **A disclaimer where players see it.** "Festus is real. Keystone, its offers and everyone you meet are fictional: this is a simulation, not a prediction," on the Festus card, under the intro's button and in About.
  *Why:* Festus is in the middle of a real fight.
- **The start screen shows the game.** The poster on the left of the start screen is gone. The game's own map of Festus (January 2026, with the proposed data center site and Main Street, rendered by `tools/make-start-art.cjs`) fills the screen, and the words sit in a column on a pale wash at the left, like the link preview. On phones held upright the map is a band at the top.
  *Why:* Augustin found the poster sat oddly to the left of the start screen and its wordmark didn't match the top bar. The game's own art is honest about what you'll play. The old poster is in git history.
- **No logo, no tagline (2026-11-06).** The top bar says "AfterSight" in plain type, with no mark and no blue S. The browser and app icon is the blue tower on Main Street, cut from the start art (`tools/make-brand-icons.cjs`). The start screen, link previews and intro card no longer say "Who owns the machines decides who gains" (or "What the town owns decides who gains"); the headline is only "Run a real town through the arrival of AI and robots."
  *Why:* Augustin hated the logos in the header (the "Si" mark from 2026-11-05 and the styled wordmark), and the tagline is something players should work out by playing. He picked the tower from four icon candidates.
- **Shorter openings.** The intro card has three rows (your job, what's coming, the goal) and fits a phone; the first offer's opening is two sentences, since its terms already cover water and power. Leverage explains itself on hover. The counter's Back and Send buttons stay in view while the asks scroll.
- **First-game tips in the ticker:** the demand bars (showing an empty lot), that news lines explain themselves, and the Research Lab.
- **The top bar fits a laptop.** Budget and Save stay in view; Settings, Photo, Feedback, About and New game sit under More. Festus hides Evaluation (the engine's score) and Disasters. Pause is the speed buttons' job.
  *Why:* at 1280px, Save and everything after Evaluation fell off the screen.
- **Autosave and Continue.** The game saves itself once a game month and whenever the tab is hidden or closed; the start screen offers Continue with the town and date. New game (under More) goes back to the start screen with the game saved. The browser keeps one save, so starting a new game over it (Play Festus, the sandbox or a `?play=festus` link) asks first; Play again on the final paper doesn't, because the player just chose it.
  *Why:* a shared link or one misclick would otherwise autosave a fresh January 2026 over a game in progress (caught by Cursor Bugbot on PR #3).
- **Play again** on the game-over paper and on the paper of a final win starts a new Festus game (`?play=festus`, which also works as a shared link).
- **Sharing.** Link previews (title, description, a 1200x630 image of the town); Feedback goes to augman on X; Vercel Web Analytics (anonymous, no cookies) when a deploy asks for it, with a few milestone events.
- **The north side's corner shop is an empty lot.** It was the only zone left in a platted neighbourhood and had no power.

## 2026-10-27 (city building, branch `city-building`)

Augustin asked why the game felt less like city building than SimCity 3000. A check found that over half the Festus map was open land, but nothing asked the player to build: the old town's neighbourhoods were pre-zoned and mostly empty lots, so the town filled itself in, and the balance bots won without ever zoning a tile. These decisions bring building back and tie it to the story.

- **The old town starts built out; the rest is platted.** Downtown, the half of the west subdivision by the site and a corner of the north-west one start full of houses. The north side, most of the north-west and the south side have streets and power but empty lots.
  *Why:* the first thing to do on the map should be obvious (zone the empty lots), and the town should look like the 12,000-person town the intro describes.
- **Festus is zoned for houses.** A block holds eight houses and never turns into apartments, so new homes need new blocks. Homes fill in a few months while people want to move in and empty when they want out.
  *Why:* without a cap the engine packs growth into existing blocks and the player is never needed. An "allow apartments" policy is in [IDEAS.md](IDEAS.md).
- **The deal creates demand you build for.** Keystone's construction crews stay a year (about 550 workers for a first campus) and its staff stay on; the town's own halls, the home-grown plan and the trades building new homes add jobs too. They bring people who need homes. When more than 88% of homes are taken and people still want in, rents climb, and Residents, Workers and Schools feel it. A homes alert points at an empty lot with power.
  *Why:* real data center fights are land-use fights, and housing for the build-out is part of them.
- **The bars tell the story.** Shops follow what households have to spend (wages plus ownership plus transfers), so an ownership town keeps Main Street busy and an enclosure town loses shops. Factories stop growing and slowly fade as the tide rises. Commuters' jobs in the region are counted, and the tide reaches them too. Festus has no births: it grows when people move in for work. A dividend keeps people from leaving but doesn't pull in jobless newcomers.
- **Robots make building cheap.** Once robots build robots, roads, zones, power lines and buildings cost half if the town made the breakthrough, and 25% less if it was made elsewhere (from month 54 at the latest). Data centers keep their price. Tool tips follow.
  *Why:* abundance should show up as a building boom you can use, and owning the breakthrough should pay.
- **The demand bars sit with the zone tools**, with tips that say what is pulling people in. A Homes chip in City pulse shows homes taken and rents.
- **Household water scales with the bigger starting town** (190 people per unit of supply), so the old town starts near 60% of the river wells, as before.
- **Zoning is a permit.** In Festus a block costs $25k to zone (a quarter of the engine's price): the streets and power on the platted lots are already in, and builders put up the homes.
  *Why:* at $100k a block, building cost the marginal strategies more than the rents it saved.
- **Business likes real growth.** Business reads how many more homes the town has than a year ago (plus a little of the shop demand), instead of the shop demand bar alone, which rose highest when demand went unmet.
- **The balance bots build.** Every strategy zones homes on powered platted lots when homes are tight and shops when shop demand is up. A new `cards` strategy negotiates but never builds, to check that building matters (`yes-cards` and so on for the others).
- **Balance** (N=30): negotiate 30, firm 19, yes 16, no 15, cards 30, yes-cards 5–7. Building decides the marginal strategy (a yes-sayer that builds wins about half the time, one that doesn't about a fifth). For a negotiator it is roughly a wash by 2032: lower rents and a bigger town, but more people out of work as the tide rises.

## 2026-10-27 (playtest review, branch `playtest-review`)

A headless playtest of 140 games found the rules arguing against the vision: the strategy that won most left half the town jobless with Purpose near 18, the town that refused every deal was the healthiest and lost, and ownership paid $80–190 a resident a year. These decisions answer that.

- **Automation is a regional tide (Festus).** It rises with time and with each breakthrough, whoever makes it (the town, someone else after a pass, or the world by month 36 and 54). Only the town's own robot depots add to it.
  *Why:* the thesis is that automation comes anyway and ownership decides who gains. Before, only compute hosted in Festus automated Festus jobs, so saying no protected jobs.
- **Ownership pays.** A hall pays its owners $1.5M a month, three times that after a frontier model. The town's equity share, the deal's co-op hall and bonded town halls all go into the Festus Fund. Household income is wages, ownership (the Fund's dividend) and transfers; factions, Purpose and the dividend's "cover" read it.
  *Why:* a 35% stake paid about $82 a resident a year while the model said dividends replaced all lost wages. The screen and the model now agree.
- **A path readout.** City pulse names the path: early days, building a stake, thriving owners, rich few, checks without purpose, boom and strain, or no deal and decline. A change is news, and election night names the path with its numbers.
  *Why:* the vision is about which path the town ends on, not keeping the job. This shows it without the on-hold Report Card or an ending screen.
- **The ownership win needs a real dividend:** 25%+ of local compute and at least $1,000 a resident a year (Alaska's 2025 dividend), instead of any dividend at all. Winning three elections is unchanged.
  *Why:* with the new scale, "any dividend" would have been a trivial early win.
- **Town hall asks arrive in the ticker.** Everyday asks wait in the ticker (and in City pulse) without pausing the game or using a card slot; left alone for three months they lapse and come back later. Their stakes are half a card's. A furious faction and reopening a bad deal still get a card.
  *Why:* factions almost never got to speak; breakthroughs, offers and campaigns filled every slot.
- **New asks:** an apprenticeship guild (the Purpose programs policy, now a Festus decision), a co-op bond for a town-owned data center, and new river wells when water runs short. A published agreement stays public when it's re-signed, and a re-signed deal is judged on what changed.
- **Town-owned data centers need a bond.** The co-op hall tool is locked in Festus until voters back a bond (at most two). A bonded hall pays its bond first (65% of revenue) and the rest into the Fund.
  *Why:* three co-op halls from month 0 used to skip the negotiation and print money into the budget.
- **Keystone leaves for good after the third walk.** It builds across the river; the tide still comes. The home-grown plan (twice at most) and bonded halls employ some people.
  *Why:* the no-deal path was the same offer every year.
- **Renewable projects on the map.** Eight projects, from a garden to The Lantern (which needs deep abundance). An opened project appears as trees and a fountain near Main Street, the river or the bluffs; a faded one can have another season for 30% of the cost.
  *Why:* three one-off projects couldn't hold Purpose up.
- **Festus shows real dollars.** One game dollar is $1,000 (`src/afterlight/money.js`): $20M in the bank, $200k a year, $1.5M for a lab. The budget window and tool tips follow.
- **Readability:** every alert ends with "What you can do"; offer cards lead with money to the town, jobs, water and power, with the rest under "All terms"; City pulse leads with approval, household income and Purpose, with demand, mood, power and policies one tap away; the top bar shows the income mix instead of the engine's score.
- **Starter-town leftovers are out of Festus:** the citizen-dividend switch, Hope and Backlash bars, riots and general strikes. Neighbors blockade the campus when Residents fall under 35.
- **Balance** (`e2e/balance.cjs`, N=30): negotiate 30, firm 15, yes 15, no 11. In April 2032 negotiating towns are mostly building a stake or thriving owners (8% of income from ownership, $2,239 a resident), firm and yes towns are rich few, and no-deal towns are building a stake of their own.

## 2026-10-27

- **`main` is the game.** The `festus` branch was fast-forwarded into `main` and deleted; the old story game moved to `legacy/story-game` and tag `legacy-story-game`.
  *Why:* one obvious branch for people and agents; GitHub's default already pointed at `main`.
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
- **Sunny brand** (7728862, fbd349a): AfterSight with a capital S, the aSi mark, and a bright poster on the splash. (Replaced on 2026-11-05 by the game's own map and the Si mark.)
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
