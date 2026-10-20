// The rules of the world: base parameters and the discoveries that change them.
// Economy runs in days; agents run in hours. Units: energy MWh/day, compute "units"/day
// (one powered rack makes one unit a day), money in dollars.
function baseParams() {
  return {
    solarYield: 4.5,      // MWh per MW of panels per day (before season)
    solarCost: 400000,    // $ per MW
    rackE: 0.5,           // MWh a rack burns per day
    rackCost: 30000,      // $ per rack
    robotE: 0.02,         // MWh per robot per day
    robotC: 0.3,          // compute units per robot per day (robots need minds)
    robotHours: 16,       // hours of work a robot does per day
    robotCost: 20000,
    factoryCost: 1600000, // $ per (robot/day) of factory capacity
    factoryE: 0.6,        // MWh per robot built
    homeE: 0.03,          // MWh per person per day
    aiPerCap: 0.1,        // compute per person per day (assistants, tutors, doctors-in-a-box)
    extC: 30,             // the outside world's compute appetite (frontier labs, cloud)
    laborPerCap: 7.5,     // hours of work the town wants done per resident per day
    autoFrac: 0.35,       // share of that work robots are able to do
    wage: 30,             // $ per human hour
    robotRate: 0.85,      // robot hour is billed at this share of a human wage
    exportRate: 0.35,     // spare robot hours sold outside the valley (remote work) at this share
    exportCap: 1500,      // robot-hours/day the outside market absorbs at that price
    peBase: 80,           // $ / MWh
    pcBase: 120,          // $ / compute unit
    gridPrice: 140,       // $ / MWh bought from the national grid
    gridCap: 16,          // MWh/day the valley's grid connection can carry (present day: most of its power)
    robotaxi: 0,          // share of trips taken in robotaxis
    essential: 55,        // $ per person per day for housing, food, basics
    essentialIdx: 1,      // discoveries can make basics cheaper
    tax: 0.10,            // town tax on resident income
    propTax: 0.05,        // town tax on outside profits made in the valley
    townPayout: 0.8,      // share of town income paid out as a per-person dividend
    // insatiable demand: monthly growth of appetite
    gE: 0.025, gC: 0.05, gX: 0.07, gL: 0.01,
    helixHurdle: 0.28,    // annual return Helix wants before it builds
    helixBudget: 450000,  // $ Helix will spend per month in the valley
    discoveryEvery: 110,  // days between discoveries at baseline research
    researchBoost: 1,     // multiplier from AI scientists etc.
    buildDays: { solar: 20, compute: 30, factory: 45, fleet: 0 },
    walkSpeed: 22,        // tiles per hour
  };
}

