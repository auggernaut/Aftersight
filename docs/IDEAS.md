# Ideas not built yet

Ideas we've discussed but not built. None are approved; check with Augustin before building one, and keep the game simple (see [VISION.md](VISION.md)). Sources and background are in [RESEARCH.md](RESEARCH.md).

## On hold

- **The 2036 Report Card and a top-scores board.** An ending screen that grades the town on ownership share, median net worth, Purpose, health, water and approval, and says which path it ended on. A leaderboard would compare runs. **On hold until Augustin asks for it.**

## Ownership: the equity tree

A plan in phases for where a town's ownership can come from. Each layer is bigger than the last.

1. **Town (done):** Keystone equity tiers, the Festus Fund with a dividend and payout slider, the kids' trust, the compute royalty, the co-op hall.
2. **More town sources:**
   - a solar co-op (pairs with the clean-power design)
   - a town fiber and compute lease
   - a community land trust under the campus
   - worker buyouts (ESOP-style)
   - **Founders' Shares:** every kid gets a stake vesting at 21, and each birth year adds a slice, copying the ii.inc Champion
   - a **universal AI allowance** (free daily AI for every resident; it helps schools and health but uses compute that breakthroughs also need)
   - **Benefit Credits:** town compute earns credits only when it runs public work (clinic, school, projects), and credits pay for projects. This copies ii.inc's Proof of Benefit.
   - **Done:** a bonded town-owned data center (the `coop_bond` ask), paid off from its own revenue.
3. **State:** a regional power co-op, carbon royalties, a **Regional Champion** (the town's compute fund spun out as a company), and a Missouri wealth fund through a coalition of towns that copied yours. This needs re-election or allies.
4. **Nation:** national funds and royalties arrive as events you back or oppose. Your stance moves approval, and how many towns followed you moves the odds. A running readout shows which path you're on.

**Ownership share of income** (Shapiro's key metric) is now tracked and shown (household income in the top bar and City pulse). **Median net worth** is still only the Fund's dividends added up per resident.

**The four capitals as a lens.** *The Last Economy* scores a place as Material × Intelligence × Network × Diversity. Money without trust (network), or all-in on one company (no diversity), still collapses. This could become part of the path readout.

## The five paths to 2036

The trajectories the sim should drift toward, shown as the years pass rather than as a forced ending. **A live readout is built** (the path chip in City pulse, `pathNow()` in `mayor.js`), with two in-between states (early days, building a stake), and election night names the path. Still open: whether the win should depend on it (see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)).

1. **Thriving owners:** most households own a stake, dividends cover the basics, and the parks are busy. You get here by pushing for equity, funding the endowment, co-ops, closed-loop cooling and solar, and community-built projects.
2. **Rich few (enclosure):** Keystone owns everything; tax money is good but stops at City Hall; Purpose slides. You get here with cash-heavy deals, spent windfalls and robots-only projects.
3. **Checks without purpose:** transfers keep people fed, but nobody owns anything and days feel empty. Approval is fine, Purpose is low and net worth is flat.
4. **Boom and strain:** fast growth tied to one company, with evaporative cooling and gas; water, bill and health alerts; Keystone threatens to leave the way PPG and the smelter did.
5. **No deal, decline:** sales tax erodes, young people leave, and the population and budget shrink.

## City building

The first step is built (October 2026): the old town starts full, the platted streets wait for zoning, the campus's crews and jobs push the R bar and rents, shops follow household income, factories fade with the tide, and robot crews make building cheaper. Next ideas, simplest first:

- **An ownership map view.** A map overlay, like a pollution or land value view, coloring what the town owns, what Keystone owns and what residents own (halls, bonded halls, solar, depots, homes). The goal becomes watching the map turn green.
- **Choose where the campus goes.** Place Keystone's parcel yourself: by the river (cheap water, more strain), next to homes (noise), out on farmland (land you can't zone later).
- **An "Allow apartments" policy.** Festus is houses-only today; upzoning would add homes without farmland, and neighbors would grumble.
- **Roads into farmland.** New subdivisions on the fields beyond the platted streets, which costs the Farmers (farm loss is already measured by `farmLost()`).
- **A from-scratch start.** A second mode that starts from a crossroads on a generated map, with the AI era arriving as you grow. The engine already generates maps.
- **Who owns the robot crews.** A town-owned construction co-op (after self-building robots) that builds cheaper and pays its earnings into the Fund, instead of only a price cut.

## Purpose and projects

- **Built:** eight projects (garden, murals, market hall, tool library and makerspace, youth league, riverfront park, observatory, The Lantern) whose costs fall with abundance, a new season when one fades, and a patch of trees and a fountain on the map when one opens. **Not yet:** theater, festival, a little library; projects with their own art; letting the player choose where a project goes.
- **Participatory budget events** that raise Purpose when residents choose.
- A yearly festival (Twin City Days in real Festus) with a small Hope boost and a mayor's speech.

## More towns

- **Clarksville, AR:** a 70 MW town utility facing a 400+ MW campus; the deal itself goes to a referendum (December 1, 2026).
- **Wilmington, OH:** AWS on farmland; emergency clauses to skip a public vote; a town that already lived the DHL jobs shock.
- **Backups:** Port Washington, WI (the biggest build; a TID fight), Frederick County, MD (a $110M offer with a zoning-freeze poison pill), Cassville, WI (a tutorial where the developer walks), Coweta County, GA (a petition overturns a vote).
- **Town mechanics:**
  - recall petitions (the real Festus recall was blocked by the council)
  - ballot referendums on a deal
  - poison-pill offers
  - a renters subgroup
  - flood events and levee upkeep
  - "town memory" of industry leaving
  - the use-tax fight

## Look and platform

- **Polyfork 3D assets**, used only as pre-rendered sprites. The source GLBs stay out of this GPL repo (see [DECISIONS.md](DECISIONS.md)).
- **A custom domain** instead of `aftersight-zeta.vercel.app`.
- **Going public:** remove noindex, publish the source (GPL), add a landing page and share it. See [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
