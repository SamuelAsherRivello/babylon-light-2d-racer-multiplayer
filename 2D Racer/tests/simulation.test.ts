import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, startRace, stepRace } from '../src/simulation';
import { TRACK, TRACK_LENGTH, sampleTrack, trackDistance } from '../src/track';
import type { Input } from '../src/types';
const idle: Input = { throttle: false, brake: false, left: false, right: false };
function racing() { const s = createRace(); startRace(s); stepRace(s, idle, 3); return s; }
test('track closes and projections preserve distance along two ramps', () => {
  assert.deepEqual(sampleTrack(0), sampleTrack(1));
  assert.ok(TRACK_LENGTH > 350 && TRACK_LENGTH < 500);
  assert.equal(TRACK.ramps.length, 2);
  for (let p = .01; p < 1; p += .07) { const point = sampleTrack(p); const n = trackDistance(point.x, point.z); assert.ok(n.distance < .001); assert.ok(Math.abs(n.progress - p) < .001); }
});
test('countdown does not consume race time, timeout loses, retry resets', () => {
  const s = createRace(); startRace(s); stepRace(s, idle, 2); assert.equal(s.phase, 'countdown'); assert.equal(s.remaining, 30);
  assert.deepEqual(stepRace(s, idle, 1), ['go']); assert.equal(s.phase, 'racing');
  assert.ok(stepRace(s, idle, 30).includes('lose')); assert.equal(s.phase, 'lost');
  startRace(s); assert.equal(s.phase, 'countdown'); assert.equal(s.lapProgress, 0); assert.equal(s.cars[0]!.speed, 0);
});
test('W accelerates, S brakes and A/D rotate relative to heading', () => {
  const s = racing(); stepRace(s, { ...idle, throttle: true }, .7); const speed = s.cars[0]!.speed; assert.ok(speed > 8);
  const heading = s.cars[0]!.heading;
  stepRace(s, { ...idle, throttle: true, right: true }, .2); assert.ok(s.cars[0]!.heading > heading);
  const right = s.cars[0]!.heading; stepRace(s, { ...idle, left: true }, .4); assert.ok(s.cars[0]!.heading < right);
  stepRace(s, { ...idle, brake: true }, .5); assert.ok(s.cars[0]!.speed < speed);
});
test('grass limits speed and opponents independently advance', () => {
  const s = racing(); s.cars[0]!.x = 0; s.cars[0]!.z = 0;
  const before = s.cars[1]!.progress; stepRace(s, { ...idle, throttle: true }, 3);
  assert.equal(s.cars[0]!.offroad, true); assert.ok(s.cars[0]!.speed <= 9); assert.notEqual(s.cars[1]!.progress, before);
});
test('an actual steered lap jumps, lands and wins within thirty seconds', () => {
  const s = racing(); const events: string[] = [];
  for (let frame = 0; frame < 30 * 120 && s.phase === 'racing'; frame++) {
    const c = s.cars[0]!; const target = sampleTrack(c.progress + 7 / TRACK_LENGTH);
    const error = Math.atan2(Math.sin(Math.atan2(target.x - c.x, target.z - c.z) - c.heading), Math.cos(Math.atan2(target.x - c.x, target.z - c.z) - c.heading));
    events.push(...stepRace(s, { throttle: true, brake: false, left: error < -.045, right: error > .045 }, 1 / 120));
  }
  assert.equal(s.phase, 'won', `lap ${s.lapProgress} at ${s.elapsed}`);
  assert.ok(s.elapsed > 22 && s.elapsed < 29); assert.equal(events.filter(e => e === 'jump').length, 2); assert.equal(events.filter(e => e === 'land').length, 2); assert.ok(events.includes('win'));
  assert.ok(s.cars[0]!.progress < .01, 'victory requires actually crossing the finish line');
});
test('teleport across start without gates cannot win', () => {
  const s = racing();
  for (const p of [.9, .99, .01]) { const t = sampleTrack(p); Object.assign(s.cars[0]!, t); stepRace(s, idle, 1 / 60); }
  assert.equal(s.phase, 'racing'); assert.ok(s.lapProgress < .1);
});
test('overlapping racers produce impact feedback', () => {
  const s = racing(); const a = s.cars[0]!, b = s.cars[1]!; b.x = a.x + 1; b.z = a.z;
  assert.ok(stepRace(s, idle, 1 / 60).includes('hit')); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 2.49);
});
test('continuous backward lap and shortcut skipping a gate cannot win', () => {
  const reversed = racing();
  for (let i = 1; i <= 1200; i++) {
    Object.assign(reversed.cars[0]!, sampleTrack(-i / 1200));
    stepRace(reversed, idle, 1 / 120);
  }
  assert.equal(reversed.phase, 'racing'); assert.equal(reversed.lapProgress, 0);
  const shortcut = racing();
  for (let i = 1; i <= 1200; i++) {
    const progress = i / 1200;
    const p = sampleTrack(progress);
    // Pass checkpoint at one quarter lap through the grass instead of the road.
    const offset = progress > .23 && progress < .27 ? 14 : 0;
    shortcut.cars[0]!.x = p.x + Math.cos(p.heading) * offset;
    shortcut.cars[0]!.z = p.z - Math.sin(p.heading) * offset;
    stepRace(shortcut, idle, 1 / 120);
  }
  assert.equal(shortcut.phase, 'racing'); assert.ok(shortcut.lapProgress <= .25);
});
