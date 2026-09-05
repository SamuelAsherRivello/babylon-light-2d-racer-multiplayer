import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, startRace, stepRace } from '../src/simulation';
import { sampleTrack, TRACK_LENGTH } from '../src/track';
const idle = { throttle:false, brake:false, left:false, right:false };

test('multiplayer seats accept independent inputs and leave no AI cars', () => {
  const state=createRace(2); startRace(state); stepRace(state,idle,3,{inputs:[idle,idle]});
  assert.equal(state.cars.length,2);
  stepRace(state,idle,1,{inputs:[idle,{...idle,throttle:true}]});
  assert.equal(state.cars[0].speed,0); assert.ok(state.cars[1].speed>10);
});
test('a non-host can win an authoritative multiplayer lap', () => {
  const state=createRace(3); startRace(state); stepRace(state,idle,3,{inputs:[idle,idle,idle]});
  for(let i=0;i<3600 && state.phase==='racing';i++) {
    const car=state.cars[2], target=sampleTrack(car.progress+7/TRACK_LENGTH);
    const raw=Math.atan2(target.x-car.x,target.z-car.z)-car.heading;
    const error=Math.atan2(Math.sin(raw),Math.cos(raw));
    stepRace(state,idle,1/120,{inputs:[idle,idle,{...idle,throttle:true,left:error<-.045,right:error>.045}]});
  }
  assert.equal(state.phase,'won'); assert.equal(state.winnerId,2);
  assert.equal(state.cars[2].lapProgress,1);
});
