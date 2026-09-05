export function createPerformanceMeter(root: HTMLElement, read: () => {drawCalls: number; gpuMs: number;network?:{snapshotHz:number;snapshotAgeMs:number|null}}) {
  if (!new URLSearchParams(location.search).has('stats')) return { frame(_now: number, _work: number) {} };
  const output=document.createElement('output');output.setAttribute('aria-label','Frame performance');
  output.style.cssText='position:absolute;top:60px;right:14px;font:10px monospace;background:#fff9e9e8;padding:2px 5px;border-radius:3px;color:#202b29;z-index:9';
  root.append(output);
  const intervals:number[]=[];let last=0,totalWork=0;
  return {frame(now:number,work:number){
    if(last && !document.hidden){intervals.push(now-last);totalWork+=work;}last=now;
    if(intervals.length<60)return;
    const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
    intervals.sort((a,b)=>a-b);const p95=intervals[Math.floor(intervals.length*.95)],stats=read();
    output.textContent=`${(1000/mean).toFixed(0)} FPS · ${p95.toFixed(1)} ms p95`;
    if(stats.network)output.textContent+=` · NET ${stats.network.snapshotHz.toFixed(0)} Hz`;
    output.title=`CPU ${(totalWork/intervals.length).toFixed(2)} ms · GPU ${stats.gpuMs.toFixed(2)} ms · ${stats.drawCalls} draw calls`;
    intervals.length=0;totalWork=0;
  }};
}
