import type { Car, GameEvent, Input, RaceState } from './types';
import { TRACK, TRACK_LENGTH, sampleTrack, trackDistance, wrap } from './track';

interface Motion { vy: number; vx: number; vz: number; previous: number; total: number; gate: number; ramp: number; hitCooldown: number }
const internals = new WeakMap<RaceState, Motion[]>();
const colors = ['#ffca3a', '#ff597b', '#6bdbff', '#b09bff'];
const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function createRace(count = 4): RaceState {
  const cars: Car[] = colors.slice(0, count).map((color, id) => {
    const progress = wrap(-id * .009);
    const p = sampleTrack(progress);
    const lane = id % 2 ? 2 : -2;
    return { id, x: p.x + Math.cos(p.heading) * lane, z: p.z - Math.sin(p.heading) * lane,
      y: 0, heading: p.heading, speed: 0, steer: 0, airborne: false, offroad: false, progress, color };
  });
  const state: RaceState = { phase: 'menu', cars, remaining: 30, countdown: 3, elapsed: 0, position: 1, lapProgress: 0 };
  internals.set(state, cars.map(c => ({ vy: 0, vx: 0, vz: 0, previous: c.progress, total: -c.id * .009, gate: 1, ramp: -1, hitCooldown: 0 })));
  return state;
}

export function startRace(state: RaceState): void {
  const fresh = createRace(state.cars.length);
  delete state.winnerId;
  Object.assign(state, fresh, { phase: 'countdown' });
  internals.set(state, internals.get(fresh)!);
}

export interface MultiplayerStep { inputs: Input[]; onEvent?: (carId:number,event:GameEvent)=>void }
export function stepRace(state: RaceState, input: Input, dt: number, multiplayer?: MultiplayerStep): GameEvent[] {
  const events: GameEvent[] = [];
  if (!Number.isFinite(dt) || dt <= 0) return events;
  let time = Math.min(dt, 60);
  while (time > 1e-8 && (state.phase === 'countdown' || state.phase === 'racing')) {
    let h = Math.min(time, 1 / 120);
    if (state.phase === 'countdown') {
      h = Math.min(h, state.countdown);
      state.countdown = Math.max(0, state.countdown - h);
      if (state.countdown < 1e-8) { state.countdown = 0; state.phase = 'racing'; events.push('go'); }
    } else {
      h = Math.min(h, state.remaining);
      tick(state, input, h, events, multiplayer);
    }
    time -= h;
  }
  return events;
}

