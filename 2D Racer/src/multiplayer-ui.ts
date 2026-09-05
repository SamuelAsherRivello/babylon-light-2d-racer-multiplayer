import type { Lobby } from './protocol';

export function createMultiplayerUI(root:HTMLElement,callbacks:{host:(endpoint:string,name:string,count:number)=>void;join:(endpoint:string,name:string,code:string)=>void;ready:(value:boolean)=>void;start:()=>void;leave:()=>void}) {
  const demoOnly=import.meta.env.VITE_SINGLE_PLAYER_DEMO==='true';
  root.classList.add('multiplayer-ui');
  root.querySelector('.start-button')!.textContent='SINGLE PLAYER';
  root.querySelector('.intro')!.textContent=demoOnly?'SINGLE-PLAYER DEMO · Race the clock solo.':'Race the clock solo, or race your friends.';
  const controls=document.createElement('div');controls.className='multiplayer-controls';
  controls.innerHTML=`<label>Your name<input class="racer-name" maxlength="16" placeholder="Racer" autocomplete="nickname"></label>
    <div class="host-row"><label>Max players<select class="room-capacity"><option value="2">2 players</option><option value="3">3 players</option><option value="4" selected>4 players</option></select></label><button class="secondary host-button">HOST MULTIPLAYER</button></div>
    <div class="join-row"><label>Invite code<input class="join-code" maxlength="6" placeholder="ABC234" autocapitalize="characters" spellcheck="false"></label><button class="secondary join-button">JOIN MULTIPLAYER</button></div>
    <details><summary>Server connection</summary><label>Server address<input class="server-address" type="url" aria-label="Server address"></label><p>All friends must use the same server. Local setup: open this game at localhost:2567.</p></details>`;
  root.querySelector('.start-button')!.after(controls);
  controls.hidden=demoOnly;
  if(demoOnly){
    const explanation=document.createElement('p');explanation.className='tip';
    explanation.innerHTML='Multiplayer requires a separately running Colyseus server; GitHub Pages cannot run it. <a href="https://github.com/SamuelAsherRivello/babylon-light-2d-racer-multiplayer/blob/main/2D%20Racer/documentation/MULTIPLAYER.md">Multiplayer setup instructions</a>.';
    controls.after(explanation);
  }
  const notice=document.createElement('p');notice.className='session-notice';notice.setAttribute('role','status');root.querySelector('.intro')!.after(notice);
  const lobbyPanel=document.createElement('section');lobbyPanel.className='lobby-panel';lobbyPanel.hidden=true;
  lobbyPanel.setAttribute('aria-label','Multiplayer lobby');
  lobbyPanel.innerHTML=`<div class="eyebrow">MULTIPLAYER · PIT LANE</div><h2>YOUR LOBBY</h2><p>Share this code with your friends outside the game.</p><div class="invite-row"><strong class="invite-code"></strong><button class="copy-code secondary">COPY CODE</button></div><p class="lobby-status" role="status"></p><ol class="member-list"></ol><button class="ready-button primary">READY</button><button class="race-start secondary">START GAME</button><button class="leave-lobby secondary">LEAVE LOBBY</button><p class="lobby-notice" role="status"></p><p class="tip">Everyone returns to the main menu after the race. Each new race gets a new code.</p>`;
  root.append(lobbyPanel);
  const leaveRace=document.createElement('button');leaveRace.className='leave-race secondary';leaveRace.textContent='LEAVE RACE';leaveRace.hidden=true;root.append(leaveRace);
  const q=<T extends HTMLElement=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const endpoint=q<HTMLInputElement>('.server-address');
  endpoint.value=import.meta.env.VITE_MULTIPLAYER_SERVER || (import.meta.env.DEV?'http://127.0.0.1:2567':location.origin);
  const name=()=>q<HTMLInputElement>('.racer-name').value.trim();
  q('.host-button').onclick=()=>callbacks.host(endpoint.value.trim(),name(),Number(q<HTMLSelectElement>('.room-capacity').value));
  q('.join-button').onclick=()=>{
    const code=q<HTMLInputElement>('.join-code').value.trim().toUpperCase();
    if(!/^[A-Z2-9]{6}$/.test(code)){showNotice('Enter the six-character invite code from your host.');return;}
    callbacks.join(endpoint.value.trim(),name(),code);
  };
  let ownReady=false;
  q('.ready-button').onclick=()=>callbacks.ready(!ownReady);
  q('.race-start').onclick=callbacks.start;
  q('.leave-lobby').onclick=callbacks.leave;leaveRace.onclick=callbacks.leave;
  q('.copy-code').onclick=()=>{void navigator.clipboard?.writeText(q('.invite-code').textContent!).then(()=>showNotice('Code copied. Share it outside the game.')).catch(()=>showNotice('Select and copy the code above.'));};
  function showNotice(message:string){notice.textContent=message;q('.lobby-notice').textContent=message;}
  return {
    notice:showNotice,
    busy(value:boolean){for(const s of ['.host-button','.join-button','.start-button'])q<HTMLButtonElement>(s).disabled=value;},
    lobby(data:Lobby,sessionId:string){
      const waiting=data.phase==='lobby';root.dataset.network=waiting?'lobby':'race';lobbyPanel.hidden=!waiting;leaveRace.hidden=waiting;
      q('.invite-code').textContent=data.code;
      q('.lobby-status').textContent=`${data.members.length} / ${data.capacity} players · ${data.members.filter(m=>m.ready).length} ready`;
      q('.member-list').replaceChildren(...data.members.map(member=>{
        const li=document.createElement('li');const dot=document.createElement('span');dot.className='car-dot';dot.style.background=['#ffca3a','#ff597b','#6bdbff','#b09bff'][member.carId];
        li.append(dot,document.createTextNode(`${member.name}${member.sessionId===sessionId?' (you)':''}${member.sessionId===data.hostId?' · Host':''} — ${member.ready?'Ready':'Waiting'}`));return li;
      }));
      ownReady=data.members.find(m=>m.sessionId===sessionId)?.ready??false;q('.ready-button').textContent=ownReady?'NOT READY':'READY';
      const start=q<HTMLButtonElement>('.race-start');start.hidden=sessionId!==data.hostId;start.disabled=data.members.length===0 || !data.members.every(m=>m.ready);
      q('.lobby-notice').textContent=start.hidden?'Waiting for the host to start once everyone is ready.':'Start alone or with friends once everyone here is Ready.';
    },
    racing(){root.dataset.network='race';lobbyPanel.hidden=true;leaveRace.hidden=false;},
    reset(message=''){root.dataset.network='';lobbyPanel.hidden=leaveRace.hidden=true;showNotice(message);this.busy(false);},
  };
}
