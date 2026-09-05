import { Client, type Room } from '@colyseus/sdk';
const client=new Client('http://127.0.0.1:2567');const rooms:Room[]=[];
const samples:number[][]=[[],[],[],[]];let racing=false,responseMs:number|undefined,pressedAt=0;
const observe=(room:Room,index:number)=>{room.reconnection.enabled=false;room.onMessage('lobby',()=>{});room.onMessage('effect',()=>{});room.onMessage('notice',()=>{});room.onMessage('finished',()=>{});room.onMessage('snapshot',(data:any)=>{if(data.race.phase==='racing'){racing=true;samples[index].push(performance.now());if(index===0 && pressedAt && responseMs===undefined && data.race.cars[0].speed>0)responseMs=performance.now()-pressedAt;}});};
try{
 rooms.push(await client.create('race',{capacity:4}));observe(rooms[0],0);
 for(let i=1;i<4;i++){rooms.push(await client.joinById(rooms[0].roomId));observe(rooms[i],i);}
 for(const room of rooms)room.send('ready',true);await new Promise(r=>setTimeout(r,100));rooms[0].send('start');
 const deadline=Date.now()+10000;while(!racing){if(Date.now()>deadline)throw Error('Race start timed out');await new Promise(r=>setTimeout(r,10));}
 pressedAt=performance.now();rooms[0].send('input',{throttle:true,brake:false,left:false,right:false});
 await new Promise(r=>setTimeout(r,5000));
 console.log(JSON.stringify({responseMs,clients:samples.map(times=>{const gaps=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);return {messages:times.length,hz:(times.length-1)*1000/(times.at(-1)!-times[0]),p95GapMs:gaps[Math.floor(gaps.length*.95)],maxGapMs:gaps.at(-1)};})},null,2));
}finally{await Promise.all(rooms.map(r=>r.connection.isOpen?r.leave().catch(()=>{}):Promise.resolve()));}
