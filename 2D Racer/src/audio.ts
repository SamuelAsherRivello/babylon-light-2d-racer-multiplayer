import type { GameEvent, RaceState } from './types';

export function createAudio() {
  let context: AudioContext | undefined, master: GainNode | undefined;
  let engine: OscillatorNode | undefined, engineGain: GainNode | undefined;
  let skid: AudioBufferSourceNode | undefined, skidGain: GainNode | undefined;
  let muted = false, disposed = false;
  const voices = new Set<OscillatorNode>();

  function tone(frequency: number, duration: number, volume = .2, delay = 0, endFrequency = frequency, type: OscillatorType = 'triangle') {
    if (!context || !master || context.state !== 'running') return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const at = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + .008);
    gain.gain.exponentialRampToValueAtTime(.001, at + duration);
    oscillator.connect(gain); gain.connect(master);
    voices.add(oscillator);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices.delete(oscillator); };
    oscillator.start(at); oscillator.stop(at + duration + .02);
  }

  return {
    async unlock() {
      if (disposed) return;
      try {
        if (!context) {
          context = new AudioContext(); master = context.createGain();
          master.gain.value = muted ? 0 : .32; master.connect(context.destination);
          engine = context.createOscillator(); engine.type = 'sawtooth'; engine.frequency.value = 45;
          engineGain = context.createGain(); engineGain.gain.value = 0;
          const engineFilter = context.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 650;
          engine.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master); engine.start();
          const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
          skid = context.createBufferSource(); skid.buffer = buffer; skid.loop = true;
          const skidFilter = context.createBiquadFilter(); skidFilter.type = 'bandpass'; skidFilter.frequency.value = 1400; skidFilter.Q.value = .7;
          skidGain = context.createGain(); skidGain.gain.value = 0;
          skid.connect(skidFilter); skidFilter.connect(skidGain); skidGain.connect(master); skid.start();
        }
        await context.resume();
      } catch { /* Audio availability must not prevent a race. */ }
    },
    update(state: RaceState, events: GameEvent[], _dt: number) {
      if (!context || context.state !== 'running' || !engine || !engineGain || !skidGain || disposed) return;
      const at = context.currentTime, player = state.cars[0];
      const racing = state.phase === 'racing';
      const speed = Math.abs(player?.speed ?? 0);
      // A smooth engine pitch follows speed both up and down, including braking.
      engine.frequency.setTargetAtTime(42 + speed * 4.2 + (player?.airborne ? 35 : 0), at, .08);
      engineGain.gain.setTargetAtTime(racing ? .055 + Math.min(speed / 35, 1) * .11 : 0, at, .08);
      const turning = racing && !player?.airborne && speed > 5 ? Math.abs(player?.steer ?? 0) : 0;
      skidGain.gain.setTargetAtTime(Math.min(.16, turning * speed * .003) + (racing && player?.offroad ? .035 : 0), at, .06);
      for (const event of events) {
        if (event === 'start') { tone(330, .16); tone(330, .16, .2, 1); tone(330, .16, .2, 2); }
        if (event === 'go') tone(660, .35, .23);
        if (event === 'hit') { tone(125, .2, .4, 0, 30, 'sawtooth'); tone(70, .14, .3, 0, 25, 'square'); }
        if (event === 'jump') tone(180, .22, .12, 0, 470, 'sine');
        if (event === 'land') tone(100, .15, .24, 0, 30, 'triangle');
        if (event === 'win') [523, 659, 784, 1047].forEach((note, i) => tone(note, i === 3 ? .7 : .22, .22, i * .16));
        if (event === 'lose') [392, 330, 262, 165].forEach((note, i) => tone(note, i === 3 ? .6 : .22, .2, i * .2));
      }
    },
    setMuted(value: boolean) { muted = value; if (master && context) master.gain.setTargetAtTime(value ? 0 : .32, context.currentTime, .025); },
    dispose() {
      disposed = true;
      engine?.stop(); skid?.stop();
      for (const voice of voices) voice.stop();
      voices.clear();
      void context?.close();
    },
  };
}
