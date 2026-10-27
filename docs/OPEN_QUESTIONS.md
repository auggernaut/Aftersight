# Open questions

Known weak spots and unresolved design questions, roughly by priority. Each says where to look.

## Design

- **What does "winning" mean?** Still mostly surviving elections (win 3, or win 1 owning 25%+ of local compute and paying $1,000+ a resident). The path readout and election night now say *which* town you won in, and the three-term headline changes with the path ("Three terms, and Keystone owns the rest"). Open: should the win itself require a good path (say, not rich few or checks without purpose in 2032)? That ties into the on-hold Report Card ([IDEAS.md](IDEAS.md)). See `pathNow()` and `election()` in `mayor.js`.
- **Negotiating is now very safe.** The negotiate autoplayer won 30/30 at N=30 (it was about 24/30). Its approval sits at 60–80 by 2032. That's an optimal bot, and a person will make worse calls, but a little more risk would keep elections tense. Knobs: `FREE_FADE`, the ownership cap in `_factionTargets` (`div`), the walk-away sting in `_reaction`.
- **The yes strategy turns on 2028.** A yes-sayer either loses the first vote at 38–44% or wins easily later, depending on whether residents get the deal reopened and how the court rules. It wins about half the time, but by a coin flip more than by play. See `ASK_CARDS.reopen` and `_scripted`.
- **Complexity vs. simplicity.** City pulse now leads with three things (approval, household income, Purpose) and folds demand, mood, power and policies under "More", and everyday asks moved to the ticker. The rules underneath grew, though: the tide, bonds, the guild, renewals. What else could be merged? (For example: fold the lab clock into the breakthrough card, or fold the asks into fewer factions.)
- **Is Purpose now too easy?** With the guild, renewable projects and ownership in the formula, no town in the N=30 balance runs fell into the Long Afternoon by 2032 (it was 14 of 15 negotiating towns before). The bots take every guild and project they can afford, so a careless player will still see it, but the slump may now be rare. See the Festus Purpose formula in `layer.js` and `PROJECTS` in `mayor.js`.
- **Dividend scale.** Halls pay their owners $1.5M a month (`HALL_VALUE`), three times that after a frontier model. That gives negotiating towns about $2,200 a resident a year by 2032 and $5,000–7,000 by 2035, and yes-sayers $500–800. It is still far below what a 1 GW campus might really earn; it was tuned for play, not calibrated. The city budget (game dollars, about $20M) is still not calibrated against Festus's real $11M General Fund.
- **How strong should the tide be?** `TIDE` puts automation at about 45–55% of the region's work by 2032 and 65% by 2036, which leaves 20–30% of residents out of work in 2032. Faster makes ownership matter sooner; slower keeps the first elections about the deal. The starter town still uses the old local model.

## Balance and systems

- **Balance noise.** `e2e/balance.cjs` at N=30 swings by about ±3 wins between runs. Firm went 6 → 7 and yes 12 → 8–12 with no relevant change. Use N=60 or more, or a fixed seed, before trusting small differences.
- **The breakthrough card-slot bottleneck.** Breakthroughs share the 6-month card gap with offers, projects and campaigns (everyday asks now go to the ticker, which helps). A due breakthrough can still wait a slot. See `_director` in `mayor.js`.
- **Town compute early on.** Before a deal with equity or a bonded hall (the bond comes after month 30 or a frontier model), `townCompute()` is 0 and labs buy their compute on the market.
- **Ticker asks lapse quietly.** An ask left in the ticker for three months lapses without effect and comes back later. Is that too forgiving, or should a lapsed ask count as a no?
- **Building on the campus site.** Nothing stops the player (or `findSite()`) from building on the proposed campus parcels; Keystone's halls are later placed over whatever is there. The balance bots now avoid the parcels.
- **A new lab's first month is unpowered.** The power scan runs before the lab is counted, so a lab built mid-month does nothing until the next month. This is harmless but confusing.
- **The 2028 election unemployment dip.** Unemployment often spikes just before the April 2028 vote (the cause isn't pinned down: automation, the valve cycle, or campus construction ending), which makes the first election a coin flip for some strategies. It's unclear whether that's a feature or a timing artefact.
- **Alert "why" text is written when the alert fires**, while its numbers are read live when the window opens. Reopening an old alert can show a mismatch.

## UI

- **Touch road drawing.** On phones, dragging to draw roads competes with panning. Road and rail placement by touch is clumsy.
- **The top bar at 1024px.** At about 1,024px wide the top bar clips (approval, Purpose and score). The toolbar was fixed for widths of 1,360px and below, but the top bar wasn't.
- **Slow speed** was measured roughly (~20–22 s a month). Normal and Fast were timed properly.

## Tech and legal

- **Old saves and tiles 884–892.** Saves made before the Research Lab may hold industrial smoke animation frames on tiles 884–892, which now draw as a lab piece. Consider a save-version check, or remapping those tiles on load.
- **GPL and publishing source before going public.** micropolisJS is GPL-3.0 with the Micropolis Public Name License. Before removing noindex or sharing widely, the repo (or a source archive) has to be published under GPL-3.0, with the attribution kept and no "SimCity" naming. The repo is private today. Also decide whether to rename the package from `afterlight`.
- **Going public at all:** the timing, a custom domain, and whether Festus stays the first scenario while the real lawsuit (December 2026 hearing) and April 2027 mayoral election are still open.
