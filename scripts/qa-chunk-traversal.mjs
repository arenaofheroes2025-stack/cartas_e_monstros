import { chromium } from 'playwright';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',
  '--enable-precise-memory-info'
]});
const errors=[];
for(const profile of [
  {name:'desktop',width:1280,height:720,dpr:1,quality:'high',mobile:false},
  {name:'mobile',width:844,height:390,dpr:2,quality:'low',mobile:true}
]){
  const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},
    deviceScaleFactor:profile.dpr,hasTouch:profile.mobile,isMobile:profile.mobile,serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(`${profile.name}: ${error.message}`));
  page.on('console',message=>{if(message.type()==='error')errors.push(`${profile.name}: ${message.text()}`);});
  await page.addInitScript(quality=>localStorage.setItem('cartas-quality',quality),profile.quality);
  await page.goto(process.env.QA_URL||'http://127.0.0.1:4175/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.__cartasGame);
  await page.evaluate(()=>window.__cartasGame.newGame('brasito',346));
  await page.evaluate(()=>{window.__cartasGame.checkNearbyWild=()=>{};});
  await page.evaluate(async quality=>{
    const game=window.__cartasGame;
    game.player.x=112.5;game.player.z=160.5;
    game.world.updateStreaming(game.player,{x:1,z:0},quality,true);
    await new Promise((resolve,reject)=>{
      const began=Date.now();
      const timer=setInterval(()=>{
        if(game.world.visualReady.has('7,10')){clearInterval(timer);resolve();}
        else if(Date.now()-began>30000){clearInterval(timer);reject(new Error('Chunk inicial indisponível'));}
      },100);
    });
  },profile.quality);
  const stats=await page.evaluate(quality=>new Promise(resolve=>{
    const game=window.__cartasGame;
    const samples=[];
    let frames=0,unreadyFrames=0,maxCache=0,maxHeap=0,lastFrame=0;
    const end=game.player.x+15*16;
    const frame=now=>{
      if(lastFrame)samples.push(now-lastFrame);
      lastFrame=now;frames++;
      const key=`${Math.floor(game.player.x/16)},${Math.floor(game.player.z/16)}`;
      if(!game.world.visualReady.has(key))unreadyFrames++;
      maxCache=Math.max(maxCache,game.world.loadedChunkCount());
      maxHeap=Math.max(maxHeap,performance.memory?.usedJSHeapSize||0);
      if(game.player.x<end)requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const timer=setInterval(()=>{
      game.player.x=Math.min(end,game.player.x+1.2);
      game.world.updateStreaming(game.player,{x:1,z:0},quality);
      if(game.player.x<end)return;
      clearInterval(timer);
      samples.sort((a,b)=>a-b);
      resolve({chunksCrossed:15,mode:game.mode,frames,unreadyFrames,maxCache,
        maxHeapMB:Math.round(maxHeap/1048576),
        p95FrameMs:Math.round(samples[Math.floor(samples.length*0.95)]||0),
        maxFrameMs:Math.round(samples.at(-1)||0),
        finalX:game.player.x});
    },120);
  }),profile.quality);
  await page.waitForTimeout(500);
  const screenshot=join(process.env.QA_OUTPUT_DIR||tmpdir(),`chunk-traversal-${profile.name}.png`);
  await page.screenshot({path:screenshot});
  console.log(profile.name,JSON.stringify(stats),screenshot);
  if(stats.mode!=='explore')errors.push(`${profile.name}: exploração interrompida`);
  if(stats.maxCache>(profile.quality==='high'?169:81))errors.push(`${profile.name}: cache acima do limite`);
  await context.close();
}
await browser.close();
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
