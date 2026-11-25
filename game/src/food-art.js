/**
 * Custom procedural 2D canvas culinary illustrations for every ingredient,
 * preparation state, mid-assembly dish, and finished bistro plate.
 */
import { INGREDIENTS } from './recipes.js';

function drawEllipse(ctx, cx, cy, rx, ry, fill, stroke = null, lineWidth = 1.5) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function drawPlateBase(ctx, x, y, radius, highlight = false) {
  // Drop shadow
  drawEllipse(ctx, x, y + 3, radius * 0.98, radius * 0.84, 'rgba(20, 12, 8, 0.24)');
  // Outer porcelain rim
  drawEllipse(ctx, x, y, radius, radius * 0.86, '#fbf8f2', highlight ? '#f4be44' : '#d2c8ba', highlight ? 2.6 : 1.6);
  // Subtle bistro copper-gold rim ring
  drawEllipse(ctx, x, y, radius * 0.83, radius * 0.7, null, '#d49a6a', 1.1);
  // Inner eating well
  drawEllipse(ctx, x, y + 1, radius * 0.72, radius * 0.6, '#f2ede4');
}

export function drawIngredientArt(ctx, type, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  switch (type) {
    case 'bun': {
      drawEllipse(ctx, 0, 7, 17, 7, '#a86728', '#6e3f14', 1.4);
      ctx.beginPath();
      ctx.moveTo(-17, 4);
      ctx.quadraticCurveTo(-17, -14, 0, -14);
      ctx.quadraticCurveTo(17, -14, 17, 4);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, -14, 0, 6);
      grad.addColorStop(0, '#f4bc68');
      grad.addColorStop(1, '#cf8234');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#7e4819';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Sesame seeds
      ctx.fillStyle = '#fff5dc';
      for (const [sx, sy, rot] of [[-7, -7, 0.4], [0, -10, -0.2], [7, -6, 0.6], [-3, -3, -0.5], [5, -1, 0.2]]) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rot);
        drawEllipse(ctx, 0, 0, 2.2, 1.1, '#fff5dc');
        ctx.restore();
      }
      break;
    }

    case 'patty': {
      drawEllipse(ctx, 0, 2, 17, 11, '#a93432', '#681d1c', 1.5);
      drawEllipse(ctx, -2, 0, 14, 8, '#c24643');
      ctx.fillStyle = '#f0b8b0';
      for (const [fx, fy] of [[-6, -2], [3, -3], [6, 2], [-3, 3]]) {
        drawEllipse(ctx, fx, fy, 2.2, 1.2, '#f0b8b0');
      }
      break;
    }

    case 'patty_seared': {
      drawEllipse(ctx, 0, 2, 17, 11, '#582918', '#33150b', 1.6);
      drawEllipse(ctx, 0, 0, 15, 9, '#793b23');
      // Charred grill marks
      ctx.strokeStyle = '#2d1208';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for (const offset of [-7, 0, 7]) {
        ctx.beginPath();
        ctx.moveTo(offset - 4, -5);
        ctx.lineTo(offset + 4, 5);
        ctx.stroke();
      }
      // Herb butter shine
      drawEllipse(ctx, 2, -2, 4.5, 2.8, '#f6d468');
      drawEllipse(ctx, 3, -2, 1.4, 1.1, '#4d9b44');
      break;
    }

    case 'salmon': {
      ctx.beginPath();
      ctx.moveTo(-17, 5);
      ctx.quadraticCurveTo(-15, -10, 2, -10);
      ctx.quadraticCurveTo(17, -9, 18, 4);
      ctx.quadraticCurveTo(4, 11, -17, 5);
      ctx.closePath();
      ctx.fillStyle = '#f38361';
      ctx.fill();
      ctx.strokeStyle = '#9c422a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // White fat marbling arcs
      ctx.strokeStyle = '#ffd8cc';
      ctx.lineWidth = 1.8;
      for (const ox of [-9, -2, 5, 11]) {
        ctx.beginPath();
        ctx.moveTo(ox - 2, -6);
        ctx.quadraticCurveTo(ox + 1, 0, ox - 2, 5);
        ctx.stroke();
      }
      break;
    }

    case 'salmon_seared': {
      ctx.beginPath();
      ctx.moveTo(-17, 5);
      ctx.quadraticCurveTo(-15, -10, 2, -10);
      ctx.quadraticCurveTo(17, -9, 18, 4);
      ctx.quadraticCurveTo(4, 11, -17, 5);
      ctx.closePath();
      const grad = ctx.createLinearGradient(-15, -10, 15, 10);
      grad.addColorStop(0, '#f59c62');
      grad.addColorStop(0.55, '#e86f44');
      grad.addColorStop(1, '#c54e27');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#752c15';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Crisp sear lines & lemon thyme sprig
      ctx.strokeStyle = '#ffd29e';
      ctx.lineWidth = 1.4;
      for (const ox of [-8, -1, 6]) {
        ctx.beginPath();
        ctx.moveTo(ox - 2, -6);
        ctx.lineTo(ox, 5);
        ctx.stroke();
      }
      drawEllipse(ctx, 2, -3, 3.2, 1.8, '#55ad4a', '#2c6626', 0.9);
      break;
    }

    case 'pasta': {
      // Raw ribbon nest
      ctx.strokeStyle = '#d49d35';
      ctx.lineWidth = 3.6;
      for (let i = 0; i < 4; i += 1) {
        drawEllipse(ctx, (i - 1.5) * 2.2, (i % 2 === 0 ? -1 : 1) * 2, 12 - i, 7.5 - i * 0.6, null, i % 2 === 0 ? '#f3cf68' : '#e0b343', 3);
      }
      drawEllipse(ctx, 0, 0, 6, 4, '#f8dc82', '#c8942d', 1);
      break;
    }

    case 'pasta_cooked': {
      drawEllipse(ctx, 0, 2, 16, 10, '#e6b843', '#9d7218', 1.2);
      ctx.strokeStyle = '#fae184';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, 1, 10, 0.2, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(1, 0, 6, 0.6, Math.PI * 2.1);
      ctx.stroke();
      // Herb oil droplets
      drawEllipse(ctx, -4, -3, 2, 1.4, '#4ea347');
      drawEllipse(ctx, 5, 2, 1.8, 1.3, '#4ea347');
      break;
    }

    case 'tomato': {
      drawEllipse(ctx, 0, 1, 14, 12.5, '#df372b', '#871813', 1.5);
      drawEllipse(ctx, -4, -3, 5, 3.5, '#f97364');
      // Green calyx star
      ctx.fillStyle = '#3f963d';
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * 6.5, -8 + Math.sin(a) * 4.5);
        const a2 = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a2) * 2.2, -8 + Math.sin(a2) * 1.6);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'tomato_diced': {
      const cubes = [
        [-8, -2, '#e33b2e'],
        [2, -5, '#f04b3c'],
        [7, 2, '#cf2e23'],
        [-3, 5, '#ea4335'],
        [-9, 5, '#c92d22'],
        [2, 3, '#f25749'],
      ];
      for (const [cx, cy, col] of cubes) {
        ctx.fillStyle = col;
        ctx.strokeStyle = '#851b14';
        ctx.lineWidth = 1;
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
        ctx.strokeRect(cx - 4, cy - 4, 8, 8);
        ctx.fillStyle = '#ffaea3';
        ctx.fillRect(cx - 2.5, cy - 2.5, 2.5, 1.8);
      }
      break;
    }

    case 'greens': {
      for (const [lx, ly, rx, ry, col] of [
        [-6, 1, 9, 7, '#348c3e'],
        [6, 1, 9, 7, '#3d9c47'],
        [0, -4, 10, 8, '#53ba57'],
        [0, 3, 8, 6, '#6ad06b'],
      ]) {
        drawEllipse(ctx, lx, ly, rx, ry, col, '#235e28', 1.2);
      }
      ctx.strokeStyle = '#b4f09d';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -8);
      ctx.stroke();
      break;
    }

    case 'greens_chopped': {
      ctx.lineCap = 'round';
      for (const [x1, y1, x2, y2, col] of [
        [-11, -3, -2, 3, '#3b9b44'],
        [-4, -7, 6, -2, '#5bc461'],
        [-9, 5, 2, 1, '#4eb053'],
        [1, 5, 11, -1, '#399442'],
        [-2, -2, 8, 6, '#75d478'],
        [-10, 1, 0, -6, '#50b557'],
      ]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      break;
    }

    case 'mushroom': {
      // Stem
      ctx.fillStyle = '#efe2cf';
      ctx.strokeStyle = '#8b6e55';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.roundRect(-5, 0, 10, 11, 3);
      ctx.fill();
      ctx.stroke();
      // Cap
      ctx.beginPath();
      ctx.arc(0, 0, 13, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = '#a07550';
      ctx.fill();
      ctx.stroke();
      drawEllipse(ctx, -4, -5, 3.5, 2, '#c89e79');
      break;
    }

    case 'mushroom_sliced': {
      for (const [sx, sy, rot] of [[-7, -2, -0.35], [5, -3, 0.25], [-1, 5, 0.05]]) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rot);
        ctx.fillStyle = '#f2e5d2';
        ctx.strokeStyle = '#7c5d45';
        ctx.lineWidth = 1.1;
        ctx.fillRect(-2.5, 0, 5, 6);
        ctx.strokeRect(-2.5, 0, 5, 6);
        ctx.beginPath();
        ctx.arc(0, 0, 7, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = '#9c714e';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'burnt': {
      drawEllipse(ctx, 0, 1, 15, 10, '#2a2423', '#110e0d', 1.6);
      drawEllipse(ctx, -3, -2, 8, 5, '#3b3230');
      ctx.strokeStyle = '#5c4944';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-7, -3);
      ctx.lineTo(5, 4);
      ctx.moveTo(-4, 5);
      ctx.lineTo(6, -3);
      ctx.stroke();
      break;
    }

    default: {
      const def = INGREDIENTS[type];
      drawEllipse(ctx, 0, 0, 12, 10, def ? def.color : '#cccccc', '#3b2e26', 1.4);
      break;
    }
  }

  ctx.restore();
}

