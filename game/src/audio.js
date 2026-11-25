/**
 * Procedural Web Audio synthesizer for Copper & Thyme.
 * Generates all sound effects offline (knife chops, skillet sizzle, pot bubble,
 * porcelain plate clink, brass service bell, and combo chimes) with zero external assets.
 */
export class BistroAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.noiseBuffer = null;
  }

  unlock() {
    if (this.muted || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  createNoiseBuffer(ctx) {
    const length = Math.floor(ctx.sampleRate * 0.4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  playTone(freq, duration, type = 'sine', gainPeak = 0.12, delay = 0, slideTo = null) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playNoise(duration, filterFreq, gainPeak = 0.08, q = 1.8) {
    if (this.muted || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(q, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  handleEvent(name, payload = {}) {
    if (this.muted) return;
    this.unlock();
    switch (name) {
      case 'pickup':
        this.playTone(340, 0.07, 'triangle', 0.09, 0, 480);
        break;
      case 'place':
        this.playTone(260, 0.07, 'triangle', 0.09, 0, 210);
        break;
      case 'chop':
        this.playNoise(0.055, 1900, 0.12, 2.4);
        this.playTone(210, 0.045, 'triangle', 0.08, 0, 130);
        break;
      case 'chopDone':
        this.playTone(580, 0.09, 'sine', 0.1, 0, 740);
        break;
      case 'toss':
        this.playNoise(0.14, 3400, 0.1, 1.4);
        this.playTone(310, 0.08, 'sine', 0.06, 0, 430);
        break;
      case 'cookDone':
        this.playTone(660, 0.11, 'sine', 0.11, 0);
        this.playTone(880, 0.14, 'sine', 0.11, 0.08);
        break;
      case 'burnt':
        this.playTone(170, 0.25, 'sawtooth', 0.09, 0, 95);
        break;
      case 'plate':
        this.playTone(920, 0.08, 'sine', 0.08, 0, 1080);
        this.playTone(1380, 0.07, 'triangle', 0.05, 0.02);
        break;
      case 'trash':
        this.playNoise(0.11, 750, 0.09, 1.2);
        break;
      case 'serve': {
        // Brass service bell ding + combo ascending chord
        const combo = payload.combo ?? 1;
        this.playTone(1318, 0.36, 'sine', 0.15, 0);
        this.playTone(2637, 0.24, 'sine', 0.06, 0);
        const notes = [523, 659, 784, 1046];
        const count = Math.min(notes.length, combo + 1);
        for (let i = 0; i < count; i += 1) {
          this.playTone(notes[i], 0.16, 'triangle', 0.09, 0.06 + i * 0.055);
        }
        break;
      }
      case 'orderExpired':
        this.playTone(240, 0.22, 'sawtooth', 0.08, 0, 150);
        break;
      case 'shiftEnd':
        this.playTone(523, 0.18, 'triangle', 0.12, 0);
        this.playTone(659, 0.18, 'triangle', 0.12, 0.12);
        this.playTone(784, 0.24, 'triangle', 0.13, 0.24);
        this.playTone(1046, 0.42, 'sine', 0.14, 0.36);
        break;
      default:
        break;
    }
  }
}
