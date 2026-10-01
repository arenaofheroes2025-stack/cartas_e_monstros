import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'
]});
const url=process.env.QA_URL||'http://127.0.0.1:5184/';
const failures=[];
for(const profile of [
  {name:'desktop',width:1440,height:900,dpr:1,touch:false,quality:'high'},
  {name:'mobile',width:844,height:390,dpr:2,touch:true,quality:'low'}
]){
  const page=await browser.newPage({viewport:{width:profile.width,height:profile.height},
    deviceScaleFactor:profile.dpr,hasTouch:profile.touch,isMobile:profile.touch});
  page.on('pageerror',error=>failures.push(`${profile.name}: ${error.message}`));
  await page.addInitScript(quality=>localStorage.setItem('cartas-quality',quality),profile.quality);
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(()=>window.__cartasGame.newGame('brasito',346));
  await page.waitForTimeout(2200);
  const sample=await page.evaluate(()=>new Promise(resolve=>{
    const game=window.__cartasGame;
    const startX=game.player.x;
    const frames=[];
    let start=0,previous=0;
    const advance=now=>{
      if(!start){start=now;previous=now;}
      frames.push(now-previous);
      previous=now;
      game.player.x=startX+Math.min(1,(now-start)/4500)*26;
      if(now-start<4500)requestAnimationFrame(advance);
      else{
        frames.sort((a,b)=>a-b);
        const canvas=document.querySelector('canvas');
        resolve({frames:frames.length,p95:frames[Math.floor(frames.length*0.95)],
          max:frames.at(-1),dpr:canvas.width/canvas.getBoundingClientRect().width,
          x:game.player.x});
      }
    };
    requestAnimationFrame(advance);
  }));
  const screenshot=join(tmpdir(),`cartas-render-${profile.name}.png`);
  await page.screenshot({path:screenshot});
  console.log(profile.name,JSON.stringify(sample),screenshot);
  if(profile.name==='mobile'&&sample.dpr>1.05)failures.push(`mobile: DPR leve acima de 1 (${sample.dpr})`);
  // Software WebGL in headless Chromium is much slower than a real GPU.
  // This smoke test checks continuity and records timing; it is not an FPS gate.
  if(sample.frames<5)failures.push(`${profile.name}: a cena não continuou renderizando`);
  await page.close();
}
await browser.close();
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