/**
 * Draw either a dish mid-assembly (showing every added ingredient + empty slot outline)
 * or a richly plated completed bistro dish.
 */
export function drawDishArt(ctx, plate, x, y, radius = 24, highlight = false) {
  drawPlateBase(ctx, x, y, radius, highlight);
  if (!plate || plate.kind !== 'plate') return;

  const ings = plate.ingredients ?? [];
  const scale = radius / 24;

  if (!plate.complete) {
    // Draw empty garnish guide ring when mid-assembly so progress reads clearly
    if (ings.length > 0) {
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(217, 120, 59, 0.72)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.56, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const offsets =
      ings.length === 1
        ? [[0, 0]]
        : [[0, 3], [0, -5]];
    for (let i = 0; i < ings.length; i += 1) {
      const [ox, oy] = offsets[i] ?? [0, 0];
      drawIngredientArt(ctx, ings[i], x + ox * scale, y + oy * scale, scale * 0.78);
    }
    return;
  }

  // Completed dish bespoke plating!
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  switch (plate.recipeId) {
    case 'burger': {
      drawEllipse(ctx, 0, 6, 15, 6, '#be7a35', '#784514', 1.3);
      drawIngredientArt(ctx, 'greens_chopped', 0, 2, 0.85);
      drawIngredientArt(ctx, 'patty_seared', 0, -1, 0.85);
      drawIngredientArt(ctx, 'bun', 0, -7, 0.88);
      break;
    }
    case 'salmon_plate': {
      drawIngredientArt(ctx, 'greens_chopped', -4, 3, 0.82);
      drawIngredientArt(ctx, 'tomato_diced', 7, 4, 0.72);
      drawIngredientArt(ctx, 'salmon_seared', 0, -3, 0.9);
      break;
    }
    case 'mushroom_pasta': {
      drawIngredientArt(ctx, 'pasta_cooked', 0, 2, 0.95);
      drawIngredientArt(ctx, 'tomato_diced', -4, -3, 0.72);
      drawIngredientArt(ctx, 'mushroom_sliced', 4, -4, 0.76);
      break;
    }
    case 'harvest_salad': {
      drawIngredientArt(ctx, 'greens_chopped', 0, 2, 1.0);
      drawIngredientArt(ctx, 'tomato_diced', -5, -2, 0.74);
      drawIngredientArt(ctx, 'mushroom_sliced', 5, -2, 0.76);
      break;
    }
    case 'steakhouse': {
      drawIngredientArt(ctx, 'patty_seared', -2, 1, 0.94);
      drawIngredientArt(ctx, 'mushroom_sliced', 5, -5, 0.74);
      drawIngredientArt(ctx, 'tomato_diced', -6, -5, 0.68);
      break;
    }
    default: {
      for (let i = 0; i < ings.length; i += 1) {
        drawIngredientArt(ctx, ings[i], (i - 1) * 6, 0, 0.72);
      }
      break;
    }
  }

  // Golden perfection star badge on top-right edge when any component was pulled at the golden peak
  if ((plate.perfectCount ?? 0) > 0) {
    ctx.fillStyle = '#ffd54f';
    ctx.strokeStyle = '#99640b';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(13, -12, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}
