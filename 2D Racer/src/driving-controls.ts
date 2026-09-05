import type { Input } from './types';
import { createInputState } from './input-state';

/** Independent input sources keep releasing touch from cancelling a held key. */
export function createDrivingControls(root: HTMLElement, input: Input, onChange:()=>void=()=>{}) {
  const state = createInputState(input);
  const panel = document.createElement('nav');
  panel.className = 'virtual-controller';
  panel.setAttribute('aria-label', 'Driving controls');
  panel.innerHTML = `<div class="steering-controls"><button type="button" data-control="left" aria-label="Steer left"><span>◀</span><small>A · LEFT</small></button><button type="button" data-control="right" aria-label="Steer right"><span>▶</span><small>D · RIGHT</small></button></div><div class="pedal-controls"><button type="button" data-control="brake" aria-label="Brake"><span>▰</span><small>S · BRAKE</small></button><button type="button" data-control="throttle" aria-label="Accelerate"><span>▲</span><small>W · GAS</small></button></div>`;
  root.append(panel);
  const buttons = [...panel.querySelectorAll<HTMLButtonElement>('button')];
  let enabled = false;
  const paint = () => { buttons.forEach(button => {
    const held = input[button.dataset.control as keyof Input];
    button.classList.toggle('is-held', held);
    button.setAttribute('aria-pressed', String(held));
  }); onChange(); };
  const clear = () => { state.clear(); paint(); };
  buttons.forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (!enabled || event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      state.pointer(event.pointerId, button.dataset.control as keyof Input);
      paint();
    });
    const release = (event: PointerEvent) => { state.release(event.pointerId); paint(); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', event => event.preventDefault());
  });
  const keys: Record<string, keyof Input> = { KeyW: 'throttle', KeyS: 'brake', KeyA: 'left', KeyD: 'right' };
  window.addEventListener('keydown', event => {
    if (!enabled || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
    const action = keys[event.code];
    if (action) { event.preventDefault(); state.keyboard(action, true); paint(); }
  });
  window.addEventListener('keyup', event => {
    const action = keys[event.code];
    if (action) { state.keyboard(action, false); paint(); }
  });
  window.addEventListener('blur', clear);
  window.addEventListener('pagehide', clear);
  document.addEventListener('visibilitychange', clear);
  panel.hidden = true;
  return {
    clear,
    setEnabled(value: boolean) {
      if (enabled === value) return;
      enabled = value; panel.hidden = !value;
      if (!value) clear();
    },
  };
}
