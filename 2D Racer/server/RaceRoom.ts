import { Room, type Client } from '@colyseus/core';
import { randomInt } from 'node:crypto';
import { createRace, startRace, stepRace } from '../src/simulation';
import type { Input, RaceState } from '../src/types';
import type { Lobby, Member } from '../src/protocol';

const codes=new Set<string>();
const idle=():Input=>({throttle:false,brake:false,left:false,right:false});
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class RaceRoom extends Room {
  maxMessagesPerSecond=90;
  members=new Map<string,Member>();
  controls=new Map<string,{input:Input;at:number}>();
  hostId=''; capacity=4; running=false; ending=false; sequence=0;
  race?:RaceState;
  private snapshotTime=0;
  onCreate(options:{capacity?:unknown}) {
    const count=Number(options.capacity ?? 4);
    if(![2,3,4].includes(count)) throw new Error('Choose two, three or four players.');
    this.capacity=this.maxClients=count;
    if(codes.size>=100) throw new Error('Server is full. Try again later.');
    let code:string;
    do {code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');} while(codes.has(code));
    codes.add(code); this.roomId=code;
    this.setPrivate(true);
    this.onMessage('sync',client=>this.sendLobby(client));
    this.onMessage('ready',(client,value)=>{
      if(this.running || typeof value!=='boolean') return;
      const member=this.members.get(client.sessionId); if(member) member.ready=value;
      this.sendLobby();
    });
    this.onMessage('start',client=>{
      if(client.sessionId!==this.hostId || this.running) return;
      if(this.members.size===0 || ![...this.members.values()].every(m=>m.ready)) {
        client.send('notice','Everyone currently in the room must mark Ready.'); return;
      }
      this.running=true; void this.lock();
      this.race=createRace(this.members.size); startRace(this.race);
      this.sendLobby(); this.broadcastSnapshot();
    });
    this.onMessage('input',(client,value:unknown)=>{
      if(!this.running || !value || typeof value!=='object') return;
      const packet=value as Record<string,unknown>;
      if(!['throttle','brake','left','right'].every(k=>typeof packet[k]==='boolean')) return;
      this.controls.set(client.sessionId,{input:{throttle:packet.throttle as boolean,brake:packet.brake as boolean,left:packet.left as boolean,right:packet.right as boolean},at:Date.now()});
    });
    this.setSimulationInterval(dt=>this.tick(dt),1000/60);
    this.clock.setTimeout(()=>{if(!this.running) this.finish('The lobby expired. Host a new game to get a new code.');},10*60*1000);
  }
  onJoin(client:Client,options:{name?:unknown}) {
    if(this.running || this.ending) throw new Error('This race has already started.');
    if(!this.hostId) this.hostId=client.sessionId;
    const name=String(options.name ?? '').replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,16) || `Racer ${this.members.size+1}`;
    this.members.set(client.sessionId,{sessionId:client.sessionId,name,ready:false,carId:this.members.size});
    for(const member of this.members.values()) member.ready=false;
    this.sendLobby();
  }
  onLeave(client:Client) {
    this.members.delete(client.sessionId); this.controls.delete(client.sessionId);
    if(this.ending) return;
    if(this.running) {this.finish('A racer disconnected. The race was cancelled; host or join a new game.');return;}
    if(client.sessionId===this.hostId) {this.finish('The host left. Host or join a new game.');return;}
    let index=0; for(const member of this.members.values()){member.carId=index++;member.ready=false;}
    this.sendLobby();
  }
  onDispose(){codes.delete(this.roomId);}
  private sendLobby(client?:Client) {
    const lobby:Lobby={code:this.roomId,capacity:this.capacity,hostId:this.hostId,members:[...this.members.values()],phase:this.running?(this.race?.phase==='countdown'?'countdown':'racing'):'lobby'};
    if(client) client.send('lobby',lobby); else this.broadcast('lobby',lobby);
  }
  private broadcastSnapshot(){if(this.race) this.broadcast('snapshot',{race:this.race,sequence:++this.sequence});}
  tick(dtMs:number) {
    if(!this.running || !this.race || this.ending) return;
    const inputs=[...this.members.values()].map(m=>{const control=this.controls.get(m.sessionId);return control && Date.now()-control.at<300 ? control.input : idle();});
    const before=this.race.phase;
    stepRace(this.race,idle(),Math.min(dtMs/1000,1),{inputs,onEvent:(id,event)=>{
      if(event==='win' || event==='lose') return;
      const member=[...this.members.values()].find(m=>m.carId===id);
      const client=this.clients.find(c=>c.sessionId===member?.sessionId); client?.send('effect',event);
    }});
    if(before==='countdown' && this.race.phase==='racing') this.broadcast('effect','go');
    this.snapshotTime+=dtMs;
    if(this.snapshotTime>=1000/30){this.snapshotTime=0;this.broadcastSnapshot();}
    if(this.race.phase==='won' || this.race.phase==='lost') {
      const winner=[...this.members.values()].find(m=>m.carId===this.race!.winnerId);
      this.finish(winner?`${winner.name} won in ${this.race.elapsed.toFixed(2)}s! Host or join a new race.`:'Time is up! Nobody completed a lap. Host or join a new race.',winner?.carId);
    }
  }
  private finish(message:string,winnerId?:number) {
    if(this.ending) return; this.ending=true; void this.lock();
    this.broadcast('finished',{message,winnerId});
    this.clock.setTimeout(()=>{void this.disconnect();},100);
  }
}
