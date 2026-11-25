import assert from 'node:assert/strict';
import test from 'node:test';
import { KitchenSimulation, computeKitchenPath } from '../game/src/kitchen-state.js';
import { INGREDIENTS, RECIPES, addIngredientToPlate, createPlate } from '../game/src/recipes.js';

function moveChefToStation(sim, stationId) {
  const st = sim.getStation(stationId);
  assert.ok(st, `Missing station ${stationId}`);
  const isCenter = st.y > 320 && st.y < 540;
  sim.chef.x = st.x;
  sim.chef.y = isCenter ? 362 : st.approachY;
  sim.chef.dirX = 0;
  sim.chef.dirY = st.y > sim.chef.y ? 1 : -1;
  return st;
}

test('all 5 recipes are distinct 3-ingredient combinations of ready ingredients', () => {
  assert.equal(RECIPES.length, 5);
  const signatures = new Set();
  for (const recipe of RECIPES) {
    assert.equal(recipe.ingredients.length, 3);
    for (const ingId of recipe.ingredients) {
      assert.equal(INGREDIENTS[ingId]?.ready, true, `${ingId} must be ready`);
    }
    const sig = [...recipe.ingredients].sort().join('|');
    assert.equal(signatures.has(sig), false, `Duplicate recipe ingredients ${sig}`);
    signatures.add(sig);
  }
});

test('plate rejects incompatible ingredient combinations and completes valid dishes', () => {
  let plate = createPlate();
  plate = addIngredientToPlate(plate, { kind: 'ingredient', type: 'bun', perfect: false });
  assert.ok(plate);
  assert.equal(plate.complete, false);

  // Pasta does not belong on a burger with a brioche bun
  const incompatible = addIngredientToPlate(plate, { kind: 'ingredient', type: 'pasta_cooked', perfect: false });
  assert.equal(incompatible, null);

  plate = addIngredientToPlate(plate, { kind: 'ingredient', type: 'patty_seared', perfect: true });
  assert.ok(plate);
  assert.equal(plate.complete, false);

  plate = addIngredientToPlate(plate, { kind: 'ingredient', type: 'greens_chopped', perfect: false });
  assert.ok(plate);
  assert.equal(plate.complete, true);
  assert.equal(plate.recipeId, 'burger');
  assert.equal(plate.perfectCount, 1);
});

test('full end-to-end cooking flow: chop, sear, assemble, stage on pass, and serve for points', () => {
  const sim = new KitchenSimulation(42);
  sim.reset(0, 'playing');

  // Force deterministic opening ticket for Truffle Bistro Burger
  sim.orders = [
    {
      id: 'ord-test',
      ticketNumber: 901,
      tableNum: 2,
      recipeId: 'burger',
      vip: false,
      value: 28,
      timeLeft: 48,
      maxTime: 50,
      pulse: 0,
    },
  ];

  // 1. Grab patty and cook on skillet-1
  sim.interactWithStation(moveChefToStation(sim, 'crate-patty'));
  assert.equal(sim.chef.holding?.type, 'patty');
  sim.interactWithStation(moveChefToStation(sim, 'skillet-1'));
  assert.equal(sim.chef.holding, null);
  assert.equal(sim.getStation('skillet-1').cookState, 'cooking');

  for (let i = 0; i < 260; i += 1) {
    sim.step(1 / 60, {});
  }
  const skillet = sim.getStation('skillet-1');
  assert.equal(skillet.cookState, 'ready');
  assert.equal(skillet.item?.type, 'patty_seared');
  assert.equal(skillet.item?.perfect, true);

  // 2. Grab greens and chop on board-1
  sim.interactWithStation(moveChefToStation(sim, 'crate-greens'));
  sim.interactWithStation(moveChefToStation(sim, 'board-1'));
  for (let i = 0; i < 4; i += 1) {
    sim.workAtStation(sim.getStation('board-1'), true);
  }
  assert.equal(sim.getStation('board-1').item?.type, 'greens_chopped');

  // 3. Assemble burger on assembly-1: bun + greens + seared patty
  sim.interactWithStation(moveChefToStation(sim, 'crate-bun'));
  sim.interactWithStation(moveChefToStation(sim, 'assembly-1'));
  assert.equal(sim.getStation('assembly-1').item?.kind, 'plate');
  assert.equal(sim.getStation('assembly-1').item?.complete, false);

  sim.interactWithStation(moveChefToStation(sim, 'board-1'));
  sim.interactWithStation(moveChefToStation(sim, 'assembly-1'));
  assert.equal(sim.getStation('assembly-1').item?.ingredients.length, 2);

  sim.interactWithStation(moveChefToStation(sim, 'skillet-1'));
  sim.interactWithStation(moveChefToStation(sim, 'assembly-1'));
  const finished = sim.getStation('assembly-1').item;
  assert.equal(finished?.complete, true);
  assert.equal(finished?.recipeId, 'burger');

  // 4. Pick up finished plate, place on Heated Pass, then serve!
  sim.interactWithStation(moveChefToStation(sim, 'assembly-1'));
  assert.equal(sim.chef.holding?.complete, true);
  sim.interactWithStation(moveChefToStation(sim, 'pass-ready'));
  assert.equal(sim.chef.holding, null);
  assert.equal(sim.getStation('pass-ready').item?.complete, true);

  // Serve from Heated Pass via Serve Bell
  const served = sim.interactWithStation(moveChefToStation(sim, 'serve-bell'));
  assert.equal(served, true);
  assert.equal(sim.dishesServed, 1);
  assert.ok(sim.score >= 28 + 6, `Expected score >= 34 (base + chef kiss), got ${sim.score}`);
  assert.equal(sim.orders.some((o) => o.id === 'ord-test'), false);
});

test('skillet burns item if left unattended past burn time and compost clears it', () => {
  const sim = new KitchenSimulation(99);
  sim.reset(0, 'playing');

  sim.interactWithStation(moveChefToStation(sim, 'crate-salmon'));
  sim.interactWithStation(moveChefToStation(sim, 'skillet-2'));

  for (let i = 0; i < 760; i += 1) {
    sim.step(1 / 60, {});
  }
  const skillet2 = sim.getStation('skillet-2');
  assert.equal(skillet2.cookState, 'burnt');
  assert.equal(skillet2.item?.type, 'burnt');

  sim.interactWithStation(moveChefToStation(sim, 'skillet-2'));
  assert.equal(sim.chef.holding?.type, 'burnt');
  sim.interactWithStation(moveChefToStation(sim, 'trash'));
  assert.equal(sim.chef.holding, null);
});

test('A* kitchen pathfinder navigates around the center island cleanly', () => {
  const path = computeKitchenPath(400, 310, 400, 560);
  assert.ok(path.length > 2);
  const last = path[path.length - 1];
  assert.equal(last.x, 400);
  assert.equal(last.y, 560);
});
