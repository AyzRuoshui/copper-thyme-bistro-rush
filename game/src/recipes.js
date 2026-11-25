/**
 * Ingredient catalog, station transformations, and original bistro recipes.
 */

export const INGREDIENTS = {
  bun: { id: 'bun', name: 'Brioche Bun', short: 'Bun', prep: 'fresh', ready: true, color: '#df9b49' },
  patty: { id: 'patty', name: 'Prime Patty', short: 'Patty', prep: 'skillet', target: 'patty_seared', color: '#b53a38' },
  patty_seared: { id: 'patty_seared', name: 'Seared Patty', short: 'Patty', prep: 'skillet', ready: true, color: '#6b3623' },
  salmon: { id: 'salmon', name: 'Salmon Fillet', short: 'Salmon', prep: 'skillet', target: 'salmon_seared', color: '#f07d5b' },
  salmon_seared: { id: 'salmon_seared', name: 'Crispy Salmon', short: 'Salmon', prep: 'skillet', ready: true, color: '#e3633c' },
  pasta: { id: 'pasta', name: 'Tagliatelle', short: 'Pasta', prep: 'pot', target: 'pasta_cooked', color: '#f1cc6b' },
  pasta_cooked: { id: 'pasta_cooked', name: 'Boiled Pasta', short: 'Pasta', prep: 'pot', ready: true, color: '#f6d874' },
  tomato: { id: 'tomato', name: 'Tomato', short: 'Tomato', prep: 'board', target: 'tomato_diced', color: '#df3b2f' },
  tomato_diced: { id: 'tomato_diced', name: 'Diced Tomato', short: 'Tomato', prep: 'board', ready: true, color: '#e9483b' },
  greens: { id: 'greens', name: 'Crisp Greens', short: 'Greens', prep: 'board', target: 'greens_chopped', color: '#45a349' },
  greens_chopped: { id: 'greens_chopped', name: 'Chopped Greens', short: 'Greens', prep: 'board', ready: true, color: '#58b85a' },
  mushroom: { id: 'mushroom', name: 'Wild Mushroom', short: 'Shroom', prep: 'board', target: 'mushroom_sliced', color: '#9c7858' },
  mushroom_sliced: { id: 'mushroom_sliced', name: 'Sliced Shrooms', short: 'Shroom', prep: 'board', ready: true, color: '#b89474' },
  burnt: { id: 'burnt', name: 'Scorched Scrap', short: 'Burnt', prep: 'trash', ready: false, color: '#2b2726' },
};

export const RECIPES = [
  {
    id: 'burger',
    name: 'Truffle Bistro Burger',
    shortName: 'Bistro Burger',
    price: 28,
    ingredients: ['bun', 'patty_seared', 'greens_chopped'],
    accent: '#d9783b',
  },
  {
    id: 'salmon_plate',
    name: 'Seared Salmon Plate',
    shortName: 'Crispy Salmon',
    price: 34,
    ingredients: ['salmon_seared', 'greens_chopped', 'tomato_diced'],
    accent: '#e96846',
  },
  {
    id: 'mushroom_pasta',
    name: 'Wild Mushroom Pasta',
    shortName: 'Shroom Pasta',
    price: 32,
    ingredients: ['pasta_cooked', 'tomato_diced', 'mushroom_sliced'],
    accent: '#dfa93b',
  },
  {
    id: 'harvest_salad',
    name: "Chef's Harvest Salad",
    shortName: 'Harvest Salad',
    price: 22,
    ingredients: ['greens_chopped', 'tomato_diced', 'mushroom_sliced'],
    accent: '#3ca35d',
  },
  {
    id: 'steakhouse',
    name: 'Steakhouse Skillet',
    shortName: 'Steak Platter',
    price: 38,
    ingredients: ['patty_seared', 'mushroom_sliced', 'tomato_diced'],
    accent: '#9b3d2f',
  },
];

const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

export function getRecipe(recipeId) {
  return RECIPE_BY_ID.get(recipeId) ?? null;
}

export function isPlatableIngredient(type) {
  const def = INGREDIENTS[type];
  return Boolean(def && def.ready);
}

export function canChopOnBoard(type) {
  const def = INGREDIENTS[type];
  return Boolean(def && def.prep === 'board' && def.target);
}

export function canCookOnSkillet(type) {
  const def = INGREDIENTS[type];
  return Boolean(def && def.prep === 'skillet' && def.target);
}

export function canBoilInPot(type) {
  const def = INGREDIENTS[type];
  return Boolean(def && def.prep === 'pot' && def.target);
}

/**
 * Find all recipes that contain every ingredient in `current` plus `candidate`.
 */
export function matchingRecipesWith(current, candidate) {
  if (!isPlatableIngredient(candidate)) return [];
  if (current.includes(candidate)) return [];
  const next = [...current, candidate];
  return RECIPES.filter((recipe) => next.every((ing) => recipe.ingredients.includes(ing)));
}

/**
 * Create a clean empty plate item.
 */
export function createPlate(ingredients = [], perfectCount = 0) {
  const exact = RECIPES.find(
    (r) => r.ingredients.length === ingredients.length && r.ingredients.every((ing) => ingredients.includes(ing)),
  );
  return {
    kind: 'plate',
    ingredients: [...ingredients],
    recipeId: exact ? exact.id : null,
    complete: Boolean(exact),
    perfectCount,
  };
}

/**
 * Return a new plate with `item` added if it fits at least one recipe, or null when invalid.
 */
export function addIngredientToPlate(plate, item) {
  if (!plate || plate.kind !== 'plate' || plate.complete) return null;
  if (!item || item.kind !== 'ingredient') return null;
  const matches = matchingRecipesWith(plate.ingredients, item.type);
  if (matches.length === 0) return null;
  const nextIngs = [...plate.ingredients, item.type];
  const perfectCount = (plate.perfectCount ?? 0) + (item.perfect ? 1 : 0);
  return createPlate(nextIngs, perfectCount);
}

/**
 * Check whether two plates can be combined without colliding ingredients.
 */
export function canMergePlates(plateA, plateB) {
  if (!plateA || !plateB || plateA.kind !== 'plate' || plateB.kind !== 'plate') return false;
  if (plateA.complete || plateB.complete) return false;
  const combined = [...plateA.ingredients, ...plateB.ingredients];
  const unique = new Set(combined);
  if (unique.size !== combined.length) return false;
  return RECIPES.some((r) => combined.every((ing) => r.ingredients.includes(ing)));
}

export function mergePlates(plateA, plateB) {
  if (!canMergePlates(plateA, plateB)) return null;
  return createPlate(
    [...plateA.ingredients, ...plateB.ingredients],
    (plateA.perfectCount ?? 0) + (plateB.perfectCount ?? 0),
  );
}

/**
 * Pick the best matching recipe candidate for displaying live mid-assembly guidance.
 */
export function inferTargetRecipe(plate, orders = []) {
  if (!plate || plate.kind !== 'plate' || plate.ingredients.length === 0) return null;
  if (plate.recipeId) return getRecipe(plate.recipeId);
  const candidates = RECIPES.filter((r) => plate.ingredients.every((ing) => r.ingredients.includes(ing)));
  if (candidates.length === 0) return null;
  // Prefer an active order ticket with lowest remaining time
  let bestOrder = null;
  for (const order of orders) {
    if (candidates.some((c) => c.id === order.recipeId)) {
      if (!bestOrder || order.timeLeft < bestOrder.timeLeft) {
        bestOrder = order;
      }
    }
  }
  return bestOrder ? getRecipe(bestOrder.recipeId) : candidates[0];
}
