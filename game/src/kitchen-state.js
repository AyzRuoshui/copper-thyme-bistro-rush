/**
 * Core Copper & Thyme kitchen simulation engine.
 * Pure deterministic state management for chef movement, A* click routing,
 * chopping boards, copper skillets, stockpot, mid-assembly plates, orders, and scoring.
 */
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CHEF_CONFIG,
  COUNTER_COLLIDERS,
  KITCHEN_BOUNDS,
  SHIFTS,
  STATIONS,
  TIMINGS,
} from './config.js';
import {
  INGREDIENTS,
  addIngredientToPlate,
  canBoilInPot,
  canChopOnBoard,
  canCookOnSkillet,
  createPlate,
  getRecipe,
  isPlatableIngredient,
  mergePlates,
} from './recipes.js';
import { createSeededRng, pickFrom } from './random.js';

const GRID_STEP = 20;
const GRID_COLS = Math.floor(CANVAS_WIDTH / GRID_STEP);
const GRID_ROWS = Math.floor(CANVAS_HEIGHT / GRID_STEP);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function circleIntersectsRect(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function buildWalkGrid() {
  const walkable = new Uint8Array(GRID_COLS * GRID_ROWS);
  const r = CHEF_CONFIG.radius + 5;
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const wx = col * GRID_STEP + GRID_STEP / 2;
      const wy = row * GRID_STEP + GRID_STEP / 2;
      let ok =
        wx >= KITCHEN_BOUNDS.left + r &&
        wx <= KITCHEN_BOUNDS.right - r &&
        wy >= KITCHEN_BOUNDS.top + r &&
        wy <= KITCHEN_BOUNDS.bottom - r;
      if (ok) {
        for (const rect of COUNTER_COLLIDERS) {
          if (circleIntersectsRect(wx, wy, r, rect)) {
            ok = false;
            break;
          }
        }
      }
      walkable[row * GRID_COLS + col] = ok ? 1 : 0;
    }
  }
  return walkable;
}

const WALK_GRID = buildWalkGrid();

function findNearestWalkableCell(wx, wy) {
  const startCol = clamp(Math.floor(wx / GRID_STEP), 0, GRID_COLS - 1);
  const startRow = clamp(Math.floor(wy / GRID_STEP), 0, GRID_ROWS - 1);
  if (WALK_GRID[startRow * GRID_COLS + startCol]) return [startCol, startRow];
  let best = null;
  let bestDist = Infinity;
  for (let dr = -4; dr <= 4; dr += 1) {
    for (let dc = -4; dc <= 4; dc += 1) {
      const nr = startRow + dr;
      const nc = startCol + dc;
      if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
      if (!WALK_GRID[nr * GRID_COLS + nc]) continue;
      const d = dr * dr + dc * dc;
      if (d < bestDist) {
        bestDist = d;
        best = [nc, nr];
      }
    }
  }
  return best ?? [startCol, startRow];
}

/**
 * Compute short path waypoints from (sx, sy) to (tx, ty) around the kitchen island.
 */
export function computeKitchenPath(sx, sy, tx, ty) {
  const [sc, sr] = findNearestWalkableCell(sx, sy);
  const [tc, tr] = findNearestWalkableCell(tx, ty);
  const total = GRID_COLS * GRID_ROWS;
  const gScore = new Float32Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const startIdx = sr * GRID_COLS + sc;
  const targetIdx = tr * GRID_COLS + tc;
  gScore[startIdx] = 0;

  const open = [startIdx];
  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [-1, 1, 1.414],
    [1, -1, 1.414],
    [-1, -1, 1.414],
  ];

  while (open.length > 0) {
    let bestPos = 0;
    let bestF = Infinity;
    for (let i = 0; i < open.length; i += 1) {
      const idx = open[i];
      const col = idx % GRID_COLS;
      const row = Math.floor(idx / GRID_COLS);
      const h = Math.hypot(tc - col, tr - row);
      const f = gScore[idx] + h;
      if (f < bestF) {
        bestF = f;
        bestPos = i;
      }
    }
    const curr = open.splice(bestPos, 1)[0];
    if (curr === targetIdx) break;
    if (closed[curr]) continue;
    closed[curr] = 1;

    const cc = curr % GRID_COLS;
    const cr = Math.floor(curr / GRID_COLS);
    for (const [dc, dr, cost] of dirs) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
      const nIdx = nr * GRID_COLS + nc;
      if (!WALK_GRID[nIdx] || closed[nIdx]) continue;
      // Avoid diagonal corner clipping
      if (dc !== 0 && dr !== 0) {
        if (!WALK_GRID[cr * GRID_COLS + nc] || !WALK_GRID[nr * GRID_COLS + cc]) continue;
      }
      const nextG = gScore[curr] + cost;
      if (nextG < gScore[nIdx]) {
        gScore[nIdx] = nextG;
        parent[nIdx] = curr;
        open.push(nIdx);
      }
    }
  }

  if (parent[targetIdx] === -1 && targetIdx !== startIdx) {
    return [{ x: tx, y: ty }];
  }

  const cells = [];
  let walk = targetIdx;
  while (walk !== -1 && walk !== startIdx) {
    const col = walk % GRID_COLS;
    const row = Math.floor(walk / GRID_COLS);
    cells.push({ x: col * GRID_STEP + GRID_STEP / 2, y: row * GRID_STEP + GRID_STEP / 2 });
    walk = parent[walk];
  }
  cells.reverse();
  if (cells.length > 0) {
    cells[cells.length - 1] = { x: tx, y: ty };
  }
  return cells;
}

