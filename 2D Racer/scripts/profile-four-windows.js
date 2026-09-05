async(page)=>{
 const pages=[page];await page.goto('http://127.0.0.1:5181/');await page.getByRole('button',{name:'HOST MULTIPLAYER',exact:true}).click();await page.getByRole('region',{name:'Multiplayer lobby'}).waitFor();const code=await page.locator('.invite-code').textContent();
 for(let i=1;i<4;i++){const p=await (await page.context().browser().newContext({viewport:{width:390,height:844}})).newPage();pages.push(p);await p.goto('http://127.0.0.1:5181/');await p.getByLabel('Invite code',{exact:true}).fill(code);await p.getByRole('button',{name:'JOIN MULTIPLAYER',exact:true}).click();await p.getByRole('region',{name:'Multiplayer lobby'}).waitFor();}
 for(const p of pages)await p.getByRole('button',{name:'READY',exact:true}).click();await page.getByRole('button',{name:'START GAME',exact:true}).click();
 await Promise.all(pages.map(p=>p.waitForFunction(()=>window.__rally.state.phase==='racing')));
 await Promise.all(pages.map(async p=>{
   await p.evaluate(()=>{window.__inputAt=performance.now();window.__inputDelay=null;const watch=()=>{if(window.__rally.state.cars[0].speed>0)window.__inputDelay=performance.now()-window.__inputAt;else requestAnimationFrame(watch);};requestAnimationFrame(watch);});
   await p.keyboard.down('w');await p.keyboard.down('a');
 }));
 const results=await Promise.all(pages.map(p=>p.evaluate(()=>new Promise(resolve=>{const times=[];let last=performance.now();function sample(now){times.push(now-last);last=now;if(times.length<300)requestAnimationFrame(sample);else{times.sort((a,b)=>a-b);resolve({fps:1000/(times.reduce((a,b)=>a+b,0)/times.length),p95:times[Math.floor(times.length*.95)],inputToVisibleMotionMs:window.__inputDelay,...window.__rally.stats()});}}requestAnimationFrame(sample);}))))
 await page.evaluate(value=>window.__fourPerf=value,results);for(const p of pages.slice(1))await p.context().close();
}
