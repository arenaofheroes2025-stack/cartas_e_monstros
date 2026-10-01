import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const failures=[];
const output=process.env.QA_OUT||'qa';
await mkdir(output,{recursive:true});
for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:844,height:390}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1,hasTouch:viewport.name==='mobile'});
  page.on('pageerror',error=>{if(!failures.some(message=>message.startsWith(`${viewport.name}:`)))
    failures.push(`${viewport.name}: ${error.stack||error.message}`);});
  await page.goto(process.env.QA_URL||'http://127.0.0.1:5182/',{waitUntil:'networkidle'});
  await page.evaluate(()=>{
    const game=window.__cartasGame;
    game.newGame('brasito',40732);
    const wild=game.wildActors.find(actor=>!actor.night);
    game.player.x=wild.x-1.8;game.player.z=wild.z+1.4;
    game.beginBattle(wild);game.battle.intro=0;
    const battle=game.battle;
    battle.ally.x=game.player.x+0.45;battle.ally.z=game.player.z-0.2;
    battle.foe.x=game.player.x+3.2;battle.foe.z=game.player.z-1.3;
    battle.foe.hp=1;battle.foe.attackTimer=999;
    battle.ally.windup=0.001;
    battle.ally.strikeOrigin={x:battle.foe.x,z:battle.foe.z};battle.ally.strikeRadius=1;
    game.update(0.02);
    game.update=()=>{};
    game.battle.finisher.elapsed=0.64;
    game.onChange();
  });
  await page.waitForTimeout(500);
  await page.screenshot({path:join(output,`battle-finish-${viewport.name}-enemy-card.png`)});
  await page.evaluate(()=>{window.__cartasGame.battle.finisher.elapsed=1.14;window.__cartasGame.onChange();});
  await page.waitForTimeout(450);
  const state=await page.evaluate(()=>({mode:window.__cartasGame.mode,finish:window.__cartasGame.battle?.finisher?.elapsed,
    enemyElement:window.__cartasGame.battle?.finisher?.enemyElement,
    allyElement:window.__cartasGame.battle?.finisher?.allyElement,
    zoom:document.querySelector('canvas')?.width,caption:document.querySelector('.battle-finish-label')?.textContent,
    controls:document.querySelector('.battle-command-list')?.textContent,canvas:!!document.querySelector('canvas')}));
  if(state.mode!=='battle'||state.finish!==1.14||!state.caption?.includes('foi derrotado')||
    state.enemyElement===state.allyElement||!state.canvas)
    failures.push(`${viewport.name}: estado visual incompleto ${JSON.stringify(state)}`);
  await page.screenshot({path:join(output,`battle-finish-${viewport.name}-enemy-gone.png`)});
  await page.evaluate(()=>{
    const game=window.__cartasGame,finish=game.battle.finisher;
    finish.elapsed=1.58;
    game.effects.push({kind:'xp',x:finish.ally.x,z:finish.ally.z,amount:finish.xp});
    game.onChange();
  });
  await page.waitForTimeout(450);
  await page.screenshot({path:join(output,`battle-finish-${viewport.name}-ally-card.png`)});
  await page.evaluate(()=>{window.__cartasGame.battle.finisher.elapsed=2.1;window.__cartasGame.onChange();});
  await page.waitForTimeout(450);
  await page.screenshot({path:join(output,`battle-finish-${viewport.name}-ally-return.png`)});
  await page.evaluate(()=>{window.__cartasGame.battle.finisher.elapsed=2.45;window.__cartasGame.onChange();});
  await page.waitForTimeout(350);
  await page.screenshot({path:join(output,`battle-finish-${viewport.name}-hand.png`)});
  await page.close();
}
await browser.close();
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log('Finalização da batalha exibida sem erros em desktop e celular horizontal.');