function createInitialStations() {
  return STATIONS.map((def) => ({
    ...def,
    item: null,
    progress: 0,
    cookElapsed: 0,
    cookState: 'idle', // 'idle' | 'cooking' | 'ready' | 'warning' | 'burnt'
    tossCooldown: 0,
    pulseTimer: 0,
  }));
}

export class KitchenSimulation {
  constructor(seed = 20261125, events = null) {
    this.baseSeed = seed;
    this.events = events;
    this.shiftIndex = 0;
    this.bestScores = [0, 0, 0];
    this.mode = 'title'; // 'title' | 'playing' | 'paused' | 'recipes' | 'summary'
    this.returnMode = 'title';
    this.reset(0, 'title');
  }

  emit(name, payload = {}) {
    if (this.events && typeof this.events === 'function') {
      this.events(name, payload);
    }
  }

  reset(shiftIndex = this.shiftIndex, mode = 'playing') {
    this.shiftIndex = clamp(shiftIndex, 0, SHIFTS.length - 1);
    const shift = SHIFTS[this.shiftIndex];
    this.rng = createSeededRng(this.baseSeed + this.shiftIndex * 997);
    this.mode = mode;
    this.returnMode = mode;

    this.shift = shift;
    this.timeLeft = shift.duration;
    this.elapsed = 0;
    this.score = 0;
    this.tipsEarned = 0;
    this.dishesServed = 0;
    this.ordersExpired = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboTimer = 0;
    this.nextTicketNumber = 101;
    this.orderSpawnTimer = 2.5;

    this.chef = {
      x: CHEF_CONFIG.startX,
      y: CHEF_CONFIG.startY,
      vx: 0,
      vy: 0,
      dirX: 0,
      dirY: 1,
      walkCycle: 0,
      holding: null,
      chopSwing: 0,
      happyTimer: 0,
      autoTarget: null, // { stationId, action: 'interact' | 'work', waypoints: [] }
    };

    this.stations = createInitialStations();
    this.stationMap = new Map(this.stations.map((s) => [s.id, s]));
    this.orders = [];
    this.particles = [];
    this.popups = [];
    this.toast = null;

    this.spawnOrder(true);
    this.spawnOrder(false);
    if (mode === 'title') {
      this.stageTitleShowcase();
    }
  }

  /**
   * Populate a lively kitchen diorama behind the title menu so the kitchen
   * always looks active and appetizing on startup.
   */
  stageTitleShowcase() {
    this.getStation('skillet-1').item = { kind: 'ingredient', type: 'patty_seared', perfect: true };
    this.getStation('skillet-1').cookState = 'ready';
    this.getStation('skillet-1').cookElapsed = TIMINGS.skilletCookTime + 0.6;
    this.getStation('pot-1').item = { kind: 'ingredient', type: 'pasta' };
    this.getStation('pot-1').cookState = 'cooking';
    this.getStation('pot-1').cookElapsed = 2.4;
    this.getStation('pot-1').progress = 0.52;
    this.getStation('assembly-1').item = createPlate(['bun', 'greens_chopped'], 0);
    this.getStation('pass-ready').item = createPlate(['salmon_seared', 'greens_chopped', 'tomato_diced'], 1);
  }

  getStation(id) {
    return this.stationMap.get(id) ?? null;
  }

  showToast(text, tone = 'info', duration = 1.6) {
    this.toast = { text, tone, timer: duration, max: duration };
  }

  addPopup(x, y, text, color = '#fff7df', size = 18) {
    this.popups.push({ x, y, vy: -46, text, color, size, life: 1.25, maxLife: 1.25 });
  }

  addParticle(x, y, vx, vy, color, radius = 4, life = 0.6, kind = 'spark') {
    this.particles.push({ x, y, vx, vy, color, radius, life, maxLife: life, kind });
  }

  pickWeightedRecipe() {
    const weights = this.shift.recipeWeights;
    const pool = [];
    for (const [id, count] of Object.entries(weights)) {
      for (let i = 0; i < count; i += 1) pool.push(id);
    }
    return getRecipe(pickFrom(pool, this.rng));
  }

