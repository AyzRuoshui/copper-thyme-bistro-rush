/**
 * Full bistro kitchen scene renderer for Copper & Thyme:
 * terracotta checkerboard floor, wood & marble stations, flames, steam, chef character,
 * overhead order board tickets, shift timer, and crisp UI overlays.
 */
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COUNTER_COLLIDERS,
  KITCHEN_BOUNDS,
  ORDER_BAR_HEIGHT,
  PALETTE,
  SHIFTS,
} from './config.js';
import { INGREDIENTS, RECIPES, createPlate, getRecipe, inferTargetRecipe } from './recipes.js';
import { drawDishArt, drawIngredientArt, drawPlateBase } from './food-art.js';

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export class KitchenRenderer {
  constructor() {
    this.uiRegions = [];
    this.hoveredStationId = null;
  }

  /**
   * Find an interactive UI button hit by `(x, y)` in logical canvas coordinates.
   */
  hitTestUi(x, y) {
    for (let i = this.uiRegions.length - 1; i >= 0; i -= 1) {
      const r = this.uiRegions[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return r;
      }
    }
    return null;
  }

  registerUiRegion(id, x, y, w, h, payload = {}) {
    this.uiRegions.push({ id, x, y, w, h, ...payload });
  }

  render(ctx, sim, audioMuted, hoveredStationId = null) {
    this.uiRegions = [];
    this.hoveredStationId = hoveredStationId;

    ctx.save();
    this.drawFloorAndWalls(ctx);
    this.drawCounterBanks(ctx);
    this.drawStations(ctx, sim);
    this.drawChef(ctx, sim);
    this.drawParticlesAndPopups(ctx, sim);
    this.drawOrderBoardHud(ctx, sim, audioMuted);
    this.drawBottomControlStrip(ctx, sim);
    this.drawToast(ctx, sim);

    if (sim.mode === 'title') {
      this.drawTitleOverlay(ctx, sim);
    } else if (sim.mode === 'recipes') {
      this.drawRecipesOverlay(ctx);
    } else if (sim.mode === 'paused') {
      this.drawPauseOverlay(ctx, sim);
    } else if (sim.mode === 'summary') {
      this.drawSummaryOverlay(ctx, sim);
    }
    ctx.restore();
  }

  drawFloorAndWalls(ctx) {
    ctx.fillStyle = PALETTE.bgDeep;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Kitchen interior warm floor
    const { left, right, top, bottom } = KITCHEN_BOUNDS;
    ctx.save();
    roundRectPath(ctx, left - 8, top - 6, right - left + 16, bottom - top + 14, 14);
    ctx.clip();

    const tile = 44;
    for (let y = top - 8; y < bottom + 12; y += tile) {
      for (let x = left - 8; x < right + 12; x += tile) {
        const ix = Math.floor((x - left) / tile);
        const iy = Math.floor((y - top) / tile);
        ctx.fillStyle = (ix + iy) % 2 === 0 ? PALETTE.tileLight : PALETTE.tileWarm;
        ctx.fillRect(x, y, tile, tile);
      }
    }

    // Subtle tile grid lines
    ctx.strokeStyle = 'rgba(170, 140, 108, 0.25)';
    ctx.lineWidth = 1;
    for (let x = left; x <= right; x += tile) {
      ctx.beginPath();
      ctx.moveTo(x, top - 8);
      ctx.lineTo(x, bottom + 12);
      ctx.stroke();
    }
    for (let y = top; y <= bottom; y += tile) {
      ctx.beginPath();
      ctx.moveTo(left - 8, y);
      ctx.lineTo(right + 12, y);
      ctx.stroke();
    }

    // Warm overhead pendant light glows over hearth, assembly island, and pass
    for (const [lx, ly, lr, col] of [
      [490, 240, 210, 'rgba(255, 198, 120, 0.16)'],
      [690, 432, 220, 'rgba(255, 242, 206, 0.16)'],
      [935, 232, 165, 'rgba(255, 214, 112, 0.24)'],
    ]) {
      const grad = ctx.createRadialGradient(lx, ly, 12, lx, ly, lr);
      grad.addColorStop(0, col);
      grad.addColorStop(1, 'rgba(255, 220, 150, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    }

    // Bistro woven anti-fatigue kitchen floor mats in front of stove & prep zones
    for (const [mx, my, mw, mh] of [
      [322, 286, 344, 34],
      [818, 286, 242, 34],
      [216, 338, 226, 34],
      [584, 338, 366, 34],
      [148, 540, 964, 34],
    ]) {
      ctx.fillStyle = 'rgba(78, 52, 35, 0.22)';
      roundRectPath(ctx, mx, my, mw, mh, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(116, 78, 52, 0.22)';
      ctx.lineWidth = 1.2;
      roundRectPath(ctx, mx + 3, my + 3, mw - 6, mh - 6, 8);
      ctx.stroke();
    }

    ctx.restore();

    // Warm dark oak kitchen border trim
    ctx.strokeStyle = '#5c3c24';
    ctx.lineWidth = 4;
    roundRectPath(ctx, left - 8, top - 6, right - left + 16, bottom - top + 14, 14);
    ctx.stroke();
  }

  drawCounterBanks(ctx) {
    for (let idx = 0; idx < COUNTER_COLLIDERS.length; idx += 1) {
      const bank = COUNTER_COLLIDERS[idx];
      // Drop shadow
      ctx.fillStyle = 'rgba(28, 16, 10, 0.28)';
      roundRectPath(ctx, bank.x - 2, bank.y + 6, bank.w + 4, bank.h + 4, 12);
      ctx.fill();

      // Oak / marble counter base
      ctx.fillStyle = PALETTE.woodDark;
      roundRectPath(ctx, bank.x, bank.y, bank.w, bank.h, 11);
      ctx.fill();

      // Top counter surface
      const grad = ctx.createLinearGradient(bank.x, bank.y, bank.x, bank.y + bank.h - 10);
      if (idx === 1 || idx === 2) {
        // Center islands have warm Carrara marble & oak trim
        grad.addColorStop(0, '#efe9df');
        grad.addColorStop(1, '#dfd5c6');
      } else {
        grad.addColorStop(0, '#d89f68');
        grad.addColorStop(1, '#b67b45');
      }
      ctx.fillStyle = grad;
      roundRectPath(ctx, bank.x + 3, bank.y + 3, bank.w - 6, bank.h - 12, 9);
      ctx.fill();

      // Front wooden bevel highlight
      ctx.strokeStyle = idx === 1 || idx === 2 ? '#b89f82' : '#804d25';
      ctx.lineWidth = 1.6;
      roundRectPath(ctx, bank.x + 3, bank.y + 3, bank.w - 6, bank.h - 12, 9);
      ctx.stroke();
    }
  }

  drawStations(ctx, sim) {
    const nearest = sim.mode === 'playing' ? sim.getNearestInteractableStation() : null;

    for (const st of sim.stations) {
      const isHovered = this.hoveredStationId === st.id;
      const isNearest = nearest && nearest.id === st.id;
      const sx = st.x - st.w / 2;
      const sy = st.y - st.h / 2;

      ctx.save();
      if (st.pulseTimer > 0) {
        const s = 1 + Math.sin((st.pulseTimer / 0.5) * Math.PI) * 0.04;
        ctx.translate(st.x, st.y);
        ctx.scale(s, s);
        ctx.translate(-st.x, -st.y);
      }

      // Highlight aura when targeted by mouse hover or chef facing
      if (isHovered || isNearest) {
        ctx.strokeStyle = isHovered ? '#ffd452' : 'rgba(255, 224, 128, 0.85)';
        ctx.lineWidth = isHovered ? 3.2 : 2.2;
        roundRectPath(ctx, sx - 3, sy - 3, st.w + 6, st.h + 6, 10);
        ctx.stroke();
      }

      switch (st.kind) {
        case 'plates':
          this.drawPlateStackStation(ctx, st);
          break;
        case 'skillet':
          this.drawSkilletStation(ctx, st, sim.elapsed);
          break;
        case 'pot':
          this.drawStockpotStation(ctx, st, sim.elapsed);
          break;
        case 'board':
          this.drawCuttingBoardStation(ctx, st, sim.elapsed);
          break;
        case 'assembly':
          this.drawAssemblyStation(ctx, st, sim.orders, sim.elapsed);
          break;
        case 'pass':
          this.drawPassReadyStation(ctx, st, sim.elapsed);
          break;
        case 'bell':
          this.drawServiceBellStation(ctx, st, sim.elapsed);
          break;
        case 'trash':
          this.drawTrashStation(ctx, st);
          break;
        case 'crate':
          this.drawCrateStation(ctx, st);
          break;
        default:
          this.drawGenericCounterStation(ctx, st, sim.orders);
          break;
      }

      ctx.restore();
    }
  }

  drawStationTag(ctx, x, y, text, bg = 'rgba(36, 26, 20, 0.85)', fg = '#f8ebd4') {
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    const w = Math.max(54, ctx.measureText(text).width + 14);
    ctx.fillStyle = bg;
    roundRectPath(ctx, x - w / 2, y - 9, w, 17, 5);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  drawPlateStackStation(ctx, st) {
    for (let i = 0; i < 3; i += 1) {
      drawPlateBase(ctx, st.x, st.y + 4 - i * 4, 23);
    }
    this.drawStationTag(ctx, st.x, st.y + 34, 'Plates');
  }

  drawSkilletStation(ctx, st, elapsed) {
    // Dark cast-iron stove plate
    ctx.fillStyle = '#2d2826';
    roundRectPath(ctx, st.x - 38, st.y - 30, 76, 56, 9);
    ctx.fill();
    ctx.strokeStyle = '#4a413d';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, st.x - 38, st.y - 30, 76, 56, 9);
    ctx.stroke();

    // Burner flame ring when active
    if (st.item) {
      const flicker = 1 + Math.sin(elapsed * 22 + st.x) * 0.08;
      ctx.strokeStyle = st.cookState === 'warning' || st.cookState === 'burnt' ? '#ff5938' : '#ff9833';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(st.x, st.y - 2, 27 * flicker, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#4f4642';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(st.x, st.y - 2, 23, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Copper skillet handle
    ctx.fillStyle = PALETTE.brassDark;
    ctx.save();
    ctx.translate(st.x + 25, st.y + 10);
    ctx.rotate(0.55);
    roundRectPath(ctx, 0, -4, 22, 8, 4);
    ctx.fill();
    ctx.restore();

    // Copper skillet body
    ctx.beginPath();
    ctx.arc(st.x, st.y - 2, 25, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.copper;
    ctx.fill();
    ctx.strokeStyle = PALETTE.copperDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(st.x, st.y - 2, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#3d3735';
    ctx.fill();

    if (st.item) {
      drawIngredientArt(ctx, st.item.type, st.x, st.y - 2, 0.92);
      this.drawCookRing(ctx, st);
    }

    const tagBg =
      st.cookState === 'ready'
        ? '#268a54'
        : st.cookState === 'warning'
          ? '#c9382e'
          : 'rgba(36, 26, 20, 0.85)';
    const tagText =
      st.cookState === 'ready'
        ? 'READY!'
        : st.cookState === 'warning'
          ? 'PULL!'
          : st.cookState === 'burnt'
            ? 'BURNT'
            : st.label;
    this.drawStationTag(ctx, st.x, st.y + 34, tagText, tagBg);
  }

  drawStockpotStation(ctx, st, elapsed) {
    ctx.fillStyle = '#2d2826';
    roundRectPath(ctx, st.x - 38, st.y - 30, 76, 56, 9);
    ctx.fill();

    // Side brass ear handles
    ctx.fillStyle = PALETTE.brass;
    roundRectPath(ctx, st.x - 31, st.y - 8, 8, 12, 3);
    ctx.fill();
    roundRectPath(ctx, st.x + 23, st.y - 8, 8, 12, 3);
    ctx.fill();

    // Copper pot rim
    ctx.beginPath();
    ctx.arc(st.x, st.y - 2, 26, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.copperLight;
    ctx.fill();
    ctx.strokeStyle = PALETTE.copperDark;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Simmering herb broth water
    ctx.beginPath();
    ctx.arc(st.x, st.y - 2, 21, 0, Math.PI * 2);
    ctx.fillStyle = st.cookState === 'burnt' ? '#3d3027' : '#73b3c9';
    ctx.fill();

    // Animated bubbles when cooking
    if (st.item && st.cookState !== 'burnt') {
      for (let i = 0; i < 4; i += 1) {
        const bx = st.x + Math.sin(elapsed * 4 + i * 1.9) * 11;
        const by = st.y - 2 + Math.cos(elapsed * 5 + i * 2.3) * 10;
        const br = 2 + Math.sin(elapsed * 8 + i) * 1.1;
        ctx.fillStyle = 'rgba(235, 250, 255, 0.72)';
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(1, br), 0, Math.PI * 2);
        ctx.fill();
      }
      drawIngredientArt(ctx, st.item.type, st.x, st.y - 2, 0.88);
      this.drawCookRing(ctx, st);
    }

    const tagBg =
      st.cookState === 'ready'
        ? '#268a54'
        : st.cookState === 'warning'
          ? '#c9382e'
          : 'rgba(36, 26, 20, 0.85)';
    const tagText =
      st.cookState === 'ready'
        ? 'AL DENTE!'
        : st.cookState === 'warning'
          ? 'BOIL OVER!'
          : st.label;
    this.drawStationTag(ctx, st.x, st.y + 34, tagText, tagBg);
  }

  drawCookRing(ctx, st) {
    if (st.cookState === 'idle' || st.cookState === 'burnt') return;
    const rx = st.x;
    const ry = st.y - 2;
    ctx.save();
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(18, 14, 12, 0.65)';
    ctx.beginPath();
    ctx.arc(rx, ry, 28, 0, Math.PI * 2);
    ctx.stroke();

    const pct = Math.min(1, Math.max(0.04, st.progress));
    ctx.strokeStyle =
      st.cookState === 'ready'
        ? '#4ce087'
        : st.cookState === 'warning'
          ? '#ff4d40'
          : '#ffbe3d';
    ctx.beginPath();
    ctx.arc(rx, ry, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();
    ctx.restore();
  }

  drawCuttingBoardStation(ctx, st, elapsed) {
    // Maple wood board
    ctx.fillStyle = '#e7c697';
    roundRectPath(ctx, st.x - 38, st.y - 28, 76, 52, 8);
    ctx.fill();
    ctx.strokeStyle = '#9d7244';
    ctx.lineWidth = 1.6;
    roundRectPath(ctx, st.x - 38, st.y - 28, 76, 52, 8);
    ctx.stroke();

    // Board grip slot
    ctx.fillStyle = '#8b6238';
    roundRectPath(ctx, st.x - 16, st.y - 23, 32, 4, 2);
    ctx.fill();

    if (st.item) {
      drawIngredientArt(ctx, st.item.type, st.x - 3, st.y - 1, 0.96);
      if (st.progress > 0) {
        // Progress bar above board
        ctx.fillStyle = '#241b16';
        roundRectPath(ctx, st.x - 28, st.y - 39, 56, 8, 4);
        ctx.fill();
        ctx.fillStyle = '#53d67f';
        roundRectPath(ctx, st.x - 26, st.y - 37, Math.max(4, 52 * st.progress), 4, 2);
        ctx.fill();
      }
    }

    // Chef knife resting or chopping
    const chopAnim = st.progress > 0 ? Math.sin(elapsed * 26) * 0.28 : 0;
    ctx.save();
    ctx.translate(st.x + 22, st.y + 4);
    ctx.rotate(-0.4 + chopAnim);
    ctx.fillStyle = '#332721';
    ctx.fillRect(-3, 4, 6, 12);
    ctx.fillStyle = '#dfe5ea';
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.lineTo(4, 4);
    ctx.lineTo(3, -15);
    ctx.quadraticCurveTo(0, -19, -4, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8d9aa4';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    this.drawStationTag(ctx, st.x, st.y + 34, st.label);
  }

  drawAssemblyStation(ctx, st, orders, elapsed) {
    // Linen / brass plating mat
    ctx.fillStyle = '#faf5ec';
    roundRectPath(ctx, st.x - 42, st.y - 29, 84, 54, 9);
    ctx.fill();
    ctx.strokeStyle = '#c49f6c';
    ctx.lineWidth = 1.8;
    roundRectPath(ctx, st.x - 42, st.y - 29, 84, 54, 9);
    ctx.stroke();

    if (st.item && st.item.kind === 'plate') {
      drawDishArt(ctx, st.item, st.x, st.y - 2, 24, st.item.complete);
      const count = st.item.ingredients.length;
      if (st.item.complete) {
        const recipe = getRecipe(st.item.recipeId);
        const glow = 0.65 + Math.sin(elapsed * 5) * 0.25;
        this.drawStationTag(ctx, st.x, st.y - 36, `READY: ${recipe.shortName}`, `rgba(42, 148, 86, ${glow.toFixed(2)})`, '#ffffff');
      } else if (count > 0) {
        const target = inferTargetRecipe(st.item, orders);
        const missing = target ? target.ingredients.filter((id) => !st.item.ingredients.includes(id)) : [];
        const hint = missing.length > 0 ? `+ ${INGREDIENTS[missing[0]].short}` : 'Assembling';
        this.drawStationTag(ctx, st.x, st.y - 36, `${count}/3 • ${hint}`, '#b05d20', '#fff7e6');
      }
    } else if (st.item && st.item.kind === 'ingredient') {
      drawIngredientArt(ctx, st.item.type, st.x, st.y - 2, 0.95);
    } else {
      // Subtle target circle
      ctx.strokeStyle = 'rgba(176, 142, 102, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(st.x, st.y - 2, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    this.drawStationTag(ctx, st.x, st.y + 34, st.label);
  }

  drawPassReadyStation(ctx, st, elapsed) {
    // Heated stainless/brass pass mat
    ctx.fillStyle = '#3a3430';
    roundRectPath(ctx, st.x - 42, st.y - 29, 84, 54, 9);
    ctx.fill();

    // Warm infrared heat glow
    const pulse = 0.35 + Math.sin(elapsed * 4) * 0.1;
    ctx.fillStyle = st.item ? `rgba(255, 198, 72, ${pulse + 0.18})` : `rgba(255, 178, 64, ${pulse * 0.6})`;
    roundRectPath(ctx, st.x - 38, st.y - 25, 76, 46, 7);
    ctx.fill();

    ctx.strokeStyle = PALETTE.brass;
    ctx.lineWidth = 2;
    roundRectPath(ctx, st.x - 42, st.y - 29, 84, 54, 9);
    ctx.stroke();

    if (st.item && st.item.kind === 'plate') {
      drawDishArt(ctx, st.item, st.x, st.y - 2, 25, true);
      this.drawStationTag(ctx, st.x, st.y - 36, 'READY TO SERVE!', '#d98a1e', '#1e140c');
    }

    this.drawStationTag(ctx, st.x, st.y + 34, 'Heated Pass', '#80571d', '#fff3d6');
  }

  drawServiceBellStation(ctx, st, elapsed) {
    // Golden window ledge
    ctx.fillStyle = '#2d241e';
    roundRectPath(ctx, st.x - 40, st.y - 29, 80, 54, 9);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2.2;
    roundRectPath(ctx, st.x - 40, st.y - 29, 80, 54, 9);
    ctx.stroke();

    const ringBounce = st.pulseTimer > 0 ? Math.sin(elapsed * 36) * 2.5 : 0;
    // Bell base
    ctx.fillStyle = '#40342e';
    ctx.beginPath();
    ctx.ellipse(st.x, st.y + 8, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brass dome
    const grad = ctx.createRadialGradient(st.x - 5, st.y - 8 + ringBounce, 2, st.x, st.y + ringBounce, 20);
    grad.addColorStop(0, '#fff2b0');
    grad.addColorStop(0.5, '#e8b948');
    grad.addColorStop(1, '#9b6c16');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(st.x, st.y + 4 + ringBounce, 17, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6c4909';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Bell plunger knob
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(st.x, st.y - 14 + ringBounce, 4, 0, Math.PI * 2);
    ctx.fill();

    this.drawStationTag(ctx, st.x, st.y + 34, 'Serve Bell', '#9e6c1a', '#fff4d4');
  }

  drawTrashStation(ctx, st) {
    ctx.fillStyle = '#332b28';
    roundRectPath(ctx, st.x - 30, st.y - 26, 60, 50, 9);
    ctx.fill();
    ctx.strokeStyle = '#73625a';
    ctx.lineWidth = 1.8;
    roundRectPath(ctx, st.x - 30, st.y - 26, 60, 50, 9);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(st.x, st.y - 2, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1917';
    ctx.fill();
    ctx.strokeStyle = '#5c4e48';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    this.drawStationTag(ctx, st.x, st.y + 34, 'Compost');
  }

  drawCrateStation(ctx, st) {
    // Slatted wooden pantry crate
    ctx.fillStyle = '#9a6534';
    roundRectPath(ctx, st.x - 44, st.y - 28, 88, 52, 8);
    ctx.fill();
    ctx.fillStyle = '#6a411d';
    roundRectPath(ctx, st.x - 38, st.y - 22, 76, 40, 6);
    ctx.fill();

    // Subtle wooden slats
    ctx.strokeStyle = '#865326';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(st.x - 38, st.y - 8);
    ctx.lineTo(st.x + 38, st.y - 8);
    ctx.moveTo(st.x - 38, st.y + 6);
    ctx.lineTo(st.x + 38, st.y + 6);
    ctx.stroke();

    drawIngredientArt(ctx, st.itemType, st.x, st.y - 2, 1.05);
    this.drawStationTag(ctx, st.x, st.y + 34, st.label, '#2c2018', '#ffefcf');
  }

  drawGenericCounterStation(ctx, st, orders) {
    ctx.fillStyle = 'rgba(255, 244, 224, 0.14)';
    roundRectPath(ctx, st.x - 36, st.y - 26, 72, 48, 8);
    ctx.fill();
    if (!st.item) {
      // Subtle ambient kitchenware props on empty staging counters
      ctx.save();
      ctx.globalAlpha = 0.65;
      if (st.id === 'counter-top-1') {
        // Olive oil cruet & pepper mill
        ctx.fillStyle = '#6c8f3d';
        roundRectPath(ctx, st.x - 16, st.y - 12, 11, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#e5b84b';
        ctx.fillRect(st.x - 12, st.y - 17, 3, 6);
        ctx.fillStyle = '#5c3c24';
        roundRectPath(ctx, st.x + 5, st.y - 10, 9, 16, 3);
        ctx.fill();
      } else if (st.id === 'counter-top-2') {
        // Brass sauce spoon rest
        ctx.strokeStyle = '#c88742';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(st.x - 12, st.y + 4);
        ctx.lineTo(st.x + 8, st.y - 10);
        ctx.stroke();
        ctx.fillStyle = '#d99c52';
        ctx.beginPath();
        ctx.ellipse(st.x + 11, st.y - 11, 6, 4, -0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Folded bistro garnish cloth & herb sprig
        ctx.fillStyle = '#f2eadc';
        roundRectPath(ctx, st.x - 16, st.y - 8, 22, 15, 3);
        ctx.fill();
        ctx.strokeStyle = '#d26b3b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(st.x - 13, st.y - 5, 16, 9);
      }
      ctx.restore();
    }
    if (st.item) {
      if (st.item.kind === 'plate') {
        drawDishArt(ctx, st.item, st.x, st.y - 2, 22, st.item.complete);
        if (!st.item.complete && st.item.ingredients.length > 0) {
          const target = inferTargetRecipe(st.item, orders);
          const hint = target ? target.shortName : 'Plate';
          this.drawStationTag(ctx, st.x, st.y - 34, `${st.item.ingredients.length}/3 ${hint}`, '#b05d20', '#fff7e6');
        }
      } else {
        drawIngredientArt(ctx, st.item.type, st.x, st.y - 2, 0.94);
      }
    }
    this.drawStationTag(ctx, st.x, st.y + 34, st.label);
  }

  drawChef(ctx, sim) {
    const chef = sim.chef;
    const bob = Math.sin(chef.walkCycle) * 2.2;
    const angle = Math.atan2(chef.dirY, chef.dirX);

    ctx.save();
    ctx.translate(chef.x, chef.y);
    ctx.scale(1.12, 1.12);

    // Shadow
    ctx.fillStyle = 'rgba(20, 12, 8, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 20, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle feet stepping
    const step = Math.sin(chef.walkCycle) * 4;
    ctx.fillStyle = '#2d2420';
    ctx.beginPath();
    ctx.ellipse(-7, 13 + step * 0.4, 6, 4.2, 0, 0, Math.PI * 2);
    ctx.ellipse(7, 13 - step * 0.4, 6, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Apron & white chef jacket body
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3d2f28';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, bob, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Terracotta bistro apron accent & copper neckerchief
    ctx.fillStyle = '#d36535';
    ctx.beginPath();
    ctx.arc(0, bob + 3, 14, 0.15, Math.PI - 0.15);
    ctx.fill();

    // Expressive hands reaching toward held item or facing direction
    const handReach = chef.holding ? 18 : 14;
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    for (const side of [-1, 1]) {
      const handX = Math.cos(angle) * handReach + perpX * side * 9;
      const handY = bob + Math.sin(angle) * handReach * 0.75 + perpY * side * 9;
      ctx.fillStyle = '#f8d2b4';
      ctx.strokeStyle = '#4a3326';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(handX, handY, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Head & chef's toque
    const hx = Math.cos(angle) * 3;
    const hy = bob - 9 + Math.sin(angle) * 2;
    ctx.fillStyle = '#f8d2b4';
    ctx.strokeStyle = '#4a3326';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(hx, hy + 2, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eyes facing direction
    const ex = Math.cos(angle) * 4;
    const ey = Math.sin(angle) * 3;
    ctx.fillStyle = '#261a14';
    ctx.beginPath();
    ctx.arc(hx + ex - 3, hy + 2 + ey, 1.8, 0, Math.PI * 2);
    ctx.arc(hx + ex + 3, hy + 2 + ey, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Pleated white chef hat (toque)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#4d3b31';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, hx - 9, hy - 14, 18, 9, 4);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(hx, hy - 16, 12.5, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Held item carried cleanly in front/above hands
    if (chef.holding) {
      const carryX = Math.cos(angle) * 22;
      const carryY = bob - 4 + Math.sin(angle) * 18;
      if (chef.holding.kind === 'plate') {
        drawDishArt(ctx, chef.holding, carryX, carryY, 19, chef.holding.complete);
      } else {
        drawIngredientArt(ctx, chef.holding.type, carryX, carryY, 0.85);
      }
    }

    ctx.restore();
  }

  drawParticlesAndPopups(ctx, sim) {
    for (const p of sim.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const pop of sim.popups) {
      const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${pop.size}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20, 12, 8, 0.88)';
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }
  }

  drawOrderBoardHud(ctx, sim, audioMuted) {
    // Dark slate-walnut overhead rail backing
    const bgGrad = ctx.createLinearGradient(0, 0, 0, ORDER_BAR_HEIGHT);
    bgGrad.addColorStop(0, '#1f1916');
    bgGrad.addColorStop(1, '#2b221e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, ORDER_BAR_HEIGHT);

    // Brass ticket hanging bar
    ctx.fillStyle = '#b98934';
    ctx.fillRect(244, 14, 900, 5);

    // Left HUD Panel: Brand, Shift Timer, Score & Combo
    ctx.fillStyle = '#332924';
    roundRectPath(ctx, 14, 10, 222, 146, 12);
    ctx.fill();
    ctx.strokeStyle = '#6f5544';
    ctx.lineWidth = 1.6;
    roundRectPath(ctx, 14, 10, 222, 146, 12);
    ctx.stroke();

    ctx.fillStyle = '#f5cb6c';
    ctx.font = '800 13px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('COPPER & THYME', 28, 20);

    ctx.fillStyle = '#cbb9a6';
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(`SHIFT ${sim.shift.number}: ${sim.shift.name.toUpperCase()}`, 28, 38);

    // Prominent Shift Countdown Timer
    const urgentTime = sim.timeLeft <= 20;
    const warnTime = sim.timeLeft <= 40;
    const timerColor = urgentTime ? '#ff5f52' : warnTime ? '#ffbd4a' : '#fff7e8';
    ctx.fillStyle = '#221b18';
    roundRectPath(ctx, 26, 58, 104, 42, 8);
    ctx.fill();
    ctx.strokeStyle = urgentTime ? '#ff5f52' : '#57463c';
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, 26, 58, 104, 42, 8);
    ctx.stroke();

    ctx.fillStyle = '#b8a28d';
    ctx.font = '700 9px system-ui, -apple-system, sans-serif';
    ctx.fillText('TIMER', 35, 64);
    ctx.fillStyle = timerColor;
    ctx.font = '800 22px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(formatClock(sim.timeLeft), 34, 74);

    // Score Box
    ctx.fillStyle = '#221b18';
    roundRectPath(ctx, 136, 58, 88, 42, 8);
    ctx.fill();
    ctx.fillStyle = '#b8a28d';
    ctx.font = '700 9px system-ui, -apple-system, sans-serif';
    ctx.fillText('EARNINGS', 144, 64);
    ctx.fillStyle = '#73e89c';
    ctx.font = '800 21px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`$${sim.score}`, 144, 74);

    // Star Goal Progress Bar & Combo Pill
    const [g1, g2, g3] = sim.shift.starGoals;
    const pct = Math.min(1, sim.score / g3);
    ctx.fillStyle = '#1c1613';
    roundRectPath(ctx, 26, 110, 198, 10, 5);
    ctx.fill();
    ctx.fillStyle = '#e7b144';
    if (pct > 0) {
      roundRectPath(ctx, 26, 110, Math.max(8, 198 * pct), 10, 5);
      ctx.fill();
    }
    ctx.fillStyle = '#d4c3b2';
    ctx.font = '600 10px system-ui, -apple-system, sans-serif';
    ctx.fillText(`★$${g1}  ★★$${g2}  ★★★$${g3}`, 28, 126);

    if (sim.combo > 1) {
      ctx.fillStyle = '#df5d2b';
      roundRectPath(ctx, 154, 17, 72, 22, 11);
      ctx.fill();
      ctx.strokeStyle = '#ffcf70';
      ctx.lineWidth = 1.2;
      roundRectPath(ctx, 154, 17, 72, 22, 11);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`COMBO x${sim.combo}`, 190, 28);
      ctx.textBaseline = 'top';
    }

    // Active Order Tickets
    const activePlate = this.findActiveMidAssemblyPlate(sim);
    const ticketW = 216;
    const ticketH = 142;
    const startX = 250;
    const gap = 10;

    for (let i = 0; i < sim.orders.length; i += 1) {
      const ord = sim.orders[i];
      const recipe = getRecipe(ord.recipeId);
      const tx = startX + i * (ticketW + gap);
      const ty = 14;
      const ratio = Math.max(0, Math.min(1, ord.timeLeft / ord.maxTime));
      const shakeX = ratio < 0.22 ? Math.sin(sim.elapsed * 28 + i) * 2 : 0;

      ctx.save();
      ctx.translate(shakeX, 0);

      // Ticket paper shadow & body
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      roundRectPath(ctx, tx + 2, ty + 4, ticketW, ticketH, 9);
      ctx.fill();

      ctx.fillStyle = ord.vip ? '#fff4d6' : PALETTE.ticketCream;
      roundRectPath(ctx, tx, ty, ticketW, ticketH, 9);
      ctx.fill();
      ctx.strokeStyle = ord.vip ? '#e3a629' : PALETTE.ticketBorder;
      ctx.lineWidth = ord.vip ? 2.4 : 1.5;
      roundRectPath(ctx, tx, ty, ticketW, ticketH, 9);
      ctx.stroke();

      // Brass clip pin
      ctx.fillStyle = '#d8a544';
      roundRectPath(ctx, tx + ticketW / 2 - 14, ty - 4, 28, 9, 4);
      ctx.fill();

      // Ticket top ribbon
      ctx.fillStyle = ord.vip ? '#c97917' : '#3b2e26';
      roundRectPath(ctx, tx + 6, ty + 8, ticketW - 12, 22, 5);
      ctx.fill();

      ctx.fillStyle = '#fff9ee';
      ctx.font = '700 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${ord.ticketNumber} • Table ${ord.tableNum}`, tx + 13, ty + 19);

      ctx.textAlign = 'right';
      ctx.fillStyle = ord.vip ? '#fff4a6' : '#8bf2a6';
      ctx.font = '800 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(ord.vip ? `VIP $${ord.value}` : `$${ord.value}`, tx + ticketW - 13, ty + 19);

      // Dish thumbnail + title
      const previewPlate = createPlate(recipe.ingredients, 0);
      drawDishArt(ctx, previewPlate, tx + 34, ty + 58, 20, false);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#2b2019';
      ctx.font = '800 13.5px system-ui, -apple-system, sans-serif';
      ctx.fillText(recipe.shortName, tx + 60, ty + 51);
      ctx.fillStyle = '#755e4c';
      ctx.font = '600 10.5px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${Math.ceil(ord.timeLeft)}s remaining`, tx + 60, ty + 67);

      // 3 Ingredient step badges with live match checkmarks!
      const pillW = 62;
      const pillStartX = tx + 10;
      const pillY = ty + 84;
      for (let k = 0; k < recipe.ingredients.length; k += 1) {
        const ingId = recipe.ingredients[k];
        const ing = INGREDIENTS[ingId];
        const px = pillStartX + k * (pillW + 5);
        const alreadyPlated =
          activePlate &&
          activePlate.ingredients.every((x) => recipe.ingredients.includes(x)) &&
          activePlate.ingredients.includes(ingId);

        ctx.fillStyle = alreadyPlated ? '#daf5e3' : '#f1e5d1';
        roundRectPath(ctx, px, pillY, pillW, 38, 6);
        ctx.fill();
        ctx.strokeStyle = alreadyPlated ? '#2fa866' : '#d2bea1';
        ctx.lineWidth = alreadyPlated ? 1.8 : 1;
        roundRectPath(ctx, px, pillY, pillW, 38, 6);
        ctx.stroke();

        drawIngredientArt(ctx, ingId, px + 17, pillY + 18, 0.56);

        ctx.fillStyle = alreadyPlated ? '#1d6f42' : '#4a382c';
        ctx.font = '700 9.5px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(ing.short.slice(0, 6), px + 29, pillY + 14);

        const prepTag = alreadyPlated
          ? '✓ OK'
          : ing.prep === 'board'
            ? 'Chop'
            : ing.prep === 'skillet'
              ? 'Sear'
              : ing.prep === 'pot'
                ? 'Boil'
                : 'Fresh';
        ctx.fillStyle = alreadyPlated ? '#268a54' : '#8a6849';
        ctx.font = '600 9px system-ui, -apple-system, sans-serif';
        ctx.fillText(prepTag, px + 29, pillY + 27);
      }

      // Patience bar
      ctx.fillStyle = '#e0d2bc';
      roundRectPath(ctx, tx + 10, ty + 128, ticketW - 20, 8, 4);
      ctx.fill();
      const barCol = ratio > 0.5 ? PALETTE.emerald : ratio > 0.25 ? PALETTE.amber : PALETTE.crimson;
      ctx.fillStyle = barCol;
      if (ratio > 0) {
        roundRectPath(ctx, tx + 10, ty + 128, Math.max(8, (ticketW - 20) * ratio), 8, 4);
        ctx.fill();
      }

      ctx.restore();
    }

    // Right Utility Buttons: Sound, Recipes, Pause
    this.drawUtilityButton(ctx, 'btn-mute', 1158, 16, 108, 40, audioMuted ? 'Sound: OFF [M]' : 'Sound: ON [M]', audioMuted ? '#4a3532' : '#3a302b');
    this.drawUtilityButton(ctx, 'btn-recipes', 1158, 64, 108, 40, 'Recipes [R]', '#3a302b');
    this.drawUtilityButton(ctx, 'btn-pause', 1158, 112, 108, 40, sim.mode === 'paused' ? 'Resume [Esc]' : 'Pause [Esc]', '#3a302b');
  }

  drawUtilityButton(ctx, id, x, y, w, h, label, fill) {
    this.registerUiRegion(id, x, y, w, h);
    ctx.fillStyle = fill;
    roundRectPath(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = '#755e4d';
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, x, y, w, h, 8);
    ctx.stroke();

    ctx.fillStyle = '#f8ebd6';
    ctx.font = '700 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  findActiveMidAssemblyPlate(sim) {
    if (sim.chef.holding && sim.chef.holding.kind === 'plate' && !sim.chef.holding.complete && sim.chef.holding.ingredients.length > 0) {
      return sim.chef.holding;
    }
    for (const st of sim.stations) {
      if ((st.kind === 'assembly' || st.kind === 'counter') && st.item && st.item.kind === 'plate' && !st.item.complete && st.item.ingredients.length > 0) {
        return st.item;
      }
    }
    return null;
  }

  drawBottomControlStrip(ctx, sim) {
    ctx.fillStyle = '#1b1512';
    ctx.fillRect(0, 692, CANVAS_WIDTH, 28);

    const held = sim.chef.holding;
    let holdingLabel = 'Hands: Empty';
    if (held) {
      if (held.kind === 'plate') {
        if (held.complete) {
          holdingLabel = `Holding: ${getRecipe(held.recipeId).name} (Ready to Serve!)`;
        } else if (held.ingredients.length === 0) {
          holdingLabel = 'Holding: Clean Plate';
        } else {
          holdingLabel = `Holding: Dish Mid-Assembly (${held.ingredients.map((i) => INGREDIENTS[i].short).join(' + ')})`;
        }
      } else {
        holdingLabel = `Holding: ${INGREDIENTS[held.type].name}`;
      }
    }

    ctx.fillStyle = '#f4cf77';
    ctx.font = '700 12.5px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(holdingLabel, 22, 706);

    ctx.fillStyle = '#cdbca9';
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Move: WASD / Arrows or Click Station   •   Interact / Serve: Space / E / Click   •   Chop / Toss Pan: F   •   Recipes: R', CANVAS_WIDTH - 22, 706);
  }

  drawToast(ctx, sim) {
    if (!sim.toast) return;
    const t = sim.toast;
    const alpha = Math.min(1, t.timer * 2.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 14px system-ui, -apple-system, sans-serif';
    const w = ctx.measureText(t.text).width + 36;
    const x = CANVAS_WIDTH / 2 - w / 2;
    const y = 178;
    const bg =
      t.tone === 'danger'
        ? '#9e2620'
        : t.tone === 'warn'
          ? '#a35e18'
          : t.tone === 'good'
            ? '#207a49'
            : '#2d2420';
    ctx.fillStyle = bg;
    roundRectPath(ctx, x, y, w, 32, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 210, 0.55)';
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, x, y, w, 32, 16);
    ctx.stroke();

    ctx.fillStyle = '#fff9ee';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.text, CANVAS_WIDTH / 2, y + 16);
    ctx.restore();
  }

  drawTitleOverlay(ctx, sim) {
    ctx.fillStyle = 'rgba(18, 12, 9, 0.52)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const cardW = 760;
    const cardH = 470;
    const cx = (CANVAS_WIDTH - cardW) / 2;
    const cy = (CANVAS_HEIGHT - cardH) / 2 + 12;

    ctx.fillStyle = '#28201c';
    roundRectPath(ctx, cx, cy, cardW, cardH, 18);
    ctx.fill();
    ctx.strokeStyle = '#d79e49';
    ctx.lineWidth = 2.5;
    roundRectPath(ctx, cx, cy, cardW, cardH, 18);
    ctx.stroke();

    // Header banner
    ctx.fillStyle = '#f6cf70';
    ctx.font = '800 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('COPPER & THYME', CANVAS_WIDTH / 2, cy + 24);

    ctx.fillStyle = '#ebd7c0';
    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('BISTRO RUSH  •  Plan your route, prep ingredients, plate & ring the bell!', CANVAS_WIDTH / 2, cy + 68);

    // 3 Selectable Shift Cards
    const shiftW = 222;
    const shiftH = 152;
    const sxStart = cx + 32;
    const sy = cy + 112;
    for (let i = 0; i < SHIFTS.length; i += 1) {
      const sh = SHIFTS[i];
      const sx = sxStart + i * (shiftW + 15);
      const selected = sim.shiftIndex === i;
      this.registerUiRegion(`select-shift-${i}`, sx, sy, shiftW, shiftH, { shiftIndex: i });

      ctx.fillStyle = selected ? '#443225' : '#322823';
      roundRectPath(ctx, sx, sy, shiftW, shiftH, 12);
      ctx.fill();
      ctx.strokeStyle = selected ? '#f5c24c' : '#655042';
      ctx.lineWidth = selected ? 2.6 : 1.4;
      roundRectPath(ctx, sx, sy, shiftW, shiftH, 12);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = selected ? '#ffd76d' : '#d6c1ac';
      ctx.font = '800 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(`SHIFT ${sh.number}`, sx + 16, sy + 16);

      ctx.fillStyle = '#fff5e5';
      ctx.font = '800 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(sh.name, sx + 16, sy + 36);

      ctx.fillStyle = '#cab7a5';
      ctx.font = '500 12px system-ui, -apple-system, sans-serif';
      this.drawWrappedText(ctx, sh.subtitle, sx + 16, sy + 64, shiftW - 32, 17);

      ctx.fillStyle = '#8ce8a9';
      ctx.font = '700 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Best: $${sim.bestScores[i]}`, sx + 16, sy + 122);
    }

    // Mini recipe strip preview
    ctx.fillStyle = '#1f1815';
    roundRectPath(ctx, cx + 32, cy + 282, cardW - 64, 82, 10);
    ctx.fill();
    ctx.fillStyle = '#e7b95c';
    ctx.font = '700 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HOW TO SERVE:', cx + 48, cy + 294);
    ctx.fillStyle = '#dfd0c0';
    ctx.font = '500 13px system-ui, -apple-system, sans-serif';
    ctx.fillText('1. Grab ingredients on the bottom counter  →  2. Chop on Boards / Sear in Skillets / Boil in Pot', cx + 48, cy + 316);
    ctx.fillText('3. Combine 3 parts on an Assembly Mat  →  4. Deliver to the Heated Pass or Service Bell!', cx + 48, cy + 338);

    // Primary CTA buttons
    this.drawActionPill(ctx, 'start-service', CANVAS_WIDTH / 2 - 190, cy + 388, 224, 50, 'START SERVICE [ENTER]', '#d9783b', '#ffffff');
    this.drawActionPill(ctx, 'open-recipes', CANVAS_WIDTH / 2 + 52, cy + 388, 160, 50, 'RECIPE BOOK [R]', '#443730', '#ffecc9');
  }

  drawRecipesOverlay(ctx) {
    ctx.fillStyle = 'rgba(18, 12, 9, 0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const w = 920;
    const h = 540;
    const x = (CANVAS_WIDTH - w) / 2;
    const y = (CANVAS_HEIGHT - h) / 2;

    ctx.fillStyle = '#2a211d';
    roundRectPath(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = '#d79e49';
    ctx.lineWidth = 2.4;
    roundRectPath(ctx, x, y, w, h, 18);
    ctx.stroke();

    ctx.fillStyle = '#f6cf70';
    ctx.font = '800 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('CHEF PIPPIN’S BISTRO RECIPE BOOK', CANVAS_WIDTH / 2, y + 22);

    const rowYStart = y + 72;
    const rowH = 74;
    for (let i = 0; i < RECIPES.length; i += 1) {
      const r = RECIPES[i];
      const ry = rowYStart + i * (rowH + 10);
      ctx.fillStyle = '#382c26';
      roundRectPath(ctx, x + 28, ry, w - 56, rowH, 12);
      ctx.fill();

      drawDishArt(ctx, createPlate(r.ingredients, 0), x + 76, ry + rowH / 2, 26, true);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff5e6';
      ctx.font = '800 16px system-ui, -apple-system, sans-serif';
      ctx.fillText(r.name, x + 122, ry + 16);
      ctx.fillStyle = '#89eba7';
      ctx.font = '700 14px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Base Pay: $${r.price}`, x + 122, ry + 41);

      for (let k = 0; k < r.ingredients.length; k += 1) {
        const ing = INGREDIENTS[r.ingredients[k]];
        const bx = x + 360 + k * 172;
        ctx.fillStyle = '#261e1a';
        roundRectPath(ctx, bx, ry + 13, 158, 48, 8);
        ctx.fill();
        drawIngredientArt(ctx, ing.id, bx + 26, ry + 37, 0.72);
        ctx.fillStyle = '#f8e9d2';
        ctx.font = '700 12px system-ui, -apple-system, sans-serif';
        ctx.fillText(ing.name, bx + 52, ry + 20);
        ctx.fillStyle = '#d4a66a';
        ctx.font = '600 11px system-ui, -apple-system, sans-serif';
        const step = ing.prep === 'board' ? 'Chop on Board' : ing.prep === 'skillet' ? 'Sear in Skillet' : ing.prep === 'pot' ? 'Boil in Pot' : 'Ready from Crate';
        ctx.fillText(step, bx + 52, ry + 37);
      }
    }

    this.drawActionPill(ctx, 'close-recipes', CANVAS_WIDTH / 2 - 90, y + h - 58, 180, 42, 'BACK [R / ESC]', '#d9783b', '#ffffff');
  }

  drawPauseOverlay(ctx, sim) {
    ctx.fillStyle = 'rgba(18, 12, 9, 0.64)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const w = 420;
    const h = 320;
    const x = (CANVAS_WIDTH - w) / 2;
    const y = (CANVAS_HEIGHT - h) / 2;

    ctx.fillStyle = '#2a211d';
    roundRectPath(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = '#d79e49';
    ctx.lineWidth = 2.2;
    roundRectPath(ctx, x, y, w, h, 16);
    ctx.stroke();

    ctx.fillStyle = '#f6cf70';
    ctx.font = '800 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('SERVICE PAUSED', CANVAS_WIDTH / 2, y + 26);

    ctx.fillStyle = '#d6c3b0';
    ctx.font = '600 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Shift ${sim.shift.number}: ${sim.shift.name}  •  $${sim.score}`, CANVAS_WIDTH / 2, y + 66);

    this.drawActionPill(ctx, 'resume-service', x + 70, y + 106, 280, 44, 'RESUME SERVICE [ESC]', '#2ea86b', '#ffffff');
    this.drawActionPill(ctx, 'open-recipes', x + 70, y + 162, 280, 44, 'RECIPE BOOK [R]', '#493a32', '#ffefd2');
    this.drawActionPill(ctx, 'restart-shift', x + 70, y + 218, 134, 44, 'RESTART', '#b8642c', '#ffffff');
    this.drawActionPill(ctx, 'to-title', x + 216, y + 218, 134, 44, 'TITLE MENU', '#443730', '#ffefd2');
  }

  drawSummaryOverlay(ctx, sim) {
    ctx.fillStyle = 'rgba(18, 12, 9, 0.68)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const w = 540;
    const h = 390;
    const x = (CANVAS_WIDTH - w) / 2;
    const y = (CANVAS_HEIGHT - h) / 2;

    ctx.fillStyle = '#29201c';
    roundRectPath(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = '#e5b14c';
    ctx.lineWidth = 2.5;
    roundRectPath(ctx, x, y, w, h, 18);
    ctx.stroke();

    ctx.fillStyle = '#f6cf70';
    ctx.font = '800 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('SHIFT COMPLETE!', CANVAS_WIDTH / 2, y + 24);

    const stars = sim.getStarRating();
    ctx.font = '700 34px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffd44d';
    ctx.fillText(`${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, CANVAS_WIDTH / 2, y + 66);

    const rows = [
      ['Total Earnings', `$${sim.score}`],
      ['Dishes Served', `${sim.dishesServed}`],
      ['Speed & Quality Tips', `$${sim.tipsEarned}`],
      ['Best Streak', `x${Math.max(1, sim.bestCombo)}`],
      ['Missed Tickets', `${sim.ordersExpired}`],
    ];
    for (let i = 0; i < rows.length; i += 1) {
      const ry = y + 124 + i * 34;
      ctx.fillStyle = i % 2 === 0 ? '#342924' : '#2e2420';
      roundRectPath(ctx, x + 40, ry, w - 80, 30, 6);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#dfd0c0';
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText(rows[i][0], x + 56, ry + 8);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#8ef0ab';
      ctx.font = '800 15px system-ui, -apple-system, sans-serif';
      ctx.fillText(rows[i][1], x + w - 56, ry + 7);
    }

    const hasNext = sim.shiftIndex < SHIFTS.length - 1;
    if (hasNext) {
      this.drawActionPill(ctx, 'next-shift', x + 46, y + 318, 172, 46, 'NEXT SHIFT [ENTER]', '#2ea86b', '#ffffff');
      this.drawActionPill(ctx, 'restart-shift', x + 232, y + 318, 134, 46, 'REPLAY', '#d9783b', '#ffffff');
      this.drawActionPill(ctx, 'to-title', x + 380, y + 318, 114, 46, 'MENU', '#493b33', '#ffefd2');
    } else {
      this.drawActionPill(ctx, 'restart-shift', x + 90, y + 318, 170, 46, 'REPLAY [ENTER]', '#d9783b', '#ffffff');
      this.drawActionPill(ctx, 'to-title', x + 280, y + 318, 170, 46, 'TITLE MENU', '#493b33', '#ffefd2');
    }
  }

  drawActionPill(ctx, id, x, y, w, h, label, fill, textColor) {
    this.registerUiRegion(id, x, y, w, h);
    ctx.fillStyle = fill;
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 210, 0.35)';
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = '800 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  drawWrappedText(ctx, text, x, y, maxW, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxW && line) {
        ctx.fillText(line, x, cy);
        line = word;
        cy += lineHeight;
      } else {
        line = next;
      }
    }
    if (line) ctx.fillText(line, x, cy);
  }
}
