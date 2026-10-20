// ---------- people, projects, creations ----------
const RES_IDS = ['mara', 'teo', 'juno', 'odile'];

const RES = {
  mara: {
    name: 'Mara Okafor', short: 'Mara', age: 38, job: 'Warehouse picker, double shifts', home: 'mara', wage: 16, commute: 1.5,
    base: { housing: 66, food: 38, power: 14, transport: 18, other: 0 }, otherLabel: 'Other',
    look: { skin: '#7b4a32', hair: '#1d1512', hairStyle: 'wrap', wrap: '#c86a34', outfit: '#c8b54e', freeOutfit: '#d9773f', pants: '#454a58', vest: true },
    personality: 'Warm and quick, frayed at the edges. Raising her son Pip on her own.',
    pressure: 'Ten-hour shifts at the warehouse. Food and power bills keep her on the 6:45 bus.',
    interest: "Baking her grandmother's cardamom bread.", icon: 'bread', energy: 28, color: '#e0874a',
  },
  teo: {
    name: 'Teo Marchetti', short: 'Teo', age: 61, job: 'Delivery driver', home: 'teo', wage: 15, commute: 0.5,
    base: { housing: 50, food: 26, power: 12, transport: 40, other: 0 }, otherLabel: 'Other',
    look: { skin: '#c49a72', hair: '#bdb5ab', hairStyle: 'cap', cap: '#5c4a3a', outfit: '#7b5b3f', freeOutfit: '#5f7f4b', pants: '#3e3a36', mustache: true },
    personality: 'Gruff, practical, secretly sentimental. Knows engines and soil.',
    pressure: 'His old delivery van eats half of what he earns in repairs and fuel.',
    interest: "Bringing back Rosa's garden: purple Sicilian artichokes.", icon: 'sprout', energy: 32, color: '#8aa45a',
  },
  juno: {
    name: 'Juno Park', short: 'Juno', age: 26, job: 'Barista by day, image-labeling gig by night', home: 'juno', wage: 13, commute: 1,
    base: { housing: 58, food: 24, power: 10, transport: 12, other: 12 }, otherLabel: 'Student loan',
    look: { skin: '#e9c6a3', hair: '#1b1a22', hairStyle: 'bob', outfit: '#3e5076', freeOutfit: '#e0a93c', pants: '#2f3442' },
    personality: 'Wry, anxious, kind. Carries a sketchbook she never opens.',
    pressure: 'Two jobs to make rent and the student loan. Sleeps five hours.',
    interest: 'Drawing. She used to sketch everything she saw.', icon: 'pencil', energy: 26, color: '#6f8fd0',
  },
  odile: {
    name: 'Odile Brandt', short: 'Odile', age: 64, job: 'Runs the corner store', home: 'store', wage: 12, commute: 0,
    base: { housing: 44, food: 24, power: 28, transport: 12, other: 0 }, otherLabel: 'Other',
    look: { skin: '#f1cdb8', hair: '#ebe5df', hairStyle: 'bun', outfit: '#93678a', freeOutfit: '#c4506a', pants: '#4a3f4f', glasses: true },
    personality: 'Careful with money, sharp-tongued, quietly generous. Has some savings.',
    pressure: 'The store freezers cost more than her house. She keeps it open twelve hours to stay afloat.',
    interest: "Her father's accordion. She knows three songs.", icon: 'music', energy: 34, color: '#c46a9a',
  },
};

const OWNER_COLORS = { mara: '#e0874a', teo: '#8aa45a', juno: '#6f8fd0', odile: '#c46a9a', commons: '#e8c25a', brightline: '#8b93a3' };
const OWNER_NAMES = { mara: 'Mara', teo: 'Teo', juno: 'Juno', odile: 'Odile', commons: 'Commons Fund', brightline: 'Brightline Co.' };

