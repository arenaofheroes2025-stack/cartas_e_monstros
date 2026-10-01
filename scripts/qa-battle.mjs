import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const failures=[];
const url=process.env.QA_URL||'http://127.0.0.1:5182/';
await mkdir('qa',{recursive:true});
for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:844,height:390}].filter(item=>!process.argv[2]||item.name===process.argv[2])){
  const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,hasTouch:viewport.name==='mobile'});
  page.on('pageerror',error=>failures.push(`${viewport.name}: ${error.message}`));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(()=>{
    const game=window.__cartasGame;
    game.newGame('brasito',346);
    const wild=game.wildActors.find(actor=>!actor.night);
    game.player.x=wild.x-1.3;
    game.player.z=wild.z-0.5;
    game.beginBattle(wild);
  });
  await page.waitForTimeout(500);
  await page.screenshot({path:`qa/battle-summon-${viewport.name}.png`});
  await page.evaluate(()=>{const game=window.__cartasGame;game.battle.intro=0;game.onChange();});
  await page.waitForTimeout(600);
  await page.screenshot({path:`qa/battle-ready-${viewport.name}.png`});
  console.log(viewport.name,await page.evaluate(()=>({mode:window.__cartasGame.mode,buttons:[...document.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')).filter(Boolean)})));
  const initial=await page.evaluate(()=>{
    const game=window.__cartasGame;
    game.battle.foe.attackTimer=100;
    game.battle.ally.attackTimer=100;
    game.battle.ally.recovery=100;
    return {command:game.battle.command,separation:Math.hypot(game.battle.ally.x-game.player.x,game.battle.ally.z-game.player.z),
      foe:{x:game.battle.foe.x,z:game.battle.foe.z}};
  });
  if(initial.command!=='return'||initial.separation>2.25)failures.push(`${viewport.name}: companheiro não iniciou perto do herói`);
  if(await page.getByRole('button',{name:'Voltar'}).count())failures.push(`${viewport.name}: Voltar apareceu antes da ordem de avançar`);
  const panelSides=[];
  for(const [side,dx,dz] of [['right',3,-3],['left',-3,3]]){
    await page.evaluate(({dx,dz})=>{
      const game=window.__cartasGame;
      game.battle.foe.x=game.player.x+dx;
      game.battle.foe.z=game.player.z+dz;
      game.battle.foe.recovery=100;
    },{dx,dz});
    await page.waitForTimeout(500);
    await page.screenshot({path:`qa/battle-panel-foe-${side}-${viewport.name}.png`});
    panelSides.push(await page.locator('.battle-command-cluster').boundingBox());
  }
  if(viewport.name==='desktop'&&(!panelSides[0]||!panelSides[1]||panelSides[0].x>=panelSides[1].x-60))
    failures.push(`${viewport.name}: comandos não mudaram para o lado oposto ao inimigo`);
  await page.evaluate(foe=>{
    const game=window.__cartasGame;
    game.battle.foe.x=foe.x;game.battle.foe.z=foe.z;
  },initial.foe);
  await page.waitForTimeout(350);
  if(viewport.name==='mobile'){
    const overlap=await page.evaluate(()=>{
      const hud=document.querySelector('.battle-bottom').getBoundingClientRect();
      const commands=document.querySelector('.battle-command-cluster').getBoundingClientRect();
      const enemy=document.querySelector('.combatant.enemy').getBoundingClientRect();
      const flee=document.querySelector('.flee-button').getBoundingClientRect();
      const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      return {enemy:intersects(commands,enemy),flee:intersects(commands,flee),hud:intersects(commands,hud)};
    });
    if(overlap.hud||overlap.enemy||overlap.flee)failures.push(`mobile: sobreposição do painel ${JSON.stringify(overlap)}`);
  }
  await page.keyboard.press('z');
  await page.waitForTimeout(80);
  await page.screenshot({path:`qa/battle-commands-${viewport.name}.png`});
  if(await page.getByRole('button',{name:'Voltar'}).count())failures.push(`${viewport.name}: Voltar apareceu após o golpe único`);
  await page.evaluate(()=>{
    window.__cartasGame.battle.ally.attackTimer=1.2;
    window.__cartasGame.battle.ally.recovery=0;
  });
  await page.waitForTimeout(80);
  const allyCooldown=await page.locator('.command-attack .command-cooldown').textContent();
  if(!allyCooldown?.match(/^\d+\.\ds$/))failures.push(`${viewport.name}: recarga do ataque aliado não apareceu no botão: ${allyCooldown}`);
  await page.screenshot({path:`qa/battle-ally-cooldown-${viewport.name}.png`});
  await page.evaluate(()=>{window.__cartasGame.battle.ally.attackTimer=100;});
  const pursue=page.getByRole('button',{name:'Perseguir'});
  if(viewport.name==='mobile')await pursue.tap();else await pursue.click();
  await page.waitForTimeout(80);
  const returnButton=page.getByRole('button',{name:'Voltar'});
  const afterClick=await page.evaluate(()=>window.__cartasGame.battle?.command);
  if(afterClick!=='follow'||await returnButton.count()!==1)failures.push(`${viewport.name}: Perseguir não ativou Voltar`);
  if(viewport.name==='mobile')await returnButton.tap();else await returnButton.click();
  await page.waitForTimeout(80);
  const command=await page.evaluate(()=>window.__cartasGame.battle?.command);
  if(command!=='return'||await returnButton.count())failures.push(`${viewport.name}: Voltar não recolheu o monstro e o botão`);
  await page.evaluate(()=>{window.__cartasGame.battle.ally.charge=100;window.__cartasGame.onChange();});
  await page.waitForTimeout(80);
  const special=page.getByRole('button',{name:/Especial:/});
  if(await special.isDisabled())failures.push(`${viewport.name}: especial não habilitou com carga completa`);
  if(viewport.name==='mobile')await special.tap();else await page.keyboard.press('r');
  if(await page.evaluate(()=>window.__cartasGame.battle?.command)!=='special')failures.push(`${viewport.name}: especial não responde ao botão`);
  await page.evaluate(()=>{
    const game=window.__cartasGame;
    game.battle.ally.attackTimer=100;
    game.battle.foe.x=game.battle.ally.x+0.8;
    game.battle.foe.z=game.battle.ally.z;
    game.battle.foe.attackTimer=0;
  });
  await page.waitForTimeout(240);
  await page.screenshot({path:`qa/battle-telegraph-${viewport.name}.png`});
  if(viewport.name==='desktop'){
    await page.evaluate(()=>{
      const game=window.__cartasGame;
      game.newGame('brasito',1234);
      game.wildActors=[];
      const npc=game.walkingNpcs[0];
      game.player.x=npc.x;game.player.z=npc.z+1;
      game.onChange();
    });
    await page.waitForTimeout(150);
    if(await page.locator('.world-action kbd').textContent()!=='Z')failures.push('desktop: a ação do mapa não mostra Z');
    await page.keyboard.press('z');
    if(await page.evaluate(()=>window.__cartasGame.mode)!=='dialog')failures.push('desktop: Z não abriu o diálogo');
    await page.keyboard.press('e');
    if(await page.evaluate(()=>window.__cartasGame.mode)!=='dialog')failures.push('desktop: E ainda fecha o diálogo');
    await page.keyboard.press('z');
    if(await page.evaluate(()=>window.__cartasGame.mode)!=='explore')failures.push('desktop: Z não encerrou a fala');
  }
  await page.close();
}
await browser.close();
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log(`QA da batalha concluído: ${process.argv[2]||'desktop e celular horizontal'}.`);
