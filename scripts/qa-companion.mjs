import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const failures=[];
const url=process.env.QA_URL||'http://127.0.0.1:5182/';
await mkdir('qa',{recursive:true});

for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:844,height:390}]){
  const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,hasTouch:viewport.name==='mobile'});
  page.on('pageerror',error=>failures.push(`${viewport.name}: ${error.message}`));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(()=>{
    const game=window.__cartasGame;
    game.newGame('brasito',346);
    game.wildActors=[];
    const monster=game.save.party[0];
    monster.level=3;monster.hp=13;monster.xp=22;
    game.persist();game.onChange();
  });
  await page.waitForTimeout(350);
  const chip=page.locator('.companion-chip');
  const label=await chip.getAttribute('aria-label');
  if(!label?.includes('13 de 46 pontos de vida')||!label.includes('22 de 42 de experiência'))
    failures.push(`${viewport.name}: vida ou XP incorretos no cartão: ${label}`);
  await page.screenshot({path:`qa/companion-hud-${viewport.name}.png`});
  if(viewport.name==='mobile'){
    const overlap=await page.evaluate(()=>{
      const a=document.querySelector('.companion-chip').getBoundingClientRect();
      const b=document.querySelector('.dpad').getBoundingClientRect();
      return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    });
    if(overlap)failures.push('mobile: cartão cobre o direcional');
  }
  if(viewport.name==='mobile')await chip.tap();else await chip.click();
  const panel=page.getByRole('dialog',{name:/brasito/i});
  if(await panel.count()!==1)failures.push(`${viewport.name}: ficha não abriu`);
  else {
    if(!await panel.getByText('13 / 46 PV').count()||!await panel.getByText('22 / 42 XP').count())
      failures.push(`${viewport.name}: ficha não mostra os recursos atuais`);
    const before=await page.evaluate(()=>window.__cartasGame.save.elapsed);
    await page.waitForTimeout(350);
    const after=await page.evaluate(()=>window.__cartasGame.save.elapsed);
    if(after!==before)failures.push(`${viewport.name}: mundo continuou andando com a ficha aberta`);
    await page.screenshot({path:`qa/companion-details-${viewport.name}.png`});
    await panel.getByRole('button',{name:'Fechar detalhes'}).click();
  }
  if(viewport.name==='desktop'){
    await page.waitForTimeout(180);
    await page.keyboard.down('d');
    try{await page.waitForFunction(()=>document.querySelector('.companion-sprite')?.classList.contains('walking'),undefined,{timeout:4000});}
    catch{failures.push('desktop: retrato não mudou para animação de caminhada');}
    await page.keyboard.up('d');
    try{await page.waitForFunction(()=>!document.querySelector('.companion-sprite')?.classList.contains('walking'),undefined,{timeout:4000});}
    catch{failures.push('desktop: retrato não voltou ao repouso');}
  }
  await page.close();
}

await browser.close();
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log('QA do companheiro concluído: desktop e celular horizontal.');
