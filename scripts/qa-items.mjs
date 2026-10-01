import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const failures=[];
await mkdir('qa',{recursive:true});
for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:844,height:390}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1,hasTouch:viewport.name==='mobile'});
  page.on('pageerror',error=>failures.push(`${viewport.name}: ${error.message}`));
  await page.goto(process.env.QA_URL||'http://127.0.0.1:5182/',{waitUntil:'networkidle'});
  await page.evaluate(()=>{const game=window.__cartasGame;game.newGame('brasito',40732);game.wildActors=[];game.onChange();});
  await page.waitForTimeout(350);
  if(viewport.name==='mobile')await page.getByRole('button',{name:'Abrir mochila'}).tap();
  else await page.keyboard.press('i');
  const panel=page.getByRole('dialog',{name:'Mochila'});
  if(await panel.count()!==1)failures.push(`${viewport.name}: mochila não abriu`);
  else {
    if(await panel.locator('.inventory-slot').count()!==12)failures.push(`${viewport.name}: mochila sem 12 espaços`);
    const fits=await panel.evaluate(element=>{const rect=element.getBoundingClientRect();return rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight;});
    if(!fits)failures.push(`${viewport.name}: mochila fora da tela`);
    await page.screenshot({path:`qa/items-bag-${viewport.name}.png`});
    await panel.getByRole('button',{name:'Fechar mochila'}).click();
  }
  await page.evaluate(()=>{const game=window.__cartasGame;game.wildActors=game.world.wild.map(w=>({...w,direction:0,moveTimer:0}));game.save.party[0].hp=12;const wild=game.wildActors[0];game.player.x=wild.x+0.5;game.player.z=wild.z+1.5;game.beginBattle(wild);game.battle.intro=0;game.battle.ally.attackTimer=999;game.battle.foe.attackTimer=999;game.onChange();});
  await page.waitForTimeout(200);
  const utility=page.getByRole('button',{name:'Abrir mochila'});
  if(await utility.count()!==1)failures.push(`${viewport.name}: botão da mochila ausente na batalha`);
  else {if(viewport.name==='mobile')await utility.tap();else await utility.click();}
  if(await panel.count()!==1)failures.push(`${viewport.name}: mochila não abriu durante a batalha`);
  else {
    await page.screenshot({path:`qa/items-battle-menu-${viewport.name}.png`});
    await panel.getByRole('button',{name:/Pão de viagem/}).click();
    await panel.getByRole('button',{name:/Usar na batalha/}).click();
    const state=await page.evaluate(()=>{const game=window.__cartasGame;return {hp:game.battle.ally.hp,count:game.save.inventory.length,menu:game.battleMenu};});
    if(state.hp!==24||state.count!==2||state.menu!==null)failures.push(`${viewport.name}: uso do pão incorreto ${JSON.stringify(state)}`);
    await page.waitForTimeout(400);
    await page.screenshot({path:`qa/items-use-${viewport.name}.png`});
    await utility.click();
    await panel.getByRole('button',{name:/Tônico de brasa/}).click();
    await panel.getByRole('button',{name:/Usar na batalha/}).click();
    if(!await page.getByText(/\+5 ATQ/).count())failures.push(`${viewport.name}: bônus não apareceu na arena`);
    await page.screenshot({path:`qa/items-status-${viewport.name}.png`});
  }
  await page.close();
}
await browser.close();
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('QA de mochila e uso na batalha: desktop e celular horizontal concluídos.');
