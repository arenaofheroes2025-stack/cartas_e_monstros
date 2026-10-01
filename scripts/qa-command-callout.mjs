import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const failures=[];
await mkdir('qa',{recursive:true});
for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:844,height:390}].filter(viewport=>!process.env.QA_VIEW||process.env.QA_VIEW===viewport.name)){
  const page=await browser.newPage({viewport,deviceScaleFactor:1,hasTouch:viewport.name==='mobile'});
  page.on('pageerror',error=>failures.push(`${viewport.name}: ${error.message}`));
  await page.goto(process.env.QA_URL||'http://127.0.0.1:5182/',{waitUntil:'networkidle'});
  await page.evaluate(()=>{
    const game=window.__cartasGame;game.newGame('brasito',40732);
    const wild=game.wildActors.find(actor=>!actor.night);
    game.player.x=wild.x+0.5;game.player.z=wild.z+1.5;
    game.save.party[0].hp=10;
    game.beginBattle(wild);game.battle.intro=0;
    // Keep the hero readable in screenshots while preserving the arena and live UI.
    game.battle.ally.x=game.player.x-1.9;game.battle.ally.z=game.player.z+0.4;
    game.battle.foe.x=game.player.x+2.1;game.battle.foe.z=game.player.z-0.4;
    game.battle.ally.attackTimer=999;game.battle.foe.attackTimer=999;
    game.battle.ally.recovery=999;game.battle.foe.recovery=999;
    game.onChange();
  });
  await page.waitForTimeout(450);
  if(viewport.name==='mobile')await page.locator('button.command-follow').tap();
  else await page.keyboard.press('z');
  const cue=page.locator('.battle-command-callout');
  const expected=viewport.name==='mobile'?'Perseguir!':'Atacar!';
  await page.waitForFunction(label=>document.querySelector('.battle-command-callout')?.textContent?.includes(label),expected,{timeout:3000}).catch(()=>{});
  await cue.waitFor({state:'visible',timeout:3000}).catch(()=>{});
  const pose=await page.evaluate(()=>window.__cartasGame.battle.cue?.poseRemaining);
  if(!(pose>0))failures.push(`${viewport.name}: pose de comando não ficou ativa`);
  if(await cue.count()!==1||!(await cue.textContent()).includes(expected)){
    const diagnostic=await page.evaluate(()=>({mode:window.__cartasGame.mode,intro:window.__cartasGame.battle?.intro,
      cue:window.__cartasGame.battle?.cue,html:document.querySelector('.battle-command-callout')?.outerHTML}));
    failures.push(`${viewport.name}: balão de ${expected} ausente ${JSON.stringify(diagnostic)}`);
  }
  else {
    const position=await cue.evaluate(element=>{const rect=element.getBoundingClientRect();const exit=document.querySelector('.flee-button')?.getBoundingClientRect();return {
      inside:rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight,
      visible:getComputedStyle(element).visibility==='visible',
      exitOverlap:!!exit&&rect.left<exit.right&&rect.right>exit.left&&rect.top<exit.bottom&&rect.bottom>exit.top
    };});
    if(!position.inside||!position.visible||position.exitOverlap)failures.push(`${viewport.name}: balão cortado, oculto ou sobre a saída ${JSON.stringify(position)}`);
    await page.screenshot({path:`qa/command-${viewport.name}.png`});
  }
  await page.getByRole('button',{name:'Abrir mochila'}).click();
  const bag=page.getByRole('dialog',{name:'Mochila'});
  await bag.getByRole('button',{name:/Pão de viagem/}).click();
  await bag.getByRole('button',{name:/Usar na batalha/}).click();
  await page.waitForFunction(()=>document.querySelector('.battle-command-callout')?.textContent?.includes('Pão de viagem!'),undefined,{timeout:3000}).catch(()=>{});
  if(!(await cue.textContent()).includes('Pão de viagem!')||await cue.locator('img[src="/art/items/pao.png"]').count()!==1)
    failures.push(`${viewport.name}: balão de item sem nome ou ícone ${JSON.stringify(await page.evaluate(()=>({cue:window.__cartasGame.battle?.cue,html:document.querySelector('.battle-command-callout')?.outerHTML})))}`);
  else await page.screenshot({path:`qa/command-item-${viewport.name}.png`});
  await page.close();
}
await browser.close();
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log('Comandos e itens: pose e balão verificados em desktop e celular horizontal.');
