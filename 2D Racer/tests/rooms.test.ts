import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, type Room } from '@colyseus/sdk';
import { matchMaker } from '@colyseus/core';
import { createGameServer } from '../server/app';
import type { RaceRoom } from '../server/RaceRoom';
import type { Lobby, Snapshot, Finished } from '../src/protocol';
import { sampleTrack, TRACK_LENGTH } from '../src/track';

async function until(check:()=>boolean){const end=Date.now()+5000;while(!check()){if(Date.now()>end)throw Error('Network condition timed out');await new Promise(r=>setTimeout(r,10));}}
function observe(room:Room){
  room.reconnection.enabled=false;
  const seen:{lobby?:Lobby;snapshot?:Snapshot;finished?:Finished;left:boolean}={left:false};
  room.onMessage('lobby',data=>seen.lobby=data);room.onMessage('snapshot',data=>seen.snapshot=data);
  room.onMessage('finished',data=>seen.finished=data);room.onMessage('effect',()=>{});room.onMessage('notice',()=>{});
  room.onLeave(()=>seen.left=true);room.send('sync');return seen;
}
test('real Colyseus clients: capacity, ready/start authority, inputs, timeout, closure, fresh codes',{timeout:30000},async t=>{
  const server=createGameServer();await server.listen(2568,'127.0.0.1');
  const address=server.transport.server!.address() as {port:number};
  const client=new Client(`http://127.0.0.1:${address.port}`);
  try{
    await assert.rejects(client.create('race',{capacity:5}));
    await assert.rejects(client.joinById('BAD234'));
    for(const count of [2,3,4])await t.test(`${count} human players`,async()=>{
      const rooms:Room[]=[];
      try{
        rooms.push(await client.create('race',{capacity:count,name:'Host'}));const seen=[observe(rooms[0])];
        assert.match(rooms[0].roomId,/^[A-Z2-9]{6}$/);
        for(let i=1;i<count;i++){rooms.push(await client.joinById(rooms[0].roomId,{name:`Guest ${i}`}));seen.push(observe(rooms[i]));}
        await until(()=>seen.every(s=>s.lobby?.members.length===count));
        const authoritative=matchMaker.getLocalRoomById(rooms[0].roomId) as RaceRoom;
        await assert.rejects(client.joinById(rooms[0].roomId));
        rooms[0].send('start');await new Promise(r=>setTimeout(r,40));assert.equal(authoritative.running,false);
        for(const room of rooms)room.send('ready',true);
        await until(()=>seen[0].lobby!.members.every(m=>m.ready));
        rooms[1].send('start');await new Promise(r=>setTimeout(r,40));assert.equal(authoritative.running,false);
        rooms[0].send('start');await until(()=>seen.every(s=>s.snapshot?.race.phase==='countdown'));
        assert.equal(authoritative.race!.cars.length,count);
        await assert.rejects(client.joinById(rooms[0].roomId));
        for(let i=0;i<3;i++)authoritative.tick(1000);
        rooms[1].send('input',{throttle:true,brake:false,left:false,right:false,x:99999});
        await until(()=>authoritative.controls.size>0);
        authoritative.tick(500);
        assert.ok(authoritative.race!.cars[1].speed>0);assert.equal(authoritative.race!.cars[0].speed,0);
        assert.ok(Math.abs(authoritative.race!.cars[1].x)<100,'client cannot supply its position');
        rooms[1].send('input',{throttle:'yes',brake:false,left:false,right:false});
        for(let i=0;i<31;i++)authoritative.tick(1000);
        await until(()=>seen.every(s=>s.finished && s.left));
        assert.match(seen[0].finished!.message,/Time is up/);
        await assert.rejects(client.joinById(rooms[0].roomId));
      }finally{await Promise.all(rooms.map(r=>r.connection.isOpen?r.leave().catch(()=>{}):Promise.resolve()));}
    });
    for (const count of [1,2,3]) await t.test(`host starts with ${count} players in a four-seat room`, async () => {
      const rooms:Room[]=[];
      try {
        rooms.push(await client.create('race',{capacity:4}));const seen=[observe(rooms[0])];
        for(let i=1;i<count;i++){rooms.push(await client.joinById(rooms[0].roomId));seen.push(observe(rooms[i]));}
        await until(()=>seen[0].lobby?.members.length===count);
        const room=matchMaker.getLocalRoomById(rooms[0].roomId) as RaceRoom;
        rooms[0].send('start');await new Promise(r=>setTimeout(r,40));assert.equal(room.running,false);
        for(const player of rooms)player.send('ready',true);
        await until(()=>seen[0].lobby!.members.every(m=>m.ready));
        rooms[0].send('start');await until(()=>seen.every(s=>s.snapshot?.race.phase==='countdown'));
        assert.equal(room.race!.cars.length,count,'spawn only the players present, with no empty seats or bots');
        await assert.rejects(client.joinById(room.roomId));
      } finally { await Promise.all(rooms.map(r=>r.connection.isOpen?r.leave().catch(()=>{}):Promise.resolve())); }
    });
    await t.test('host departure closes lobby and fresh room gets new code',async()=>{
      const host=await client.create('race',{capacity:2});observe(host);
      const guest=await client.joinById(host.roomId);const seen=observe(guest);
      await host.leave();await until(()=>seen.left && !!seen.finished);assert.match(seen.finished!.message,/host left/);
      const fresh=await client.create('race',{capacity:2});observe(fresh);assert.notEqual(fresh.roomId,host.roomId);await fresh.leave();
    });
    await t.test('guest lobby departure frees seat and clears readiness',async()=>{
      const host=await client.create('race',{capacity:3});const seen=observe(host);
      const guest=await client.joinById(host.roomId);observe(guest);
      host.send('ready',true);await until(()=>seen.lobby?.members[0].ready===true);
      await guest.leave();await until(()=>seen.lobby?.members.length===1);
      assert.equal(seen.lobby!.members[0].ready,false);await host.leave();
    });
    await t.test('non-host finish is broadcast and closes every connection',async()=>{
      const host=await client.create('race',{capacity:2,name:'Host'});const a=observe(host);
      const guest=await client.joinById(host.roomId,{name:'Winner'});const b=observe(guest);
      host.send('ready',true);guest.send('ready',true);await until(()=>a.lobby?.members.every(m=>m.ready)===true);
      host.send('start');await until(()=>!!a.snapshot);
      const room=matchMaker.getLocalRoomById(host.roomId) as RaceRoom;
      room.setSimulationInterval();
      // Drive the real server simulation with a deterministic input fixture; the result travels over real sockets.
      for(let i=0;i<33*120 && !room.ending;i++){
        const c=room.race!.cars[1],target=sampleTrack(c.progress+7/TRACK_LENGTH);
        const raw=Math.atan2(target.x-c.x,target.z-c.z)-c.heading,angle=Math.atan2(Math.sin(raw),Math.cos(raw));
        room.controls.set(guest.sessionId,{input:{throttle:true,brake:false,left:angle<-.045,right:angle>.045},at:Date.now()});
        room.tick(1000/120);
      }
      await until(()=>!!a.finished && !!b.finished);
      assert.equal(a.finished!.winnerId,1);assert.equal(b.finished!.winnerId,1);assert.match(a.finished!.message,/Winner won/);
      // Restore the room clock so its scheduled disconnect can run.
      room.setSimulationInterval(()=>{},1000/60);
      await until(()=>a.left && b.left);
    });
    await t.test('racing disconnect cancels the round for peers',async()=>{
      const host=await client.create('race',{capacity:2});const a=observe(host);
      const guest=await client.joinById(host.roomId);observe(guest);
      host.send('ready',true);guest.send('ready',true);await until(()=>a.lobby?.members.every(m=>m.ready)===true);
      host.send('start');await until(()=>!!a.snapshot);await guest.leave();
      await until(()=>a.left && !!a.finished);assert.match(a.finished!.message,/disconnected/);
    });
  }finally{await server.gracefullyShutdown(false);}
});
