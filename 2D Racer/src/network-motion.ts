import type { RaceState } from './types';
type Frame={race:RaceState; time:number; received:number};
const angle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));

/** Remote cars interpolate server time; the local car projects only the short packet gap. */
export function createMotionTimeline() {
  const frames:Frame[]=[];let clockOffset=Infinity,lastRemoteTime=-Infinity;
  return {
    clear(){frames.length=0;clockOffset=Infinity;lastRemoteTime=-Infinity;},
    push(race:RaceState,received:number,serverTime=(race.elapsed-race.countdown)*1000){
      if(frames.length && serverTime<=frames[frames.length-1].time)return;
      clockOffset=Math.min(clockOffset,received-serverTime);
      frames.push({race,time:serverTime,received});if(frames.length>20)frames.shift();
    },
    sample(now:number,localId:number):RaceState|undefined {
      const latest=frames.at(-1);if(!latest)return;
      if(frames.length===1)return {...latest.race,cars:latest.race.cars.map(c=>({...c}))};
      const previous=frames[frames.length-2];
      const remoteTime=Math.max(lastRemoteTime,now-clockOffset-1000/30);lastRemoteTime=remoteTime;
      let a=frames[0],b=frames[1];
      for(let i=1;i<frames.length;i++){a=frames[i-1];b=frames[i];if(b.time>=remoteTime)break;}
      const blend=Math.max(0,Math.min(1,(remoteTime-a.time)/(b.time-a.time)));
      const cars=latest.race.cars.map(car=>{
        const from=a.race.cars.find(c=>c.id===car.id),to=b.race.cars.find(c=>c.id===car.id);
        if(!from || !to)return {...car};
        if(car.id!==localId)return {...car,x:from.x+(to.x-from.x)*blend,y:from.y+(to.y-from.y)*blend,z:from.z+(to.z-from.z)*blend,heading:from.heading+angle(to.heading-from.heading)*blend,steer:from.steer+(to.steer-from.steer)*blend};
        const old=previous.race.cars.find(c=>c.id===car.id);
        if(!old || latest.race.phase!=='racing')return {...car};
        const gap=latest.time-previous.time;
        // Never invent sustained motion across a disconnect or an authoritative teleport.
        const age=Math.min(50,Math.max(0,now-clockOffset-latest.time));
        if(gap<=0 || gap>200 || Math.hypot(car.x-old.x,car.z-old.z)>10)return {...car};
        const factor=age/gap;
        return {...car,x:car.x+(car.x-old.x)*factor,z:car.z+(car.z-old.z)*factor,y:Math.max(0,car.y+(car.y-old.y)*factor),heading:car.heading+angle(car.heading-old.heading)*factor};
      });
      return {...latest.race,cars};
    },
  };
}
