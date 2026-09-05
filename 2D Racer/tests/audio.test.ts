import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/audio';
import { createRace } from '../src/simulation';
import type { GameEvent } from '../src/types';

// Audit the Web Audio commands without speakers or browser autoplay permission.
class Parameter {
  value = 0;
  values: number[] = [];
  setValueAtTime(value: number) { this.value = value; this.values.push(value); }
  linearRampToValueAtTime(value: number) { this.setValueAtTime(value); }
  exponentialRampToValueAtTime(value: number) { this.setValueAtTime(value); }
  setTargetAtTime(value: number) { this.setValueAtTime(value); }
}
class Node {
  gain = new Parameter(); frequency = new Parameter(); Q = new Parameter();
  type = ''; loop = false; buffer: unknown; onended?: () => void;
  starts: number[] = []; stops: number[] = []; disconnected = false;
  connect(_target: unknown) {}
  disconnect() { this.disconnected = true; }
  start(at = 0) { this.starts.push(at); }
  stop(at = 0) { this.stops.push(at); }
}
class FakeContext {
  static instances: FakeContext[] = [];
  currentTime = 0; sampleRate = 8000; state = 'suspended'; destination = {};
  oscillators: Node[] = []; gains: Node[] = []; sources: Node[] = [];
  constructor() { FakeContext.instances.push(this); }
  createGain() { const node = new Node(); this.gains.push(node); return node; }
  createOscillator() { const node = new Node(); this.oscillators.push(node); return node; }
  createBiquadFilter() { return new Node(); }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { const node = new Node(); this.sources.push(node); return node; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}

test('audio follows driving, mutes every voice, emits event cues, and releases nodes', async () => {
  const original = globalThis.AudioContext;
  globalThis.AudioContext = FakeContext as unknown as typeof AudioContext;
  try {
    const audio = createAudio(), race = createRace();
    race.phase = 'racing';
    audio.update(race, ['go'], .016);
    assert.equal(FakeContext.instances.length, 0, 'no audio context before user gesture');
    await audio.unlock(); await audio.unlock();
    assert.equal(FakeContext.instances.length, 1, 'retry reuses the context');
    const ctx = FakeContext.instances[0];
    assert.equal(ctx.oscillators.length, 1, 'one persistent engine');
    assert.equal(ctx.sources.length, 1, 'one persistent skid source');
    race.cars[0].speed = 8; audio.update(race, [], .016);
    const lowPitch = ctx.oscillators[0].frequency.value;
    race.cars[0].speed = 22; audio.update(race, [], .016);
    assert.ok(ctx.oscillators[0].frequency.value > lowPitch, 'acceleration raises pitch');
    race.cars[0].speed = 4; audio.update(race, [], .016);
    assert.ok(ctx.oscillators[0].frequency.value < lowPitch, 'deceleration lowers pitch');
    race.cars[0].speed = 15; race.cars[0].steer = 1;
    audio.update(race, [], .016);
    assert.ok(ctx.gains[2].gain.value > 0, 'turning produces tire sound');
    race.cars[0].airborne = true; audio.update(race, [], .016);
    assert.equal(ctx.gains[2].gain.value, 0, 'airborne tires do not skid');
    audio.setMuted(true); assert.equal(ctx.gains[0].gain.value, 0);
    audio.setMuted(false); assert.ok(ctx.gains[0].gain.value > 0);
    for (const event of ['start', 'go', 'hit', 'jump', 'land', 'win', 'lose'] satisfies GameEvent[]) {
      const before = ctx.oscillators.length;
      audio.update(race, [event], .016);
      assert.ok(ctx.oscillators.length > before, `${event} creates a cue`);
      for (const voice of ctx.oscillators.slice(before)) {
        assert.equal(voice.starts.length, 1);
        assert.equal(voice.stops.length, 1, 'each transient has a bounded lifetime');
        assert.ok(voice.stops[0] > voice.starts[0]);
        voice.onended?.();
        assert.ok(voice.disconnected, 'finished cue disconnects');
      }
    }
    race.phase = 'won'; audio.update(race, [], .016);
    assert.equal(ctx.gains[1].gain.value, 0, 'engine quiet after race');
    assert.equal(ctx.gains[2].gain.value, 0, 'skid quiet after race');
    audio.dispose();
    assert.equal(ctx.state, 'closed');
    assert.equal(ctx.oscillators[0].stops.length, 1);
    assert.equal(ctx.sources[0].stops.length, 1);
  } finally { globalThis.AudioContext = original; }
});

test('unavailable browser audio does not prevent gameplay', async () => {
  const original = globalThis.AudioContext;
  globalThis.AudioContext = class { constructor() { throw new Error('audio disabled'); } } as unknown as typeof AudioContext;
  try {
    const audio = createAudio();
    await assert.doesNotReject(audio.unlock());
    assert.doesNotThrow(() => audio.update(createRace(), ['start'], .016));
    assert.doesNotThrow(() => audio.setMuted(true));
    assert.doesNotThrow(() => audio.dispose());
  } finally { globalThis.AudioContext = original; }
});