// Discoveries arrive in tiers; the next one is drawn from the lowest unfinished tier.
const DISCOVERIES = [
  { id: 'perovskite', tier: 1, title: 'Perovskite tandem panels', blurb: 'Printed solar cells stack on silicon. Panels get far cheaper and yield more.',
    changes: ['Solar yield ×1.5', 'Solar cost ×0.6'], fx: P => { P.solarYield *= 1.5; P.solarCost *= 0.6; } },
  { id: 'atlas', tier: 1, title: 'Atlas-5 frontier model', blurb: 'A model that can do most desk work. Everyone wants it, and it needs ten times the compute.',
    changes: ['Compute per person ×10', 'Outside compute appetite ×3', 'Robots can do +15% of jobs'], fx: P => { P.aiPerCap *= 10; P.extC *= 3; P.autoFrac = Math.min(0.97, P.autoFrac + 0.15); } },
  { id: 'sodium', tier: 1, title: 'Sodium batteries', blurb: 'Cheap salt batteries store sunshine for the night.',
    changes: ['Solar yield ×1.25', 'Grid import price ×0.8'], fx: P => { P.solarYield *= 1.25; P.gridPrice *= 0.8; } },
  { id: 'robotaxi', tier: 1, title: 'Robotaxis go everywhere', blurb: 'Driverless cars are cheaper than owning one. Parking lots and gas stations start to empty.',
    changes: ['Robotaxi share of trips +40%', 'Robots can do +5% of jobs (driving)'], fx: P => { P.robotaxi += 0.4; P.autoFrac = Math.min(0.97, P.autoFrac + 0.05); } },
  { id: 'humanoids', tier: 2, title: 'General-purpose humanoids', blurb: 'Robots with hands good enough for kitchens, clinics and building sites.',
    changes: ['Robots can do +20% of jobs', 'Robot work day 16h → 20h', 'Robotaxi share +15%'], fx: P => { P.autoFrac = Math.min(0.97, P.autoFrac + 0.2); P.robotHours = 20; P.robotaxi += 0.15; } },
  { id: 'distill', tier: 2, title: 'Distilled robot minds', blurb: 'Small models that run on the robot itself.',
    changes: ['Compute per robot ×0.4'], fx: P => { P.robotC *= 0.4; } },
  { id: 'vfarms', tier: 2, title: 'Robot vertical farms', blurb: 'Food grown in stacked rooms by machines, all year.',
    changes: ['Cost of basics ×0.7'], fx: P => { P.essentialIdx *= 0.7; } },
  { id: 'aisci', tier: 2, title: 'AI scientists', blurb: 'Labs run around the clock by models. Discoveries come faster, and they are hungry.',
    changes: ['Discoveries 1.5× as often', 'Outside compute appetite ×3'], fx: P => { P.researchBoost *= 1.5; P.extC *= 3; } },
  { id: 'selfrep', tier: 3, title: 'Robots that build robots', blurb: 'Factories staffed by the machines they make.',
    changes: ['Factory output ×3', 'Robot cost ×0.5'], fx: P => { P.factoryMult = (P.factoryMult || 1) * 3; P.robotCost *= 0.5; } },
  { id: 'microfab', tier: 3, title: 'Desktop micro-fabs', blurb: 'A robot factory the size of a garage. Small owners can build one.',
    changes: ['Factory cost ×0.25'], fx: P => { P.factoryCost *= 0.25; } },
  { id: 'fusion', tier: 3, title: 'National fusion pilot', blurb: 'The first fusion plant joins the national grid.',
    changes: ['Grid price ×0.5', 'Grid import capacity ×4'], fx: P => { P.gridPrice *= 0.5; P.gridCap *= 4; } },
  { id: 'agents', tier: 3, title: 'Personal agents everywhere', blurb: 'Everyone runs a swarm of agents working on their behalf, all day.',
    changes: ['Compute per person ×5', 'Robots can do +15% of jobs'], fx: P => { P.aiPerCap *= 5; P.autoFrac = Math.min(0.97, P.autoFrac + 0.15); } },
  { id: 'photonic', tier: 4, title: 'Photonic chips', blurb: 'Light instead of electrons. Racks do ten times the work on the same power.',
    changes: ['Compute per rack ×4 (same energy)', 'Outside compute appetite ×4'], fx: P => { P.rackOut = (P.rackOut || 1) * 4; P.extC *= 4; } },
  { id: 'orbital', tier: 4, title: 'Orbital solar', blurb: 'Power beamed down from orbit, sold by whoever owns the satellites.',
    changes: ['Grid import capacity ×5', 'Grid price ×0.7'], fx: P => { P.gridCap *= 5; P.gridPrice *= 0.7; } },
  { id: 'nanofab', tier: 4, title: 'Molecular assembly', blurb: 'Most physical goods become nearly free to make.',
    changes: ['Cost of basics ×0.5', 'Robot cost ×0.5'], fx: P => { P.essentialIdx *= 0.5; P.robotCost *= 0.5; } },
];

// After the scripted tiers run out, the frontier keeps moving: generated discoveries alternate
// between making things cheaper and making the world hungrier.
function nextGenDiscovery(n) {
  const k = n + 1, gen = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n % 9];
  const kinds = [
    { title: `Chip generation ${gen}`, blurb: 'Another leap in silicon. Each rack does more, and the models grow to fill it.', changes: ['Compute per rack ×1.6', 'Outside compute appetite ×2'], fx: P => { P.rackOut = (P.rackOut || 1) * 1.6; P.extC *= 2; } },
    { title: `Robot generation ${gen}`, blurb: 'Cheaper, nimbler machines take on another slice of the remaining work.', changes: ['Robot cost ×0.7', 'Robots can do +5% of jobs'], fx: P => { P.robotCost *= 0.7; P.autoFrac = Math.min(0.98, P.autoFrac + 0.05); } },
    { title: `Solar generation ${gen}`, blurb: 'Panels get cheaper again; new appliances and agents want every watt.', changes: ['Solar cost ×0.7', 'Energy appetite +20%'], fx: P => { P.solarCost *= 0.7; P.homeE *= 1.2; } },
  ];
  return { id: 'gen' + k, tier: 99, generated: true, ...kinds[n % 3] };
}
