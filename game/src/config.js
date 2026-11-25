/**
 * Logical canvas dimensions, station layout, chef physics, and shift balance configuration
 * for Copper & Thyme: Bistro Rush.
 */
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const ORDER_BAR_HEIGHT = 166;
export const KITCHEN_BOUNDS = {
  left: 72,
  right: 1208,
  top: 174,
  bottom: 690,
};

export const CHEF_CONFIG = {
  radius: 21,
  moveSpeed: 420,
  interactRadius: 96,
  startX: 512,
  startY: 332,
};

export const TIMINGS = {
  chopDuration: 0.95,
  chopTapBonus: 0.28,
  skilletCookTime: 4.0,
  skilletGoldenWindow: 3.5,
  skilletWarnTime: 8.5,
  skilletBurnTime: 12.0,
  potCookTime: 4.6,
  potGoldenWindow: 4.0,
  potWarnTime: 10.5,
  potBurnTime: 14.5,
  panTossBonus: 0.22,
  panTossCooldown: 0.45,
  comboWindow: 16,
  fixedStep: 1 / 60,
};

export const SHIFTS = [
  {
    id: 'morning',
    number: 1,
    name: 'Lunch Bistro',
    subtitle: 'Steady midday tickets & fresh cold prep',
    duration: 120,
    maxOrders: 3,
    orderInterval: 11.5,
    basePatience: 56,
    vipChance: 0.14,
    recipeWeights: {
      harvest_salad: 3,
      burger: 3,
      salmon_plate: 2,
      mushroom_pasta: 2,
      steakhouse: 1,
    },
    starGoals: [130, 210, 300],
  },
  {
    id: 'golden',
    number: 2,
    name: 'Golden Hour',
    subtitle: 'VIP tables, parallel searing & brisk pace',
    duration: 135,
    maxOrders: 4,
    orderInterval: 9.6,
    basePatience: 50,
    vipChance: 0.24,
    recipeWeights: {
      harvest_salad: 2,
      burger: 3,
      salmon_plate: 3,
      mushroom_pasta: 3,
      steakhouse: 2,
    },
    starGoals: [190, 290, 400],
  },
  {
    id: 'dinner',
    number: 3,
    name: 'Dinner Rush',
    subtitle: 'Full house frenzy — plan every route!',
    duration: 150,
    maxOrders: 4,
    orderInterval: 8.2,
    basePatience: 46,
    vipChance: 0.3,
    recipeWeights: {
      harvest_salad: 1,
      burger: 3,
      salmon_plate: 3,
      mushroom_pasta: 3,
      steakhouse: 3,
    },
    starGoals: [250, 370, 500],
  },
];

/**
 * Station layout across the bistro kitchen.
 * Top row: cookware, plates, heated pass shelf, service bell, compost bin.
 * Center island: cutting boards, assembly mats, staging counter.
 * Bottom row: 7 pantry crates / crocks with distinct ingredients on the counter.
 */