function tick(state: RaceState, input: Input, dt: number, events: GameEvent[], multiplayer?: MultiplayerStep) {
  const emit = (id:number,event:GameEvent) => { if(id===0) events.push(event); multiplayer?.onEvent?.(id,event); };
  const motions = internals.get(state)!;
  state.elapsed += dt;
  state.remaining = Math.max(0, 30 - state.elapsed);
  state.cars.forEach((car, i) => {
    const m = motions[i]!;
    const nearest = trackDistance(car.x, car.z);
    car.offroad = nearest.distance > TRACK.width / 2;
    let steer: number, throttle: boolean, brake: boolean;
    if (i === 0 || multiplayer) { const controls = multiplayer ? (multiplayer.inputs[i] ?? {throttle:false,brake:false,left:false,right:false}) : input; steer = Number(controls.right) - Number(controls.left); throttle = controls.throttle; brake = controls.brake; }
    else {
      const target = sampleTrack(nearest.progress + (5 + car.speed * .2) / TRACK_LENGTH);
      const lane = (i - 2) * 2;
      target.x += Math.cos(target.heading) * lane;
      target.z -= Math.sin(target.heading) * lane;
      const error = angle(Math.atan2(target.x - car.x, target.z - car.z) - car.heading);
      steer = Math.max(-1, Math.min(1, error * 2.2));
      throttle = car.speed < 16.7 + i * .45; brake = Math.abs(error) > 1.05;
    }
    car.steer += (steer - car.steer) * Math.min(1, dt * 12);
    const maxSpeed = car.offroad ? 9 : 18.5;
    const acceleration = throttle ? (car.offroad ? 7 : 16) : -4;
    car.speed = Math.max(0, car.speed + (brake ? -27 : acceleration) * dt);
    if (car.speed > maxSpeed) car.speed = car.offroad ? Math.max(maxSpeed, car.speed - 25 * dt) : maxSpeed;
    car.heading += car.steer * Math.min(1, car.speed / 7) * 1.8 * dt * (car.airborne ? .35 : 1);
    const grip = car.airborne ? .6 : 10;
    m.vx += (Math.sin(car.heading) * car.speed - m.vx) * Math.min(1, grip * dt);
    m.vz += (Math.cos(car.heading) * car.speed - m.vz) * Math.min(1, grip * dt);
    car.x += m.vx * dt; car.z += m.vz * dt;
    const next = trackDistance(car.x, car.z);
    car.progress = next.progress;
    let ground = 0, rampIndex = -1;
    if (next.distance < TRACK.width / 2) TRACK.ramps.forEach((ramp, index) => {
      const along = wrap(next.progress - ramp.progress) * TRACK_LENGTH;
      if (along < ramp.length) { ground = ramp.height * along / ramp.length; rampIndex = index; }
    });
    if (!car.airborne && m.ramp >= 0 && rampIndex < 0 && car.y > .8 && car.speed > 5) {
      car.airborne = true; m.vy = 5 + car.speed * .16; emit(i,'jump');
    }
    if (car.airborne) {
      m.vy -= 19 * dt; car.y += m.vy * dt;
      if (car.y <= ground) { car.y = ground; car.airborne = false; m.vy = 0; emit(i,'land'); }
    } else car.y = ground;
    m.ramp = rampIndex;
    m.hitCooldown = Math.max(0, m.hitCooldown - dt);
    if (Math.abs(car.x) > 91 || Math.abs(car.z) > 91) {
      car.x = Math.max(-91, Math.min(91, car.x)); car.z = Math.max(-91, Math.min(91, car.z));
      car.speed *= .6; m.vx *= -.3; m.vz *= -.3;
      if (m.hitCooldown === 0) { emit(i,'hit'); m.hitCooldown = .5; }
    }
    const delta = angle((car.progress - m.previous) * Math.PI * 2) / (Math.PI * 2);
    // Reject discontinuities and off-track shortcuts; reversing subtracts lap progress.
    if (Math.abs(delta) < .015) m.total += delta;
    const gateProgress = (m.gate % 12) / 12;
    const toGate = wrap(gateProgress - m.previous);
    if (delta > 0 && delta < .015 && toGate <= delta + 1e-8 && next.distance <= TRACK.width / 2 + 1) m.gate++;
    m.previous = car.progress;
    car.lapProgress = Math.max(0, Math.min(m.gate / 12, m.total));
    if(i===0) state.lapProgress = car.lapProgress;
    if ((i===0 || multiplayer) && state.phase==='racing' && m.gate > 12 && state.elapsed <= 30 + 1e-8) {
      state.phase = 'won'; state.winnerId = i; car.lapProgress=1;
      if(i===0) state.lapProgress=1;
      emit(i,'win');
    }
  });
  for (let i = 0; i < state.cars.length; i++) for (let j = i + 1; j < state.cars.length; j++) {
    const a = state.cars[i]!, b = state.cars[j]!;
    let dx = a.x - b.x, dz = a.z - b.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 2.5 && Math.abs(a.y - b.y) < 1.3) {
      if (distance < .01) { dx = 1; dz = 0; }
      const push = (2.5 - distance) * .5 / Math.max(.01, Math.hypot(dx, dz));
      a.x += dx * push; a.z += dz * push; b.x -= dx * push; b.z -= dz * push;
      for(const id of [i,j]) if ((id===0 || multiplayer) && motions[id]!.hitCooldown===0) { state.cars[id].speed*=.83; emit(id,'hit'); motions[id].hitCooldown=.6; }
    }
  }
  state.position = 1 + motions.slice(1).filter(m => m.total > motions[0]!.total).length;
  if (state.phase === 'racing' && state.remaining < 1e-8) { state.remaining = 0; state.phase = 'lost'; events.push('lose'); }
}
