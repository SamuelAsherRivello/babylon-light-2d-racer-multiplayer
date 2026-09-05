import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionTimeline } from '../src/network-motion';
import { createRace } from '../src/simulation';
const frame=(time:number)=>{const race=createRace(2);race.phase='racing';race.countdown=0;race.elapsed=time/1000;for(const car of race.cars){car.x=time/100;car.y=0;car.z=0;car.heading=0;}return race;};
test('remote motion is uniform between 60 Hz snapshots, independent of render cadence',()=>{
 const motion=createMotionTimeline();for(let t=0;t<=100;t+=1000/60)motion.push(frame(t),t+10,t);
 const first=motion.sample(80,0)!.cars[1].x,second=motion.sample(90,0)!.cars[1].x;
 assert.ok(Math.abs(second-first-.1)<1e-8);
});
test('own car moves between packets without exponential catch-up delay',()=>{
 const motion=createMotionTimeline();motion.push(frame(0),10,0);motion.push(frame(1000/60),1000/60+10,1000/60);
 assert.ok(Math.abs(motion.sample(35,0)!.cars[0].x-.25)<1e-8);
});
test('packet gaps have bounded local projection and clear removes stale sessions',()=>{
 const motion=createMotionTimeline();motion.push(frame(0),10,0);motion.push(frame(20),30,20);
 assert.ok(Math.abs(motion.sample(1000,0)!.cars[0].x-.7)<1e-8);motion.clear();assert.equal(motion.sample(1100,0),undefined);
});
test('heading interpolates across the angle wrap and never mutates snapshots',()=>{
 const motion=createMotionTimeline(),a=frame(0),b=frame(20);a.cars[1].heading=Math.PI-.1;b.cars[1].heading=-Math.PI+.1;
 motion.push(a,10,0);motion.push(b,30,20);const result=motion.sample(10+10+1000/30,0)!;
 assert.ok(Math.abs(Math.abs(result.cars[1].heading)-Math.PI)<1e-8);assert.equal(b.cars[1].heading,-Math.PI+.1);
});
