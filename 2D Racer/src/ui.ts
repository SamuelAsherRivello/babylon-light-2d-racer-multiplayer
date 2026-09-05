import type { RaceState } from './types';

export function createUI(root: HTMLElement, callbacks: { onStart: () => void; onRetry: () => void; onMute: (muted: boolean) => void }) {
  root.classList.add('game-ui');
  root.innerHTML = `
    <header class="topbar"><div class="wordmark"><span class="flag-icon" aria-hidden="true"></span> POCKET RALLY <span class="edition">HILLSIDE CUP</span></div><button class="sound-button" aria-label="Mute sound" aria-pressed="false">SOUND ON <span aria-hidden="true">♪</span></button></header>
    <section class="menu-panel" aria-label="Start menu">
      <div class="eyebrow"><span class="live-dot"></span> SMALL CARS. BIG AIR.</div>
      <h1>POCKET<br><span>RALLY.</span></h1>
      <p class="intro">A little dirt. A lot of speed.<br>One lap to beat the clock.</p>
      <div class="challenge"><div><strong>30</strong><span>SECONDS</span></div><div><strong>01</strong><span>LAP TO WIN</span></div><div><strong>03</strong><span>RIVAL RACERS</span></div></div>
      <button class="primary start-button">LET’S RACE <span aria-hidden="true">↗</span></button>
      <div class="controls"><div><kbd>W</kbd><span>Accelerate</span></div><div><kbd>S</kbd><span>Brake</span></div><div><kbd>A</kbd><kbd>D</kbd><span>Steer</span></div></div>
      <p class="tip">Stay on the asphalt. Grass slows you down.</p>
    </section>
    <aside class="track-stamp"><span>WELCOME TO</span><strong>HILLSIDE<br>CIRCUIT</strong><div>JUMPS · CURVES · GOOD TIMES</div></aside>
    <section class="race-hud" hidden aria-label="Race information">
      <div class="timer-box"><span class="hud-label">TIME LEFT</span><div><strong class="time-value">30.0</strong><span>s</span></div></div>
      <div class="race-stats"><div><span class="hud-label">POSITION</span><strong><span class="position-value">1</span><small> / 4</small></strong></div><div><span class="hud-label">LAP</span><strong>1<small> / 1</small></strong></div></div>
      <div class="lap-meter"><div class="meter-label"><span>START</span><span class="progress-label">0%</span><span>FINISH</span></div><div class="meter-track"><div class="meter-fill"></div></div></div>
      <div class="speed-box"><strong class="speed-value">0</strong><span>KM/H</span><div class="surface-label">ON TRACK</div></div>
      <div class="driving-hint"><kbd>W</kbd> GAS <kbd>S</kbd> BRAKE <kbd>A</kbd><kbd>D</kbd> STEER</div>
    </section>
    <div class="countdown" hidden aria-live="assertive"><span>GET READY</span><strong>3</strong></div>
    <section class="result-wrap" hidden><div class="result-panel" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="eyebrow">HILLSIDE CUP · GAME OVER</div><div class="result-icon" aria-hidden="true">⚑</div><h2 id="result-title">You won!</h2><p class="result-description"></p><div class="result-score"></div><button class="primary retry-button">RETRY <span aria-hidden="true">↻</span></button><p class="tip">One more lap. You know you want to.</p></div></section>
    <section class="error-panel" hidden role="alert"><h2>Let’s get you racing.</h2><p></p></section>
    <footer class="menu-footer"><span>ARCADE RACING / VOL. 01</span><span>BUILT FOR A QUICK GETAWAY ↗</span></footer>`;
  const el = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const menu = el('.menu-panel'), stamp = el('.track-stamp'), footer = el('.menu-footer'), hud = el('.race-hud'), result = el('.result-wrap'), count = el('.countdown');
  const time = el('.time-value'), speed = el('.speed-value'), position = el('.position-value'), progress = el('.progress-label'), fill = el('.meter-fill'), surface = el('.surface-label');
  let muted = false, previousPhase = '';
  el('.start-button').addEventListener('click', () => { el<HTMLButtonElement>('.start-button').blur(); callbacks.onStart(); });
  el('.retry-button').addEventListener('click', () => { el<HTMLButtonElement>('.retry-button').blur(); callbacks.onRetry(); });
  el('.sound-button').addEventListener('click', () => {
    muted = !muted;
    const button = el('.sound-button');
    button.innerHTML = `SOUND ${muted ? 'OFF' : 'ON'} <span aria-hidden="true">${muted ? '×' : '♪'}</span>`;
    button.setAttribute('aria-pressed', String(muted));
    button.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    button.blur(); callbacks.onMute(muted);
  });
  return {
    update(state: RaceState) {
      const inMenu = state.phase === 'menu';
      const finished = state.phase === 'won' || state.phase === 'lost';
      menu.hidden = stamp.hidden = footer.hidden = !inMenu;
      hud.hidden = inMenu || finished; result.hidden = !finished; count.hidden = state.phase !== 'countdown';
      root.dataset.phase = state.phase;
      count.querySelector('strong')!.textContent = String(Math.max(1, Math.ceil(state.countdown)));
      time.textContent = Math.max(0, state.remaining).toFixed(1);
      el('.timer-box').classList.toggle('urgent', state.remaining <= 10);
      const player = state.cars[0];
      speed.textContent = String(Math.round(Math.abs(player?.speed ?? 0) * 3.6));
      position.textContent = String(state.position);
      position.nextElementSibling!.textContent = ` / ${state.cars.length}`;
      const pct = Math.min(100, Math.max(0, state.lapProgress * 100));
      progress.textContent = `${Math.floor(pct)}%`; fill.style.width = `${pct}%`;
      surface.textContent = player?.airborne ? 'BIG AIR!' : player?.offroad ? 'GRASS · SLOW' : 'ON TRACK';
      surface.classList.toggle('offroad', Boolean(player?.offroad));
      if (finished && previousPhase !== state.phase) {
        const won = state.phase === 'won';
        el('#result-title').textContent = won ? 'You won!' : 'You lost!';
        el('.result-icon').textContent = won ? '⚑' : '⌁';
        el('.result-description').textContent = won ? 'Across the line. Ahead of the clock.' : 'The clock took this one. Go again.';
        el('.result-score').textContent = won ? `${state.elapsed.toFixed(2)}s · POSITION ${state.position} / 4` : `${Math.floor(pct)}% OF THE LAP COMPLETE`;
        el<HTMLButtonElement>('.retry-button').focus({ preventScroll: true });
      }
      previousPhase = state.phase;
    },
    showError(message: string) { const error = el('.error-panel'); error.hidden = false; error.querySelector('p')!.textContent = message; menu.hidden = stamp.hidden = hud.hidden = count.hidden = result.hidden = true; },
  };
}
