import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'
]});
const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1,
  isMobile:true,hasTouch:true});
const failures=[];
page.on('pageerror',error=>failures.push(error.message));
await page.goto(process.env.QA_URL||'http://127.0.0.1:5184/',{waitUntil:'networkidle'});
await page.evaluate(()=>{
  const game=window.__cartasGame;
  game.newGame('brasito',346);
  const wild=game.wildActors.find(actor=>!actor.night);
  game.player.x=wild.x-1.3;
  game.player.z=wild.z-0.5;
  game.beginBattle(wild);
  game.battle.intro=0;
  game.battle.foe.attackTimer=100;
  game.onChange();
  window.__touchLog=[];
  for(const type of ['pointerdown','pointercancel','pointerup','touchstart','touchend']){
    document.addEventListener(type,event=>window.__touchLog.push({type,
      target:event.target instanceof Element?event.target.closest('button')?.getAttribute('aria-label')||event.target.className:'',
      pointerId:event.pointerId,touches:event.touches?.length}),true);
  }
});
await page.waitForTimeout(500);
const attack=await page.getByRole('button',{name:'Atacar'}).boundingBox();
if(!attack)throw new Error('Botão Atacar não apareceu');
const joystick={x:115,y:225,id:1};
const action={x:attack.x+attack.width/2,y:attack.y+attack.height/2,id:2};
const cdp=await page.context().newCDPSession(page);
const dispatch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
await dispatch('touchStart',[joystick]);
await dispatch('touchMove',[{...joystick,x:143,y:225}]);
await page.waitForTimeout(150);
const before=await page.evaluate(()=>({move:{...window.__cartasGame.move},command:window.__cartasGame.battle.command}));
await dispatch('touchStart',[{...joystick,x:143,y:225},action]);
await page.waitForTimeout(150);
const during=await page.evaluate(()=>({move:{...window.__cartasGame.move},command:window.__cartasGame.battle.command,
  log:window.__touchLog}));
await dispatch('touchEnd',[action]);
await page.waitForTimeout(100);
const afterAction=await page.evaluate(()=>({move:{...window.__cartasGame.move},command:window.__cartasGame.battle.command,
  log:window.__touchLog,joystickOpacity:document.querySelector('.mobile-joystick-base')?.style.opacity}));
await dispatch('touchMove',[{...joystick,x:158,y:225}]);
const followBox=await page.getByRole('button',{name:'Perseguir'}).boundingBox();
if(!followBox)throw new Error('Botão Perseguir não apareceu');
const follow={x:followBox.x+followBox.width/2,y:followBox.y+followBox.height/2,id:3};
await dispatch('touchStart',[{...joystick,x:158,y:225},follow]);
await page.waitForTimeout(80);
const secondAction=await page.evaluate(()=>({move:{...window.__cartasGame.move},command:window.__cartasGame.battle.command}));
await dispatch('touchEnd',[follow]);
const afterSecond=await page.evaluate(()=>({...window.__cartasGame.move}));
await dispatch('touchEnd',[{...joystick,x:143,y:225}]);
const afterJoystick=await page.evaluate(()=>({...window.__cartasGame.move}));
const observations={before,during,afterAction,secondAction,afterSecond,afterJoystick};
if(Math.hypot(before.move.x,before.move.z)<0.1)failures.push('Joystick não movimentou o herói');
if(during.command!=='attack')failures.push('Toque na ação não foi aceito durante o movimento');
if(Math.hypot(during.move.x,during.move.z)<0.1)failures.push('Movimento parou após tocar a ação');
if(Math.hypot(afterAction.move.x,afterAction.move.z)<0.1)failures.push('Movimento parou ao soltar apenas a ação');
if(secondAction.command!=='follow'||Math.hypot(secondAction.move.x,secondAction.move.z)<0.1)
  failures.push('Segunda ação não funcionou durante o mesmo movimento');
if(Math.hypot(afterSecond.x,afterSecond.z)<0.1)failures.push('Segunda ação interrompeu o joystick');
if(Math.hypot(afterJoystick.x,afterJoystick.z)>0.01)failures.push('Joystick continuou após soltar o dedo de movimento');

await page.evaluate(()=>{
  const game=window.__cartasGame;
  game.newGame('brasito',346);
  game.wildActors=[];
  const npc=game.walkingNpcs[0];
  game.player.x=npc.x;
  game.player.z=npc.z+0.8;
  game.onChange();
});
await page.waitForTimeout(200);
const interactBox=await page.locator('.world-touch-actions button').first().boundingBox();
if(!interactBox)failures.push('Ação de conversa não apareceu na exploração');
else{
  await dispatch('touchStart',[joystick]);
  await dispatch('touchMove',[{...joystick,x:143,y:225}]);
  const interact={x:interactBox.x+interactBox.width/2,y:interactBox.y+interactBox.height/2,id:4};
  await dispatch('touchStart',[{...joystick,x:143,y:225},interact]);
  await page.waitForTimeout(80);
  const mode=await page.evaluate(()=>window.__cartasGame.mode);
  if(mode!=='dialog')failures.push('Ação de conversa falhou enquanto o joystick estava ativo');
  await dispatch('touchEnd',[interact]);
  await dispatch('touchEnd',[{...joystick,x:143,y:225}]);
}
await browser.close();
if(failures.length){console.error(failures.join('\n'),JSON.stringify(observations,null,2));process.exitCode=1;}
else console.log('Multitoque OK: movimento, comandos consecutivos e interação durante o toque.');