  spawnOrder(initialEasy = false) {
    if (this.orders.length >= this.shift.maxOrders) return null;
    const recipe = initialEasy ? getRecipe('burger') : this.pickWeightedRecipe();
    const vip = !initialEasy && this.rng() < this.shift.vipChance;
    const patience = (vip ? this.shift.basePatience * 0.85 : this.shift.basePatience) + (this.rng() * 6 - 3);
    const tableNum = 1 + Math.floor(this.rng() * 8);
    const order = {
      id: `ord-${this.nextTicketNumber}`,
      ticketNumber: this.nextTicketNumber,
      tableNum,
      recipeId: recipe.id,
      vip,
      value: vip ? Math.round(recipe.price * 1.5) : recipe.price,
      timeLeft: patience,
      maxTime: patience,
      pulse: 0,
    };
    this.nextTicketNumber += 1;
    this.orders.push(order);
    return order;
  }

  getNearestInteractableStation() {
    let best = null;
    let bestScore = Infinity;
    const reach = CHEF_CONFIG.interactRadius;
    for (const st of this.stations) {
      const dx = st.x - this.chef.x;
      const dy = st.y - this.chef.y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach) continue;
      // Bias slightly toward the station the chef is facing
      const dot = dist > 1 ? (dx * this.chef.dirX + dy * this.chef.dirY) / dist : 1;
      const score = dist - dot * 14;
      if (score < bestScore) {
        bestScore = score;
        best = st;
      }
    }
    return best;
  }

  findStationAtPoint(px, py) {
    for (const st of this.stations) {
      const halfW = st.w / 2 + 6;
      const halfH = st.h / 2 + 8;
      if (px >= st.x - halfW && px <= st.x + halfW && py >= st.y - halfH && py <= st.y + halfH) {
        return st;
      }
    }
    return null;
  }

  queueWalkToStation(station, action = 'interact') {
    if (!station || this.mode !== 'playing') return;
    const dist = Math.hypot(station.x - this.chef.x, station.y - this.chef.y);
    if (dist <= CHEF_CONFIG.interactRadius - 6) {
      this.chef.autoTarget = null;
      if (action === 'work') {
        this.workAtStation(station, true);
      } else {
        this.interactWithStation(station);
      }
      return;
    }
    const targetX = station.x;
    const isCenterIsland = station.y > 320 && station.y < 540;
    const targetY = isCenterIsland
      ? (this.chef.y < station.y ? 356 : 508)
      : station.approachY;
    const waypoints = computeKitchenPath(this.chef.x, this.chef.y, targetX, targetY);
    this.chef.autoTarget = { stationId: station.id, action, waypoints };
  }

  clearAutoWalk() {
    this.chef.autoTarget = null;
  }

  /**
   * Perform active work (chopping on board or tossing skillet / stirring pot) at a station.
   */
  workAtStation(station = this.getNearestInteractableStation(), isTap = true) {
    if (!station || this.mode !== 'playing') return false;
    if (station.kind === 'board' && station.item && station.item.kind === 'ingredient' && canChopOnBoard(station.item.type)) {
      const delta = isTap ? TIMINGS.chopTapBonus : 0;
      station.progress = clamp(station.progress + delta, 0, 1);
      this.chef.chopSwing = 0.22;
      this.emit('chop', { station });
      for (let i = 0; i < 4; i += 1) {
        const ang = (this.rng() - 0.5) * Math.PI * 1.4;
        const spd = 45 + this.rng() * 55;
        this.addParticle(
          station.x + (this.rng() - 0.5) * 20,
          station.y - 6,
          Math.cos(ang) * spd,
          Math.sin(ang) * spd - 30,
          INGREDIENTS[station.item.type].color,
          3.2,
          0.38,
          'crumb',
        );
      }
      if (station.progress >= 1) {
        const targetType = INGREDIENTS[station.item.type].target;
        station.item = { kind: 'ingredient', type: targetType, perfect: false };
        station.progress = 0;
        station.pulseTimer = 0.4;
        this.addPopup(station.x, station.y - 26, INGREDIENTS[targetType].short + '!', '#88f7a6', 15);
        this.emit('chopDone', { station });
      }
      return true;
    }

    if ((station.kind === 'skillet' || station.kind === 'pot') && station.item && station.cookState === 'cooking') {
      if (station.tossCooldown <= 0) {
        const cookTotal = station.kind === 'skillet' ? TIMINGS.skilletCookTime : TIMINGS.potCookTime;
        station.cookElapsed = Math.min(cookTotal, station.cookElapsed + cookTotal * TIMINGS.panTossBonus);
        station.progress = clamp(station.cookElapsed / cookTotal, 0, 1);
        station.tossCooldown = TIMINGS.panTossCooldown;
        this.chef.chopSwing = 0.2;
        this.emit('toss', { station });
        for (let i = 0; i < 5; i += 1) {
          this.addParticle(
            station.x + (this.rng() - 0.5) * 22,
            station.y - 10,
            (this.rng() - 0.5) * 60,
            -55 - this.rng() * 45,
            station.kind === 'skillet' ? '#ffbe4d' : '#d6f2ff',
            3.5,
            0.45,
            'steam',
          );
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Primary station interaction (pick up, place, plate, serve, discard).
   */
  interactWithStation(station = this.getNearestInteractableStation()) {
    if (!station || this.mode !== 'playing') return false;
    const held = this.chef.holding;

    // 1. Serving Bell Window
    if (station.kind === 'bell') {
      if (held && held.kind === 'plate' && held.complete) {
        return this.servePlate(held, () => {
          this.chef.holding = null;
        }, station);
      }
      const passStation = this.getStation('pass-ready');
      if (passStation?.item && passStation.item.kind === 'plate' && passStation.item.complete) {
        return this.servePlate(passStation.item, () => {
          passStation.item = null;
        }, station);
      }
      if (held && held.kind === 'plate' && !held.complete) {
        this.showToast('Dish needs 3 ingredients before serving!', 'warn');
        return false;
      }
      this.showToast('Bring a completed dish to ring the service bell!', 'info');
      return false;
    }

    // 2. Heated Pass Shelf (can stage or immediately serve a completed dish)
    if (station.kind === 'pass') {
      if (!held && station.item && station.item.kind === 'plate' && station.item.complete) {
        return this.servePlate(station.item, () => {
          station.item = null;
        }, station);
      }
      if (held && held.kind === 'plate' && held.complete && !station.item) {
        station.item = held;
        this.chef.holding = null;
        station.pulseTimer = 0.5;
        this.emit('plate', { station });
        this.showToast('Plated on Pass! Ring Bell or click Pass to serve!', 'good');
        return true;
      }
      if (held && held.kind === 'plate' && !held.complete) {
        this.showToast('Finish assembling on the island before the Pass!', 'warn');
        return false;
      }
      if (held && !station.item) {
        this.showToast('Only completed dishes go on the Heated Pass!', 'warn');
        return false;
      }
      if (!held && station.item) {
        this.chef.holding = station.item;
        station.item = null;
        return true;
      }
      return false;
    }

    // 3. Compost / Scrap Bin
    if (station.kind === 'trash') {
      if (held) {
        this.chef.holding = null;
        station.pulseTimer = 0.35;
        this.emit('trash', { station });
        this.addPopup(station.x, station.y - 24, 'Cleared', '#d0c2b4', 14);
        return true;
      }
      return false;
    }

    // 4. Clean Plate Stack
    if (station.kind === 'plates') {
      if (!held) {
        this.chef.holding = createPlate([], 0);
        this.emit('pickup', { station });
        return true;
      }
      if (held.kind === 'ingredient' && isPlatableIngredient(held.type)) {
        const nextPlate = addIngredientToPlate(createPlate([], 0), held);
        if (nextPlate) {
          this.chef.holding = nextPlate;
          this.emit('plate', { station });
          return true;
        }
      }
      if (held.kind === 'plate' && held.ingredients.length === 0) {
        this.chef.holding = null;
        return true;
      }
      return false;
    }

    // 5. Ingredient Crates
    if (station.kind === 'crate') {
      if (!held) {
        this.chef.holding = { kind: 'ingredient', type: station.itemType, perfect: false };
        station.pulseTimer = 0.25;
        this.emit('pickup', { station });
        return true;
      }
      if (held.kind === 'ingredient' && held.type === station.itemType) {
        this.chef.holding = null;
        return true;
      }
      if (held.kind === 'plate' && !held.complete && isPlatableIngredient(station.itemType)) {
        const next = addIngredientToPlate(held, { kind: 'ingredient', type: station.itemType, perfect: false });
        if (next) {
          this.chef.holding = next;
          this.emit('plate', { station });
          return true;
        }
      }
      this.showToast('Hands full! Place item on a counter or board first.', 'warn');
      return false;
    }

    // 6. Cutting Boards
    if (station.kind === 'board') {
      if (station.item && station.item.kind === 'ingredient' && canChopOnBoard(station.item.type)) {
        if (!held) {
          return this.workAtStation(station, true);
        }
      }
      if (!held && station.item) {
        this.chef.holding = station.item;
        station.item = null;
        station.progress = 0;
        this.emit('pickup', { station });
        return true;
      }
      if (held && held.kind === 'plate' && station.item && station.item.kind === 'ingredient' && isPlatableIngredient(station.item.type)) {
        const plated = addIngredientToPlate(held, station.item);
        if (plated) {
          this.chef.holding = plated;
          station.item = null;
          station.progress = 0;
          this.emit('plate', { station });
          return true;
        }
        this.showToast("Those ingredients don't combine!", 'warn');
        return false;
      }
      if (held && held.kind === 'ingredient' && canChopOnBoard(held.type) && !station.item) {
        station.item = held;
        station.progress = 0;
        this.chef.holding = null;
        this.emit('place', { station });
        return true;
      }
      if (held && held.kind === 'ingredient' && !canChopOnBoard(held.type) && !station.item) {
        this.showToast(`${INGREDIENTS[held.type].name} cannot be chopped!`, 'warn');
        return false;
      }
      return false;
    }

    // 7. Copper Skillets & Stockpot
    if (station.kind === 'skillet' || station.kind === 'pot') {
      const accepts = station.kind === 'skillet' ? canCookOnSkillet : canBoilInPot;
      if (held && held.kind === 'ingredient' && accepts(held.type) && !station.item) {
        station.item = held;
        station.cookElapsed = 0;
        station.progress = 0;
        station.cookState = 'cooking';
        station.tossCooldown = 0;
        this.chef.holding = null;
        this.emit('place', { station });
        return true;
      }
      if (held && held.kind === 'plate' && station.item && station.item.kind === 'ingredient' && isPlatableIngredient(station.item.type)) {
        const plated = addIngredientToPlate(held, station.item);
        if (plated) {
          const wasPerfect = station.item.perfect;
          this.chef.holding = plated;
          station.item = null;
          station.progress = 0;
          station.cookElapsed = 0;
          station.cookState = 'idle';
          this.emit('plate', { station });
          if (wasPerfect) this.addPopup(station.x, station.y - 26, 'Chef Kiss +$6!', '#ffd666', 15);
          return true;
        }
      }
      if (!held && station.item) {
        if (station.cookState === 'cooking') {
          return this.workAtStation(station, true);
        }
        this.chef.holding = station.item;
        const wasPerfect = station.item.perfect;
        station.item = null;
        station.progress = 0;
        station.cookElapsed = 0;
        station.cookState = 'idle';
        this.emit('pickup', { station });
        if (wasPerfect) this.addPopup(station.x, station.y - 26, 'Perfect Sear!', '#ffd666', 14);
        return true;
      }
      if (held && held.kind === 'ingredient' && !accepts(held.type) && !station.item) {
        this.showToast(
          station.kind === 'skillet' ? 'Skillets sear Patties and Salmon!' : 'Stockpot boils Tagliatelle Pasta!',
          'warn',
        );
        return false;
      }
      return false;
    }

    // 8. Assembly Mats & General Counters
    if (station.kind === 'assembly' || station.kind === 'counter') {
      return this.interactWithPrepOrAssembly(station);
    }

    return false;
  }

  interactWithPrepOrAssembly(station) {
    const held = this.chef.holding;
    const onStation = station.item;

    // Pick up from station when hands empty
    if (!held && onStation) {
      this.chef.holding = onStation;
      station.item = null;
      this.emit('pickup', { station });
      return true;
    }

    // Place held item onto empty station (automatically sets a plate if assembly station & platable)
    if (held && !onStation) {
      if (held.kind === 'ingredient' && station.kind === 'assembly') {
        if (!isPlatableIngredient(held.type)) {
          this.showToast(`Prep ${INGREDIENTS[held.type].name} on the ${INGREDIENTS[held.type].prep} first!`, 'warn');
          return false;
        }
        station.item = addIngredientToPlate(createPlate([], 0), held);
        this.chef.holding = null;
        station.pulseTimer = 0.35;
        this.emit('plate', { station });
        return true;
      }
      station.item = held;
      this.chef.holding = null;
      station.pulseTimer = 0.25;
      this.emit('place', { station });
      return true;
    }

    // Both hands and station occupied -> try combining onto a plate!
    if (held && onStation) {
      // Case A: Station holds a plate, chef holds a prepared ingredient
      if (onStation.kind === 'plate' && held.kind === 'ingredient') {
        if (!isPlatableIngredient(held.type)) {
          this.showToast(`Prep ${INGREDIENTS[held.type].name} first!`, 'warn');
          return false;
        }
        const combined = addIngredientToPlate(onStation, held);
        if (combined) {
          station.item = combined;
          this.chef.holding = null;
          station.pulseTimer = 0.45;
          this.emit('plate', { station });
          if (combined.complete) {
            const recipe = getRecipe(combined.recipeId);
            this.addPopup(station.x, station.y - 30, `${recipe.shortName} Ready!`, '#ffe278', 16);
          }
          return true;
        }
        this.showToast("That ingredient doesn't match this dish!", 'warn');
        return false;
      }

      // Case B: Chef holds a plate, station holds a prepared ingredient
      if (held.kind === 'plate' && onStation.kind === 'ingredient') {
        if (!isPlatableIngredient(onStation.type)) {
          this.showToast(`Prep ${INGREDIENTS[onStation.type].name} first!`, 'warn');
          return false;
        }
        const combined = addIngredientToPlate(held, onStation);
        if (combined) {
          this.chef.holding = combined;
          station.item = null;
          station.pulseTimer = 0.45;
          this.emit('plate', { station });
          return true;
        }
        this.showToast("That ingredient doesn't match this dish!", 'warn');
        return false;
      }

      // Case C: Both hold compatible partial plates
      if (held.kind === 'plate' && onStation.kind === 'plate') {
        const merged = mergePlates(onStation, held);
        if (merged) {
          station.item = merged;
          this.chef.holding = null;
          station.pulseTimer = 0.45;
          this.emit('plate', { station });
          return true;
        }
      }
    }
    return false;
  }

  servePlate(plate, clearSourceFn, station) {
    if (!plate || plate.kind !== 'plate' || !plate.complete || !plate.recipeId) return false;
    // Pick earliest-expiring matching ticket
    let targetIdx = -1;
    for (let i = 0; i < this.orders.length; i += 1) {
      if (this.orders[i].recipeId === plate.recipeId) {
        if (targetIdx === -1 || this.orders[i].timeLeft < this.orders[targetIdx].timeLeft) {
          targetIdx = i;
        }
      }
    }
    if (targetIdx === -1) {
      const recipe = getRecipe(plate.recipeId);
      this.showToast(`No ticket for ${recipe.shortName} yet!`, 'warn');
      return false;
    }

    const order = this.orders.splice(targetIdx, 1)[0];
    clearSourceFn();

    const ratio = clamp(order.timeLeft / order.maxTime, 0, 1);
    const speedTip = ratio > 0.6 ? 8 : ratio > 0.35 ? 4 : 0;
    const qualityTip = (plate.perfectCount ?? 0) * 6;
    const nextCombo = this.comboTimer > 0 ? Math.min(5, this.combo + 1) : 1;
    this.combo = nextCombo;
    this.bestCombo = Math.max(this.bestCombo, nextCombo);
    this.comboTimer = TIMINGS.comboWindow;

    const comboBonus = (nextCombo - 1) * 5;
    const earned = order.value + speedTip + qualityTip + comboBonus;
    this.score += earned;
    this.tipsEarned += speedTip + qualityTip + comboBonus;
    this.dishesServed += 1;
    this.chef.happyTimer = 0.7;
    station.pulseTimer = 0.7;

    if (this.score > this.bestScores[this.shiftIndex]) {
      this.bestScores[this.shiftIndex] = this.score;
    }

    const comboLabel = nextCombo > 1 ? ` x${nextCombo}!` : '!';
    this.addPopup(station.x, station.y - 34, `+$${earned}${comboLabel}`, '#8affaa', 21);
    for (let i = 0; i < 14; i += 1) {
      const ang = (Math.PI * 2 * i) / 14;
      const spd = 65 + this.rng() * 75;
      this.addParticle(
        station.x,
        station.y - 10,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd - 35,
        i % 2 === 0 ? '#ffd75e' : '#7ef2a4',
        4.2,
        0.75,
        'spark',
      );
    }
    this.emit('serve', { order, earned, combo: nextCombo });

    if (this.orders.length === 0) {
      this.orderSpawnTimer = Math.min(this.orderSpawnTimer, 1.4);
    }
    return true;
  }

  /**
   * Advance the simulation by `dt` seconds given movement axis & action flags.
   */
  step(dt, controls = {}) {
    if (this.mode !== 'playing') {
      this.stepAmbientAnimations(dt);
      return;
    }

    this.elapsed += dt;
    this.timeLeft = Math.max(0, this.timeLeft - dt);

    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) this.combo = 0;
    }

    if (this.toast) {
      this.toast.timer -= dt;
      if (this.toast.timer <= 0) this.toast = null;
    }

    this.stepChefMovement(dt, controls);
    this.stepStations(dt, Boolean(controls.workHeld));
    this.stepOrders(dt);
    this.stepParticles(dt);

    if (this.timeLeft <= 0) {
      this.mode = 'summary';
      this.emit('shiftEnd', { score: this.score, dishesServed: this.dishesServed });
    }
  }

  stepAmbientAnimations(dt) {
    this.elapsed += dt;
    for (const st of this.stations) {
      if ((st.kind === 'skillet' || st.kind === 'pot') && st.cookState === 'cooking' && this.rng() < dt * 4) {
        this.addParticle(
          st.x + (this.rng() - 0.5) * 18,
          st.y - 16,
          (this.rng() - 0.5) * 16,
          -26 - this.rng() * 18,
          'rgba(255,250,240,0.65)',
          4 + this.rng() * 3,
          0.9,
          'steam',
        );
      }
      if (st.kind === 'pass' && st.item && st.item.complete && this.rng() < dt * 3.5) {
        this.addParticle(
          st.x + (this.rng() - 0.5) * 20,
          st.y - 16,
          (this.rng() - 0.5) * 12,
          -24 - this.rng() * 16,
          'rgba(255,244,214,0.6)',
          3.5 + this.rng() * 2.5,
          0.85,
          'steam',
        );
      }
    }
    this.stepParticles(dt);
  }

  stepChefMovement(dt, controls) {
    let mx = controls.moveX ?? 0;
    let my = controls.moveY ?? 0;

    if (Math.abs(mx) > 0.01 || Math.abs(my) > 0.01) {
      this.chef.autoTarget = null;
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
    } else if (this.chef.autoTarget) {
      const target = this.chef.autoTarget;
      const station = this.getStation(target.stationId);
      const distToStation = station ? Math.hypot(station.x - this.chef.x, station.y - this.chef.y) : Infinity;
      if (station && distToStation <= CHEF_CONFIG.interactRadius - 6) {
        this.chef.dirX = (station.x - this.chef.x) / Math.max(1, distToStation);
        this.chef.dirY = (station.y - this.chef.y) / Math.max(1, distToStation);
        this.chef.autoTarget = null;
        if (target.action === 'work') {
          this.workAtStation(station, true);
        } else {
          this.interactWithStation(station);
        }
      } else if (target.waypoints.length > 0) {
        const wp = target.waypoints[0];
        const dx = wp.x - this.chef.x;
        const dy = wp.y - this.chef.y;
        const d = Math.hypot(dx, dy);
        if (d < 12) {
          target.waypoints.shift();
        } else {
          mx = dx / d;
          my = dy / d;
        }
      } else {
        this.chef.autoTarget = null;
      }
    }

    const speed = CHEF_CONFIG.moveSpeed;
    const stepX = mx * speed * dt;
    const stepY = my * speed * dt;

    if (Math.abs(mx) > 0.01 || Math.abs(my) > 0.01) {
      this.chef.dirX = mx;
      this.chef.dirY = my;
      this.chef.walkCycle += dt * 11;
    }

    // Slide cleanly along X then Y against bounds and counter colliders
    const nextX = clamp(this.chef.x + stepX, KITCHEN_BOUNDS.left + CHEF_CONFIG.radius, KITCHEN_BOUNDS.right - CHEF_CONFIG.radius);
    if (!this.collidesWithCounters(nextX, this.chef.y)) {
      this.chef.x = nextX;
    }
    const nextY = clamp(this.chef.y + stepY, KITCHEN_BOUNDS.top + CHEF_CONFIG.radius, KITCHEN_BOUNDS.bottom - CHEF_CONFIG.radius);
    if (!this.collidesWithCounters(this.chef.x, nextY)) {
      this.chef.y = nextY;
    }

    if (this.chef.chopSwing > 0) this.chef.chopSwing = Math.max(0, this.chef.chopSwing - dt);
    if (this.chef.happyTimer > 0) this.chef.happyTimer = Math.max(0, this.chef.happyTimer - dt);
  }

  collidesWithCounters(x, y) {
    for (const rect of COUNTER_COLLIDERS) {
      if (circleIntersectsRect(x, y, CHEF_CONFIG.radius, rect)) return true;
    }
    return false;
  }

  stepStations(dt, workHeld) {
    const nearest = workHeld ? this.getNearestInteractableStation() : null;
    for (const st of this.stations) {
      if (st.pulseTimer > 0) st.pulseTimer = Math.max(0, st.pulseTimer - dt);
      if (st.tossCooldown > 0) st.tossCooldown = Math.max(0, st.tossCooldown - dt);

      if (st.kind === 'board' && nearest && nearest.id === st.id && st.item && canChopOnBoard(st.item.type)) {
        st.progress = clamp(st.progress + dt / TIMINGS.chopDuration, 0, 1);
        this.chef.chopSwing = 0.14;
        if (this.rng() < dt * 8) {
          this.addParticle(
            st.x + (this.rng() - 0.5) * 16,
            st.y - 6,
            (this.rng() - 0.5) * 50,
            -35 - this.rng() * 25,
            INGREDIENTS[st.item.type].color,
            2.8,
            0.3,
            'crumb',
          );
        }
        if (st.progress >= 1) {
          const targetType = INGREDIENTS[st.item.type].target;
          st.item = { kind: 'ingredient', type: targetType, perfect: false };
          st.progress = 0;
          st.pulseTimer = 0.4;
          this.addPopup(st.x, st.y - 26, INGREDIENTS[targetType].short + '!', '#88f7a6', 15);
          this.emit('chopDone', { station: st });
        }
      }

      if ((st.kind === 'skillet' || st.kind === 'pot') && st.item && st.item.kind === 'ingredient') {
        const cookTime = st.kind === 'skillet' ? TIMINGS.skilletCookTime : TIMINGS.potCookTime;
        const goldenWindow = st.kind === 'skillet' ? TIMINGS.skilletGoldenWindow : TIMINGS.potGoldenWindow;
        const warnTime = st.kind === 'skillet' ? TIMINGS.skilletWarnTime : TIMINGS.potWarnTime;
        const burnTime = st.kind === 'skillet' ? TIMINGS.skilletBurnTime : TIMINGS.potBurnTime;

        if (st.item.type !== 'burnt') {
          st.cookElapsed += dt;
          if (st.cookElapsed < cookTime) {
            st.cookState = 'cooking';
            st.progress = st.cookElapsed / cookTime;
            if (this.rng() < dt * 5) {
              this.addParticle(
                st.x + (this.rng() - 0.5) * 20,
                st.y - 16,
                (this.rng() - 0.5) * 18,
                -26 - this.rng() * 18,
                st.kind === 'skillet' ? 'rgba(255,235,205,0.65)' : 'rgba(235,248,255,0.7)',
                4 + this.rng() * 2.5,
                0.7,
                'steam',
              );
            }
          } else {
            // Transform to cooked item once cookTime is reached
            const def = INGREDIENTS[st.item.type];
            if (def.target) {
              st.item = { kind: 'ingredient', type: def.target, perfect: true };
              st.pulseTimer = 0.45;
              this.emit('cookDone', { station: st });
            }
            if (st.cookElapsed >= burnTime) {
              st.item = { kind: 'ingredient', type: 'burnt', perfect: false };
              st.cookState = 'burnt';
              st.progress = 1;
              this.addPopup(st.x, st.y - 26, 'Scorched!', '#ff6f61', 15);
              this.emit('burnt', { station: st });
            } else if (st.cookElapsed >= warnTime) {
              st.item.perfect = false;
              st.cookState = 'warning';
              st.progress = (st.cookElapsed - warnTime) / (burnTime - warnTime);
              if (this.rng() < dt * 7) {
                this.addParticle(
                  st.x + (this.rng() - 0.5) * 16,
                  st.y - 16,
                  (this.rng() - 0.5) * 22,
                  -34 - this.rng() * 20,
                  'rgba(70,65,65,0.7)',
                  5 + this.rng() * 3,
                  0.85,
                  'smoke',
                );
              }
            } else {
              st.cookState = 'ready';
              st.item.perfect = st.cookElapsed <= cookTime + goldenWindow;
              st.progress = 1;
            }
          }
        }
      }

      if (st.kind === 'pass' && st.item && st.item.complete && this.rng() < dt * 4) {
        this.addParticle(
          st.x + (this.rng() - 0.5) * 18,
          st.y - 18,
          (this.rng() - 0.5) * 12,
          -24 - this.rng() * 14,
          'rgba(255,244,210,0.65)',
          3.4,
          0.8,
          'steam',
        );
      }
    }
  }

  stepOrders(dt) {
    this.orderSpawnTimer -= dt;
    if (this.orderSpawnTimer <= 0) {
      this.spawnOrder(false);
      // Gradually quicken arrivals slightly near the end of shift
      const shiftProgress = clamp(this.elapsed / this.shift.duration, 0, 1);
      const speedFactor = 1 - shiftProgress * 0.22;
      this.orderSpawnTimer = this.shift.orderInterval * speedFactor;
    }

    for (let i = this.orders.length - 1; i >= 0; i -= 1) {
      const ord = this.orders[i];
      ord.timeLeft -= dt;
      if (ord.timeLeft <= 0) {
        this.orders.splice(i, 1);
        this.ordersExpired += 1;
        this.combo = 0;
        this.comboTimer = 0;
        const penalty = 8;
        this.score = Math.max(0, this.score - penalty);
        this.showToast(`Ticket #${ord.ticketNumber} timed out! (-$${penalty})`, 'danger');
        this.emit('orderExpired', { order: ord });
      }
    }

    if (this.orders.length === 0 && this.orderSpawnTimer > 1.5) {
      this.orderSpawnTimer = 1.5;
    }
  }

  stepParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'crumb') p.vy += 180 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      const pop = this.popups[i];
      pop.y += pop.vy * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  getStarRating() {
    const [s1, s2, s3] = this.shift.starGoals;
    if (this.score >= s3) return 3;
    if (this.score >= s2) return 2;
    if (this.score >= s1) return 1;
    return 0;
  }
}
