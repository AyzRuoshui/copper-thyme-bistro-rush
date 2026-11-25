/**
 * Unified keyboard and mouse controller for Copper & Thyme.
 * Supports WASD/Arrows + Space/E/F/Q/R/M/Esc AND full mouse hover, UI buttons,
 * click-to-walk station routing, and rapid-click chopping.
 */
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './config.js';

export class KitchenInput {
  constructor(canvas, sim, renderer, audio, onAnnounce) {
    this.canvas = canvas;
    this.sim = sim;
    this.renderer = renderer;
    this.audio = audio;
    this.onAnnounce = onAnnounce;

    this.keysDown = new Set();
    this.pointerDown = false;
    this.hoveredStationId = null;

    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onKeyUp = this.handleKeyUp.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerDown = this.handlePointerDown.bind(this);
    this.onPointerUp = this.handlePointerUp.bind(this);
    this.onBlur = this.handleBlur.bind(this);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  toCanvasCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  }

  handleBlur() {
    this.keysDown.clear();
    this.pointerDown = false;
  }

  handleKeyDown(event) {
    this.audio.unlock();
    const code = event.code;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      event.preventDefault();
    }

    const firstPress = !this.keysDown.has(code);
    this.keysDown.add(code);
    if (!firstPress) return;

    if (code === 'KeyM') {
      const muted = this.audio.toggleMute();
      this.onAnnounce(muted ? 'Sound muted' : 'Sound enabled');
      return;
    }

    if (code === 'KeyR') {
      if (this.sim.mode === 'recipes') {
        this.sim.mode = this.sim.returnMode;
      } else if (this.sim.mode === 'title' || this.sim.mode === 'playing' || this.sim.mode === 'paused') {
        this.sim.returnMode = this.sim.mode;
        this.sim.mode = 'recipes';
      }
      return;
    }

    if (code === 'Escape' || code === 'KeyP') {
      if (this.sim.mode === 'recipes') {
        this.sim.mode = this.sim.returnMode;
      } else if (this.sim.mode === 'playing') {
        this.sim.mode = 'paused';
      } else if (this.sim.mode === 'paused') {
        this.sim.mode = 'playing';
      }
      return;
    }

    if (code === 'Enter') {
      if (this.sim.mode === 'title') {
        this.sim.reset(this.sim.shiftIndex, 'playing');
        this.onAnnounce(`Started Shift ${this.sim.shift.number}: ${this.sim.shift.name}`);
        return;
      }
      if (this.sim.mode === 'summary') {
        const nextIdx = this.sim.shiftIndex < 2 ? this.sim.shiftIndex + 1 : this.sim.shiftIndex;
        this.sim.reset(nextIdx, 'playing');
        return;
      }
    }

    if (this.sim.mode === 'title') {
      if (code === 'Digit1') this.sim.reset(0, 'title');
      if (code === 'Digit2') this.sim.reset(1, 'title');
      if (code === 'Digit3') this.sim.reset(2, 'title');
      if (code === 'Space') {
        this.sim.reset(this.sim.shiftIndex, 'playing');
        return;
      }
    }

    if (this.sim.mode !== 'playing') return;

    if (code === 'Space' || code === 'KeyE') {
      this.sim.interactWithStation();
    } else if (code === 'KeyF' || code === 'ShiftLeft' || code === 'ShiftRight') {
      this.sim.workAtStation(undefined, true);
    } else if (code === 'KeyQ' || code === 'KeyX') {
      if (this.sim.chef.holding) {
        const trash = this.sim.getStation('trash');
        if (trash && Math.hypot(trash.x - this.sim.chef.x, trash.y - this.sim.chef.y) <= 95) {
          this.sim.interactWithStation(trash);
        } else {
          this.sim.queueWalkToStation(trash, 'interact');
        }
      }
    }
  }

  handleKeyUp(event) {
    this.keysDown.delete(event.code);
  }

  handlePointerMove(event) {
    const pt = this.toCanvasCoords(event.clientX, event.clientY);
    const ui = this.renderer.hitTestUi(pt.x, pt.y);
    if (ui) {
      this.hoveredStationId = null;
      this.canvas.style.cursor = 'pointer';
      return;
    }
    const station = this.sim.mode === 'playing' ? this.sim.findStationAtPoint(pt.x, pt.y) : null;
    this.hoveredStationId = station ? station.id : null;
    this.canvas.style.cursor = station ? 'pointer' : 'default';
  }

  handlePointerDown(event) {
    this.audio.unlock();
    if (event.button !== 0) return;
    this.pointerDown = true;

    const pt = this.toCanvasCoords(event.clientX, event.clientY);
    const ui = this.renderer.hitTestUi(pt.x, pt.y);
    if (ui) {
      this.triggerUiAction(ui);
      return;
    }

    if (this.sim.mode !== 'playing') return;

    const station = this.sim.findStationAtPoint(pt.x, pt.y);
    if (station) {
      this.hoveredStationId = station.id;
      this.sim.queueWalkToStation(station, 'interact');
    }
  }

  handlePointerUp() {
    this.pointerDown = false;
  }

  triggerUiAction(ui) {
    if (ui.id === 'btn-mute') {
      const muted = this.audio.toggleMute();
      this.onAnnounce(muted ? 'Sound muted' : 'Sound enabled');
      return;
    }
    if (ui.id === 'btn-recipes' || ui.id === 'open-recipes') {
      if (this.sim.mode === 'recipes') {
        this.sim.mode = this.sim.returnMode;
      } else {
        this.sim.returnMode = this.sim.mode;
        this.sim.mode = 'recipes';
      }
      return;
    }
    if (ui.id === 'close-recipes') {
      this.sim.mode = this.sim.returnMode;
      return;
    }
    if (ui.id === 'btn-pause') {
      if (this.sim.mode === 'playing') this.sim.mode = 'paused';
      else if (this.sim.mode === 'paused') this.sim.mode = 'playing';
      return;
    }
    if (ui.id === 'resume-service') {
      this.sim.mode = 'playing';
      return;
    }
    if (ui.id === 'start-service') {
      this.sim.reset(this.sim.shiftIndex, 'playing');
      return;
    }
    if (ui.id.startsWith('select-shift-')) {
      this.sim.reset(ui.shiftIndex ?? 0, 'title');
      return;
    }
    if (ui.id === 'restart-shift') {
      this.sim.reset(this.sim.shiftIndex, 'playing');
      return;
    }
    if (ui.id === 'next-shift') {
      const nextIdx = Math.min(2, this.sim.shiftIndex + 1);
      this.sim.reset(nextIdx, 'playing');
      return;
    }
    if (ui.id === 'to-title') {
      this.sim.reset(this.sim.shiftIndex, 'title');
    }
  }

  readControls() {
    let moveX = 0;
    let moveY = 0;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) moveX -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) moveX += 1;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) moveY -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) moveY += 1;

    const workHeld =
      this.keysDown.has('KeyF') ||
      this.keysDown.has('ShiftLeft') ||
      this.keysDown.has('ShiftRight') ||
      (this.pointerDown && Boolean(this.hoveredStationId?.startsWith('board-')));

    return { moveX, moveY, workHeld };
  }
}
