import { createMotionTimeline } from './network-motion';
import { createPerformanceMeter } from './performance-meter';
import './style.css';
import { createDrivingControls } from './driving-controls';
import { createRace, startRace, stepRace } from './simulation';
import { createWorld } from './world';
import { createUI } from './ui';
import { createAudio } from './audio';
import { createNetwork } from './network';
import { createMultiplayerUI } from './multiplayer-ui';
import type { Input, GameEvent, RaceState } from './types';

const canvas=document.querySelector<HTMLCanvasElement>('#game')!;
const root=document.querySelector<HTMLElement>('#ui')!;
let state=createRace(), target:RaceState|undefined;
let networkMode=false, localId=0, ready=false, lastSequence=0;
const motion=createMotionTimeline();
const input:Input={throttle:false,brake:false,left:false,right:false};
const audio=createAudio();
const effects:GameEvent[]=[];
const clearInput=()=>{controls.clear();if(networkMode)network.clearInput();};
const reset=(message='')=>{networkMode=false;target=undefined;motion.clear();clearInput();state=createRace();multiplayerUI.reset(message);};
const begin=()=>{
  if(!ready)return;
  network.leave();networkMode=false;target=undefined;motion.clear();multiplayerUI.reset();clearInput();state=createRace();
  void audio.unlock().then(()=>audio.update(state,['start'],0));startRace(state);
};
const ui=createUI(root,{onStart:begin,onRetry:begin,onMute:value=>audio.setMuted(value)});
const network=createNetwork({
  lobby(data,sessionId){
    localId=data.members.find(m=>m.sessionId===sessionId)?.carId??0;
    multiplayerUI.lobby(data,sessionId);
  },
  snapshot(data){
    if(!networkMode || data.sequence<=lastSequence)return;
    lastSequence=data.sequence;
    const local=data.race.cars.find(c=>c.id===localId);
    if(!local)return;
    const next={...data.race,cars:[local,...data.race.cars.filter(c=>c.id!==localId)],lapProgress:local.lapProgress??0,
      position:1+data.race.cars.filter(c=>(c.lapProgress??0)>(local.lapProgress??0)).length};
    if(!target)state=structuredClone(next);
    target=next;motion.push(next,performance.now(),data.serverTime);multiplayerUI.racing();
  },
  effect:event=>effects.push(event),
  closed(message,winnerId){
    effects.push(winnerId===undefined?'lose':winnerId===localId?'win':'lose');reset(message);
  },
  notice:message=>multiplayerUI.notice(message),
});
async function connect(kind:'host'|'join',endpoint:string,name:string,countOrCode:number|string){
  if(!ready)return;
  networkMode=true;lastSequence=0;target=undefined;motion.clear();effects.length=0;clearInput();
  multiplayerUI.busy(true);multiplayerUI.notice('Connecting to the race server…');
  void audio.unlock();
  try {
    if(kind==='host')await network.host(endpoint,name,Number(countOrCode));
    else await network.join(endpoint,name,String(countOrCode));
    multiplayerUI.busy(false);network.stream(()=>({...input}));
  } catch(error){
    network.leave();reset(`Could not connect. Check the server address and room code. ${error instanceof Error?error.message.slice(0,160):''}`);
  }
}
const multiplayerUI=createMultiplayerUI(root,{
  host:(endpoint,name,count)=>{void connect('host',endpoint,name,count);},
  join:(endpoint,name,code)=>{void connect('join',endpoint,name,code);},
  ready:value=>network.ready(value),start:()=>network.start(),
  leave:()=>{network.leave();reset('You left the room.');},
});
multiplayerUI.busy(true);
multiplayerUI.notice('Loading the track…');
ui.update(state);
const controls=createDrivingControls(root,input,()=>{if(networkMode)network.sendInput(input);});
window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',clearInput);
window.addEventListener('pagehide',()=>network.leave());
async function boot(){
  try{
    const world=await createWorld(canvas,message=>multiplayerUI.notice(message));ready=true;multiplayerUI.busy(false);multiplayerUI.notice('');
    window.addEventListener('resize',()=>world.resize());
    const meter=createPerformanceMeter(root,()=>({...world.stats(),network:networkMode?network.stats():undefined}));
    const profileNoRender=import.meta.env.DEV && new URLSearchParams(location.search).has('profile-no-render');
    let last=performance.now(),accumulated=0,workMs=0,hudElapsed=0,lastHudPhase=state.phase;
    function frame(now:number){
      const workStart=performance.now();
      const dt=Math.min((now-last)/1000,.1);last=now;
      if(networkMode){
        accumulated=0;
        const sampled=motion.sample(now,localId);if(sampled)state=sampled;
      }else{
        accumulated+=document.hidden?0:dt;
        while(accumulated>=1/120){effects.push(...stepRace(state,input,1/120));accumulated-=1/120;}
      }
      world.update(state,dt);if(!profileNoRender)world.render(dt);audio.update(state,effects.splice(0),dt);hudElapsed+=dt;if(hudElapsed>=.1 || state.phase!==lastHudPhase){ui.update(state);hudElapsed=0;lastHudPhase=state.phase;}workMs=performance.now()-workStart;meter.frame(now,workMs);controls.setEnabled(state.phase==='racing'||state.phase==='countdown');requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    if(import.meta.env.DEV)Object.assign(window,{__rally:{get state(){return state;},input,stats:()=>({...world.stats(),workMs,hidden:document.hidden,network:network.stats()})}});
  }catch(error){console.error(error);ui.showError(`A WebGPU-capable browser is required. ${error instanceof Error?error.message:String(error)}`);}
}
void boot();
