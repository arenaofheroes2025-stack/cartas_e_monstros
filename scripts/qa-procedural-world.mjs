import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'
]});
const mobile=process.env.QA_MOBILE==='1';
const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:720},
  deviceScaleFactor:mobile?2:1,hasTouch:mobile,isMobile:mobile,serviceWorkers:'block'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.goto(process.env.QA_URL||'http://127.0.0.1:4174/',{waitUntil:'networkidle'});
await page.getByRole('button',{name:/Nova aventura/}).click();
await page.getByRole('spinbutton').fill('346');
await page.getByRole('button',{name:/Brasito/}).click();
await page.waitForTimeout(1000);
const points=process.env.QA_POINTS?.split(';').map(pair=>pair.split(',').map(Number))??
  (mobile?[[135,160]]:[[107,48],[135,160],[180,160],[210,147]]);
for(const [x,z] of points){
  await page.evaluate(async ([x,z])=>{
    const key='cartas-e-monstros-save-v1';
    const save=JSON.parse(localStorage.getItem(key));
    save.player={x:x+0.5,z:z+0.5};
    localStorage.setItem(key,JSON.stringify(save));
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open('cartas-e-monstros-world-v2',1);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const transaction=request.result.transaction('saves','readwrite');
        transaction.objectStore('saves').put(save,'current');
        transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);
      };
    });
  },[x,z]);
  await page.reload({waitUntil:'networkidle'});
  const began=Date.now();
  await page.getByRole('button',{name:/Continuar jornada/}).click();
  try{await page.getByText('COMPANHEIRO').waitFor({timeout:35000});}
  catch(error){console.log('load-failed',await page.evaluate(()=>document.body.innerText),errors);throw error;}
  await page.waitForTimeout(1800);
  const path=join(process.env.QA_OUTPUT_DIR||tmpdir(),`world-${mobile?'mobile':'desktop'}-${x}-${z}.png`);
  await page.screenshot({path});
  console.log(JSON.stringify({x,z,path,loadMs:Date.now()-began,playing:await page.locator('canvas').count()}));
}
console.log('errors',errors);
await browser.close();
if(errors.length)process.exitCode=1;
