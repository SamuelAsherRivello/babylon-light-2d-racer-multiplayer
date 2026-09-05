import './style.css';
import { createRace, startRace, stepRace } from './simulation';
import { createWorld } from './world';
import { createUI } from './ui';
import { createAudio } from './audio';
import type { Input } from './types';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const state = createRace();
const input: Input = { throttle: false, brake: false, left: false, right: false };
const audio = createAudio();
let ready = false;
const clearInput = () => { input.throttle = input.brake = input.left = input.right = false; };
const begin = () => {
  if (!ready) return;
  clearInput();
  void audio.unlock().then(() => audio.update(state, ['start'], 0));
  startRace(state);
};
const ui = createUI(document.querySelector<HTMLElement>('#ui')!, {
  onStart: begin, onRetry: begin, onMute: (muted) => audio.setMuted(muted),
});
ui.update(state);
const keys: Record<string, keyof Input> = { KeyW: 'throttle', KeyS: 'brake', KeyA: 'left', KeyD: 'right' };
window.addEventListener('keydown', (e) => {
  const key = keys[e.code];
  if (key) { e.preventDefault(); input[key] = true; }
});
window.addEventListener('keyup', (e) => {
  const key = keys[e.code];
  if (key) { e.preventDefault(); input[key] = false; }
});
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);

async function boot() {
  try {
    const world = await createWorld(canvas);
    ready = true;
    window.addEventListener('resize', () => world.resize());
    let last = performance.now();
    let accumulated = 0;
    const frame = (now: number) => {
      const dt = document.hidden ? 0 : Math.min((now - last) / 1000, .1);
      last = now;
      accumulated += dt;
      const events: ReturnType<typeof stepRace> = [];
      while (accumulated >= 1 / 120) {
        events.push(...stepRace(state, input, 1 / 120));
        accumulated -= 1 / 120;
      }
      world.update(state, dt);
      audio.update(state, events, dt);
      ui.update(state);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    // Development-only inspection supports reproducible local gameplay verification.
    if (import.meta.env.DEV) Object.assign(window, { __rally: { state, input } });
  } catch (error) {
    console.error(error);
    ui.showError(`The racer could not start. Use a browser with WebGPU enabled. ${error instanceof Error ? error.message : String(error)}`);
  }
}
void boot();
