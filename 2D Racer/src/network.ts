import { Client, type Room } from '@colyseus/sdk';
import type { GameEvent, Input } from './types';
import type { Finished, Lobby, Snapshot } from './protocol';

export function createNetwork(callbacks:{lobby:(data:Lobby,sessionId:string)=>void;snapshot:(data:Snapshot)=>void;effect:(event:GameEvent)=>void;closed:(message:string,winnerId?:number)=>void;notice:(message:string)=>void}) {
  let room:Room|undefined, generation=0, ticker:ReturnType<typeof setInterval>|undefined;
  const stop=()=>{if(ticker) clearInterval(ticker);ticker=undefined;};
  async function connect(endpoint:string,name:string,capacity?:number,code?:string) {
    const attempt=++generation; stop();
    const old=room;room=undefined;if(old) void old.leave();
    const url=new URL(endpoint);
    if(!['http:','https:','ws:','wss:'].includes(url.protocol) || url.username || url.password) throw Error('Enter an HTTP(S) or WebSocket server address without credentials.');
    if(location.protocol==='https:' && ['http:','ws:'].includes(url.protocol)) throw Error('This HTTPS page needs an HTTPS/WSS server address.');
    const client=new Client(endpoint);
    const joined=code?await client.joinById(code,{name}):await client.create('race',{name,capacity});
    if(attempt!==generation){void joined.leave();return;}
    room=joined; room.reconnection.enabled=false;
    joined.onMessage('lobby',(data:Lobby)=>{if(room===joined)callbacks.lobby(data,joined.sessionId);});
    joined.onMessage('snapshot',(data:Snapshot)=>{if(room===joined)callbacks.snapshot(data);});
    joined.onMessage('effect',(event:GameEvent)=>{if(room===joined)callbacks.effect(event);});
    joined.onMessage('notice',(message:string)=>callbacks.notice(message));
    joined.onMessage('finished',(data:Finished)=>{
      if(room!==joined)return;room=undefined;stop();callbacks.closed(data.message,data.winnerId);void joined.leave();
    });
    joined.onLeave(()=>{if(room===joined){room=undefined;stop();callbacks.closed('Disconnected from the server. Host or join a new game.');}});
    joined.onError(()=>callbacks.notice('The connection had a problem. If it closes, host or join again.'));
    joined.send('sync');
  }
  return {
    host:(endpoint:string,name:string,capacity:number)=>connect(endpoint,name,capacity),
    join:(endpoint:string,name:string,code:string)=>connect(endpoint,name,undefined,code.trim().toUpperCase()),
    ready:(ready:boolean)=>room?.send('ready',ready), start:()=>room?.send('start'),
    stream(getInput:()=>Input){stop();ticker=setInterval(()=>room?.send('input',getInput()),1000/30);},
    clearInput(){room?.send('input',{throttle:false,brake:false,left:false,right:false});},
    leave(){generation++;stop();const old=room;room=undefined;if(old)void old.leave();},
  };
}
