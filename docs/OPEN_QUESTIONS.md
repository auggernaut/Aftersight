# Open questions

Known weak spots and unresolved design questions, roughly by priority. Each says where to look.

## Design

- **What does "winning" mean?** Right now it means surviving elections (win 3, or win 1 with 25%+ town compute share and a dividend). But the vision is about which *path* the town ends on, not keeping your job. Should the win condition move toward ownership share, Purpose and net worth in 2032 or 2036? This ties into the on-hold Report Card ([IDEAS.md](IDEAS.md)).
- **Complexity vs. simplicity.** The Festus layer now has factions, tiers, design asks, research, labs, a fund, projects, Purpose and alerts. Is that still SimCity-simple? What could be merged or cut? (For example: fold the lab clock into the breakthrough card, or fold the asks into fewer factions.)
- **Late-game Purpose is harsh.** As automation rises, Purpose drains (automation × 25) faster than three small projects can refill it. By 2031–32 approval often rests on dividends alone. That is partly the intended point, but it may feel unwinnable. See `layer.js` (the Purpose target) and `mayor.js` (`PROJECTS`, `PROJECT_FADE`).
- **Dividend scale.** One game dollar counts as $1,000 (`DOLLARS`). Fund growth (0.4%/mo) and Keystone's PILOT give dividends that may be too small or too large next to real benchmarks (Alaska's PFD was $1,000 in 2025). The game-dollar mapping has never been calibrated against Festus's real $11M General Fund.

## Balance and systems

- **Balance noise.** `e2e/balance.cjs` at N=30 swings by about ±3 wins between runs. Firm went 6 → 7 and yes 12 → 8–12 with no relevant change. Use N=60 or more, or a fixed seed, before trusting small differences.
- **The breakthrough card-slot bottleneck.** Breakthroughs share the 6-month card gap with offers, asks, projects and campaigns. A due breakthrough can wait several slots, so extra labs speed the clock less than the numbers suggest. See `_director` in `mayor.js`.
- **Town compute is usually zero.** Most Festus runs never get a co-op hall or meaningful equity early, so `townCompute()` is 0. Labs then buy their 10 compute a month on the market (~$30/mo), and the "more compute = faster research" lever rarely shows.
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
