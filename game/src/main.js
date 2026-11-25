/**
 * Main entry point for Copper & Thyme: Bistro Rush.
 * Connects fixed-timestep kitchen simulation, canvas scaling, procedural Web Audio,
 * unified keyboard/mouse input, and live accessibility status announcements.
 */
import { CANVAS_HEIGHT, CANVAS_WIDTH, TIMINGS } from './config.js';
import { BistroAudio } from './audio.js';
import { KitchenInput } from './input.js';
import { KitchenRenderer } from './kitchen-renderer.js';
import { KitchenSimulation } from './kitchen-state.js';

const canvas = document.getElementById('bistro-canvas');
const statusEl = document.getElementById('status-live');
const ctx = canvas.getContext('2d');

function announce(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

const audio = new BistroAudio();
const sim = new KitchenSimulation(20261125, (eventName, payload) => {
  audio.handleEvent(eventName, payload);
  if (eventName === 'serve') {
    announce(`Served dish for $${payload.earned}, total earnings $${sim.score}`);
  } else if (eventName === 'shiftEnd') {
    announce(`Shift complete! Earnings $${payload.score}, ${payload.dishesServed} dishes served.`);
  }
});

const renderer = new KitchenRenderer();
const input = new KitchenInput(canvas, sim, renderer, audio, announce);

function syncCanvasResolution() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const targetW = Math.round(CANVAS_WIDTH * dpr);
  const targetH = Math.round(CANVAS_HEIGHT * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', syncCanvasResolution);
syncCanvasResolution();

let lastTime = performance.now();
let accumulator = 0;

function tick(now) {
  const frameDt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += frameDt;

  const controls = input.readControls();
  while (accumulator >= TIMINGS.fixedStep) {
    sim.step(TIMINGS.fixedStep, controls);
    accumulator -= TIMINGS.fixedStep;
  }

  syncCanvasResolution();
  renderer.render(ctx, sim, audio.muted, input.hoveredStationId);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
