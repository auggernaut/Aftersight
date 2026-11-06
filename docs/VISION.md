# Vision

## What AfterSight is for

AfterSight is an **abundance sim**. It plays out many paths from today into a future of cheap AI, robots and energy. Some of those paths thrive and some don't. The goal is to help people see that **today's decisions** decide which path a town ends up on: who signs what with whom, and who ends up owning the engine.

It is not a utopia and not a doom story. A town can come out rich and empty, comfortable and purposeless, dependent on one company, shrinking because it said no to everything, or owning a real share of its future. The player should be able to feel the difference and trace it back to choices.

## The thesis

1. **Ownership is the question.** As AI and robots take over work, wages stop being the main way people get income. What matters then is **who owns the AI and robot engine**: the data centers, the compute, the robots and the energy behind them. Towns that hold equity, royalties and funds share in the abundance. Towns that just host the machines get rent, noise and a tax check at best. We call this **equity holders vs. enclosure**.
2. **Post-labor economics.** We follow David Shapiro's framing: income comes from wages, capital or transfers, so as wages fall, ownership has to replace them, and transfers are only a floor. He lists concrete ownership mechanisms with real precedents (wealth funds like Alaska's, co-ops, ESOPs, land trusts, royalties). The game turns these into terms a mayor can win: equity stakes, a town wealth fund, a kids' trust, a compute royalty, and a town-owned AI co-op hall.
3. **The Intelligent Internet.** From Emad Mostaque's Intelligent Internet (ii.inc) we borrow the idea of a **locally owned intelligence utility** (a "Champion"). It gives equity to every young person and every new birth year, and an AI agent to every citizen. Today that shows up as the kids' trust and the co-op hall. More is in [IDEAS.md](IDEAS.md).
4. **The purpose engine.** Money alone doesn't make a good life. When jobs go, people need something useful to do and others who depend on them. The game tracks **Purpose** next to approval. Automation layoffs drain it. Ownership and community projects raise it, and projects that neighbors build together raise it more than ones robots build. A mayor can stay in office for a while on dividends while Purpose drains, and that tension is the point.
5. **Real towns, real fights.** It starts in real places where this fight is happening now, beginning with Festus, Missouri. There, in 2026, a $6B data center deal cost every incumbent council member up for re-election their seat. The scenario uses a fictional developer (Keystone Compute Partners) and no real people's names. The facts are sourced; see [RESEARCH.md](RESEARCH.md).

## How it should feel

- **SimCity-simple.** You zone, build, budget and watch a town grow, with a few big decisions on top. The big decisions show up on the map and the demand bars: a campus brings crews who need homes, shops follow what households can spend, and factories fade as machines take the work. Every system should be readable from the screen. If a mechanic needs a manual, it's probably too much. Prefer fewer, clearer systems over more of them.
- **Paced like SimCity.** About 12 seconds per game month at Normal speed, and at most one decision card every 6 game months. Everyday town hall asks wait in the news ticker instead, so the game doesn't stop for them.
- **No single right answer.** Saying yes to every offer and saying no to every offer can both win sometimes. Negotiating should win most often, and the town you end up with should differ by path.
- **Honest about trade-offs.** Every breakthrough helps and strains. Every data center design has a cost. Cards show how each faction would react before you choose.

## Name and brand

- **AfterSight** means *seeing what happens after SI*: superintelligence, or the singularity. It is always written with a capital **S** in the middle. The project was called Afterlight before that, and code, folder and file names still say `afterlight`.
- **No logo.** The top bar says "AfterSight" in plain type, with no mark and no coloured letter. The link preview sets the name the same way, only larger.
- **The icon is a building from the game:** the blue tower on Main Street, cut from the start screen's art (`tools/make-brand-icons.cjs` builds `favicon.ico`, `si-*.png` and `apple-touch-icon.png`).
- **Don't state the game's conclusion up front.** The start screen, link previews and intro say what you do ("Run a real town through the arrival of AI and robots"), not what you'll find out. Players should work out what ownership means by playing.
- **The key art is the game itself.** The start screen shows Festus in January 2026 from the iso renderer, with the proposed data center site and Main Street (`assets/brand/start-wide.webp` and `start-phone.webp`, made by `tools/make-start-art.cjs`). The link preview (`og-1200x630.jpg`, made by `tools/make-og.cjs`) uses the same layout: words on a pale wash at the left, the town on the right. The tone is hopeful and bright, not grim. The game should make the good paths look worth fighting for.