export const STATIONS = [
  // Top row (y = 228)
  { id: 'plates', kind: 'plates', label: 'Plates', x: 132, y: 228, w: 92, h: 78, approachY: 304 },
  { id: 'counter-top-1', kind: 'counter', label: 'Oak Counter', x: 242, y: 228, w: 92, h: 78, approachY: 304 },
  { id: 'skillet-1', kind: 'skillet', label: 'Skillet 1', x: 374, y: 228, w: 98, h: 78, approachY: 304 },
  { id: 'skillet-2', kind: 'skillet', label: 'Skillet 2', x: 492, y: 228, w: 98, h: 78, approachY: 304 },
  { id: 'pot-1', kind: 'pot', label: 'Stockpot', x: 610, y: 228, w: 98, h: 78, approachY: 304 },
  { id: 'counter-top-2', kind: 'counter', label: 'Warm Shelf', x: 742, y: 228, w: 92, h: 78, approachY: 304 },
  { id: 'pass-ready', kind: 'pass', label: 'Pass Ready', x: 874, y: 228, w: 108, h: 78, approachY: 304 },
  { id: 'serve-bell', kind: 'bell', label: 'Serve Bell', x: 1004, y: 228, w: 104, h: 78, approachY: 304 },
  { id: 'trash', kind: 'trash', label: 'Compost', x: 1126, y: 228, w: 86, h: 78, approachY: 304 },

  // Left center chopping island & right center assembly island (with central pass-through aisle!)
  { id: 'board-1', kind: 'board', label: 'Chop Board 1', x: 268, y: 432, w: 106, h: 82, approachY: 356 },
  { id: 'board-2', kind: 'board', label: 'Chop Board 2', x: 388, y: 432, w: 106, h: 82, approachY: 356 },
  { id: 'assembly-1', kind: 'assembly', label: 'Assembly 1', x: 640, y: 432, w: 112, h: 82, approachY: 356 },
  { id: 'assembly-2', kind: 'assembly', label: 'Assembly 2', x: 770, y: 432, w: 112, h: 82, approachY: 356 },
  { id: 'counter-mid-1', kind: 'counter', label: 'Garnish Mat', x: 898, y: 432, w: 106, h: 82, approachY: 356 },

  // Bottom pantry counter (y = 634)
  { id: 'crate-bun', kind: 'crate', itemType: 'bun', label: 'Brioche', x: 174, y: 634, w: 112, h: 80, approachY: 558 },
  { id: 'crate-patty', kind: 'crate', itemType: 'patty', label: 'Patties', x: 326, y: 634, w: 112, h: 80, approachY: 558 },
  { id: 'crate-salmon', kind: 'crate', itemType: 'salmon', label: 'Salmon', x: 478, y: 634, w: 112, h: 80, approachY: 558 },
  { id: 'crate-pasta', kind: 'crate', itemType: 'pasta', label: 'Pasta', x: 630, y: 634, w: 112, h: 80, approachY: 558 },
  { id: 'crate-tomato', kind: 'crate', itemType: 'tomato', label: 'Tomatoes', x: 782, y: 634, w: 112, h: 80, approachY: 558 },
  { id: 'crate-greens', kind: 'crate', itemType: 'greens', label: 'Greens', x: 934, y: 634, w: 112, h: 80, approachY: 558 },
  { id: 'crate-mushroom', kind: 'crate', itemType: 'mushroom', label: 'Mushrooms', x: 1086, y: 634, w: 112, h: 80, approachY: 558 },
];

/**
 * Solid counter collision islands for player movement and A* pathfinding.
 */
export const COUNTER_COLLIDERS = [
  // Top counter bank
  { x: 78, y: 184, w: 1100, h: 88 },
  // Left chopping island
  { x: 208, y: 388, w: 242, h: 88 },
  // Right assembly island
  { x: 576, y: 388, w: 382, h: 88 },
  // Bottom pantry bank
  { x: 110, y: 590, w: 1040, h: 88 },
];

export const PALETTE = {
  bgDeep: '#1b1512',
  wallCream: '#f6ebd8',
  tileLight: '#f3e5cf',
  tileWarm: '#e4ceb1',
  tileGrout: '#ceb595',
  woodTop: '#c48a54',
  woodEdge: '#8a5832',
  woodDark: '#59371d',
  marbleTop: '#ebe7e1',
  marbleVein: '#d4cec6',
  copper: '#d9783b',
  copperLight: '#f3a466',
  copperDark: '#8d431b',
  brass: '#e6b84c',
  brassDark: '#9e741f',
  slate: '#26211e',
  slateCard: '#322b27',
  ticketCream: '#fff9ed',
  ticketBorder: '#d9c8aa',
  emerald: '#2ea86b',
  amber: '#e89a25',
  crimson: '#d8453b',
  gold: '#f7c948',
};