const PROJECTS = {
  solar: {
    name: 'Community Solar', icon: 'sun', parts: 80, op: 14, revenue: 90, lot: 'solar',
    blurb: 'Panels on Sunfield meadow power every home on the street. The surplus is sold to the regional grid.',
    service: 'Household electricity: bills drop to a $2 connection fee.',
    output: 'Electricity for 4 homes + surplus sales',
    styles: [
      { id: 'pergola', name: 'Terracotta pergola', desc: 'Panels on a timber pergola with climbing vines underneath.' },
      { id: 'rows', name: 'Meadow rows', desc: 'Low rows with wildflowers growing between them.' },
      { id: 'leaf', name: "Juno's leaf canopy", desc: 'Panels shaped like leaves on curved stems. Juno sketched it.', requires: 'junoLeaf' },
    ],
    upgrades: [
      { id: 'battery', name: 'Battery bank', parts: 20, revenue: 45, idea: 'odile', desc: 'Stores midday sun and sells it at six in the evening, when power is dear.' },
      { id: 'canopy', name: 'Plaza canopy', parts: 28, revenue: 55, idea: 'juno', desc: 'A solar shade over the plaza: more power, and a cool place to sit.' },
    ],
    options: ['equal', 'need', 'odile', 'brightline'],
  },
  workshop: {
    name: 'Robot Workshop', icon: 'wrench', parts: 100, op: 24, revenue: 180, fab: 18, lot: 'workshop',
    blurb: "Teo teaches the old service robots to fix things. They take repair orders from across the valley and make parts for the town's next projects.",
    service: 'Repairs and transport cost 65% less. Helper robots take an hour of chores off every household, every day.',
    output: 'Repair orders + 18 parts/day for the town',
    styles: [
      { id: 'brick', name: 'Brick and copper', desc: 'Old-school: brick walls, copper roof, big warm windows.' },
      { id: 'glass', name: 'Glass workshop', desc: 'Light and open, so anyone walking by can watch the robots work.' },
    ],
    upgrades: [
      { id: 'bay', name: 'Second repair bay', parts: 28, revenue: 95, fab: 10, idea: 'teo', desc: 'Twice the repair capacity, and ten more parts a day.' },
      { id: 'bikes', name: 'Cargo bike fleet', parts: 18, revenue: 0, idea: 'mara', desc: 'Shared electric cargo bikes. Transport costs fall by another 40%.' },
    ],
    options: ['equal', 'need', 'odile', 'brightline'],
  },
  greenhouse: {
    name: 'Automated Greenhouse', icon: 'sprout', parts: 90, op: 12, revenue: 50, lot: 'greenhouse',
    blurb: 'Robot-tended beds under glass on the overgrown lot. Fresh food for every household, and the extra sold at the valley market.',
    service: 'Fresh food for every household: food bills fall by half.',
    output: 'Vegetables for 4 homes + market sales',
    styles: [
      { id: 'victorian', name: 'Arched glasshouse', desc: 'White ironwork arches and tall panes.' },
      { id: 'dome', name: 'Geodesic dome', desc: 'A bright faceted dome. Juno says it looks like a beehive.' },
    ],
    upgrades: [
      { id: 'aqua', name: 'Aquaponics tanks', parts: 20, revenue: 30, idea: 'juno', desc: 'Fish and greens grown together. More produce to sell; food bills fall another 20%.' },
    ],
    options: ['equal', 'need'],
  },
  compute: {
    name: 'Community Compute', icon: 'wrench', parts: 60, op: 10, revenue: 120, lot: 'compute', side: true,
    blurb: "Server racks in a shed beside the old rail depot, running on the street's own sunlight. The valley rents time on them for AI work, and whoever owns the racks owns what they earn.",
    service: "The town runs its own models. Juno's image-labeling gig for a city AI company is no longer needed. Racks draw power from the array, which is cheap only if the street owns the array.",
    output: 'Compute time rented to the valley',
    styles: [
      { id: 'shed', name: 'Timber server shed', desc: 'Plain boards, louvered vents, a vine climbing toward the warm air.' },
      { id: 'glass', name: 'Glass server house', desc: 'Glass walls, so anyone walking past can watch the racks blink.' },
    ],
    upgrades: [
      { id: 'heat', name: 'Heat reuse loop', parts: 18, revenue: 30, idea: 'teo', desc: "Pipes the racks' waste heat to the greenhouse. Less cooling, more to sell." },
    ],
    options: ['equal', 'need', 'odile', 'brightline'],
  },
};

const OWNERSHIP = {
  equal: { name: 'Neighborhood co-op', tag: 'Equal shares', desc: 'Every household owns an equal share. 20% goes to the Commons Fund for upkeep and future projects.' },
  need: { name: 'Co-op, weighted by need', tag: 'Need-weighted', desc: 'Households still short of their essentials get bigger shares. 20% goes to the Commons Fund.' },
  odile: { name: "Odile's investment", tag: 'Investor-led', desc: 'Odile pays for half the parts from her savings and takes half the shares. The rest is split among the others and the Commons Fund.' },
  brightline: { name: 'Brightline Co. builds it', tag: 'Outside company', desc: 'A company from the city pays for everything, sets the prices and keeps the profits. Residents get an introductory discount. 5% goes to the Commons Fund.' },
};

const CREATIONS = {
  kitchen: {
    name: 'Shared Kitchen', lot: 'kitchen', base: 25, who: 'mara',
    blurb: 'Turn the empty terrace into a kitchen anyone can use.',
    features: [
      { id: 'oven', name: 'Wood-fired bread oven', who: 'mara', parts: 15 },
      { id: 'table', name: 'Long shared table', who: 'odile', parts: 10 },
      { id: 'herbs', name: 'Herb and lemon garden', who: 'teo', parts: 10 },
      { id: 'mural', name: 'Mural wall', who: 'juno', parts: 10 },
    ],
  },
  garden: {
    name: 'Waterfall Garden', lot: 'garden', base: 30, who: 'juno',
    blurb: 'A quiet garden on the overlook, where the falls catch the morning light.',
    features: [
      { id: 'stones', name: 'Stepping stones', who: null, parts: 8 },
      { id: 'bench', name: 'Sketching bench', who: 'juno', parts: 8 },
      { id: 'lanterns', name: 'Lantern path', who: null, parts: 10 },
      { id: 'meadow', name: 'Wildflower meadow', who: 'teo', parts: 8 },
    ],
  },
  pavilion: {
    name: 'Music Pavilion', lot: 'pavilion', base: 35, who: 'odile',
    blurb: 'A little stage on the plaza green for evenings with music.',
    features: [
      { id: 'floor', name: 'Dance floor', who: null, parts: 10 },
      { id: 'lights', name: 'String lights', who: null, parts: 8 },
      { id: 'stage', name: 'Accordion stage', who: 'odile', parts: 10 },
      { id: 'racks', name: 'Bike racks and repair stand', who: 'teo', parts: 8 },
    ],
  },
};
const STYLES = [
  { id: 'villa', name: 'Terracotta villa', desc: 'Warm stone, arches, red tile and climbing vines.' },
  { id: 'cottage', name: 'Garden cottage', desc: 'Timber beams, a mossy roof, flower boxes everywhere.' },
  { id: 'future', name: 'Sunlit pavilion', desc: 'White curves, glass and solar fins.' },
];
const APPROACHES = {
  robots: { name: 'Robots build it', nights: 1, desc: 'Fast. The robots do all the work overnight.' },
  together: { name: 'Build it together', nights: 2, desc: 'Neighbors work alongside the robots after their shifts. Friendships grow.' },
  assist: { name: 'Robots assist', nights: 2, desc: 'Neighbors build; robots lift and fetch. Friendships grow.' },
  hand: { name: 'By hand', nights: 3, desc: 'People make it themselves while robots carry materials. Slower, and it will mean more.' },
};

const SALVAGE = {
  depot: { name: 'Old rail depot', parts: 60, poi: 'depotSalvage', text: 'A stack of solar panels from a cancelled station roof, still in their crates.', unlock: 'solar' },
  garage: { name: 'Robots in your garage', parts: 40, poi: 'garageSalvage', text: 'Three retired service robots. Rusty, but the motors are good.', unlock: 'workshop' },
  tower: { name: 'Water tower', parts: 25, poi: 'towerSalvage', text: 'Copper pipe and a pump motor from the old water tower.', unlock: 'workshop' },
  river: { name: 'Riverbank scrap', parts: 15, poi: 'riverSalvage', text: 'An old bridge winch and a tangle of cable in the reeds.', unlock: 'workshop' },
  frames: { name: 'Greenhouse frames', parts: 30, poi: 'framesSalvage', text: 'Steel greenhouse frames buried in brambles. Someone had a plan, once.', unlock: 'greenhouse' },
};

const WEATHER = {
  sunny: { name: 'Sunny', solar: 1.0, icon: 'sun' },
  cloudy: { name: 'Cloudy', solar: 0.72, icon: 'cloud' },
  rain: { name: 'Rain', solar: 0.5, icon: 'rain' },
  storm: { name: 'Windstorm', solar: 0.45, icon: 'wind' },
};
