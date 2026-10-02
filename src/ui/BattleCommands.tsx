import { useEffect, useRef, type RefObject } from 'react';
import { type Camera, Vector3 } from 'three';
import { Game } from '../game/game';
import { attackInterval, attackRadius, dodgeCooldown } from '../game/battle/rules';
import { BAG_CAPACITY, ITEMS, itemArt } from '../game/items';
import { ELEMENT_COLOR, ELEMENT_LABEL, ELEMENTS, SPECIES } from '../game/content';
import './battleCommands.css';
import './battleQuickBag.css';
import './battleQuickCards.css';

const projected=new Vector3();
const companionProjected=new Vector3();
const foeProjected=new Vector3();

function overlaps(a:{left:number;right:number;top:number;bottom:number},b:{left:number;right:number;top:number;bottom:number}):boolean {
  return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
}

export function BattleCommands({game,cameraRef}:{game:Game;cameraRef:RefObject<Camera|null>}) {
  const cluster=useRef<HTMLDivElement>(null);
  const dodge=useRef<HTMLButtonElement>(null);
  const dodgeLabel=useRef<HTMLElement>(null);
  const attack=useRef<HTMLButtonElement>(null);
  const attackLabel=useRef<HTMLElement>(null);
  const special=useRef<HTMLButtonElement>(null);
  const specialLabel=useRef<HTMLElement>(null);
  const lastTouchAction=useRef(0);
  const preferredSide=useRef<'left'|'right'|null>(null);
  const press=(action:()=>void)=>({
    onPointerDown:(event:React.PointerEvent)=>{if(event.pointerType==='touch'){lastTouchAction.current=Date.now();action();}},
    onClick:(event:React.MouseEvent)=>{if((event.nativeEvent as PointerEvent).pointerType==='touch'||Date.now()-lastTouchAction.current<2000)return;action();}
  });
  useEffect(()=>{
    let frame=0;
    const touchLayout=window.matchMedia('(pointer: coarse) and (orientation: landscape) and (max-height: 600px)');
    const update=()=>{
      const battle=game.battle,camera=cameraRef.current,element=cluster.current;
      if(battle&&camera&&element){
        const parent=element.parentElement?.getBoundingClientRect();
        if(parent){
          if(touchLayout.matches){
            // Os comandos compartilham o recuo do Pular via CSS e não seguem a câmera.
            if(element.style.left)element.style.removeProperty('left');
            if(element.style.right)element.style.removeProperty('right');
            if(element.style.top)element.style.removeProperty('top');
            element.style.visibility='visible';
          }else{
          const player=game.player;
          projected.set(player.x,game.getGroundHeight(player.x,player.z)+1.05,player.z).project(camera);
          const playerX=(projected.x+1)*parent.width*0.5;
          const playerY=(1-projected.y)*parent.height*0.5;
          const width=element.offsetWidth,height=element.offsetHeight;
          const mobileLandscape=parent.width<=950&&parent.height<=500;
          companionProjected.set(battle.ally.x,game.getGroundHeight(battle.ally.x,battle.ally.z)+0.7,battle.ally.z).project(camera);
          const companionX=(companionProjected.x+1)*parent.width*0.5;
          foeProjected.set(battle.foe.x,game.getGroundHeight(battle.foe.x,battle.foe.z)+0.65,battle.foe.z).project(camera);
          const foeX=(foeProjected.x+1)*parent.width*0.5;
          const foeY=(1-foeProjected.y)*parent.height*0.5;
          // A posição só troca quando o inimigo atravessa uma faixa ao redor do herói.
          // Isso evita que o painel fique alternando de lado a cada quadro.
          if(foeX>playerX+55)preferredSide.current='left';
          else if(foeX<playerX-55)preferredSide.current='right';
          else if(!preferredSide.current)preferredSide.current=companionX<playerX?'right':'left';
          const gapFor=(side:'left'|'right')=>
            Math.max(mobileLandscape?72:76,side==='right'?companionX-playerX+85:playerX-companionX+85);
          const positionFor=(side:'left'|'right')=>side==='right'?playerX+gapFor(side):playerX-gapFor(side)-width;
          const requested=preferredSide.current;
          const other=requested==='left'?'right':'left';
          const fits=(side:'left'|'right')=>positionFor(side)>=12&&positionFor(side)+width<=parent.width-12;
          const side=!fits(requested)&&fits(other)?other:requested;
          let x=Math.max(12,Math.min(parent.width-width-12,positionFor(side)));
          const minY=mobileLandscape?72:86;
          let y=Math.max(minY,Math.min(parent.height-height-12,playerY-height*0.5));
          // HUDs visíveis também são obstáculos para os comandos. Em especial,
          // no celular o painel pode passar sob o botão de saída ou a ficha inimiga.
          for(const selector of ['.combatant.enemy','.flee-button','.battle-bottom']){
            const obstruction=element.parentElement?.querySelector<HTMLElement>(selector);
            if(!obstruction)continue;
            const rect=obstruction.getBoundingClientRect();
            const box={left:rect.left-parent.left-5,right:rect.right-parent.left+5,
              top:rect.top-parent.top-5,bottom:rect.bottom-parent.top+5};
            if(!overlaps({left:x,right:x+width,top:y,bottom:y+height},box))continue;
            const below=box.bottom+8,above=box.top-height-8;
            if(below+height<=parent.height-12)y=below;
            else if(above>=minY)y=above;
          }
          // A criatura nunca deve ficar escondida atrás da lista de comandos.
          const foeBox={left:foeX-34,right:foeX+34,top:foeY-62,bottom:foeY+34};
          if(overlaps({left:x,right:x+width,top:y,bottom:y+height},foeBox)){
            const above=foeBox.top-height-10,below=foeBox.bottom+10;
            if(above>=minY)y=above;
            else if(below+height<=parent.height-12)y=below;
          }
          if(mobileLandscape){
            const jump=document.querySelector<HTMLElement>('.touch-controls .battle-jump');
            if(jump){
              const rect=jump.getBoundingClientRect();
              const box={left:rect.left-parent.left-5,right:rect.right-parent.left+5,
                top:rect.top-parent.top-5,bottom:rect.bottom-parent.top+5};
              if(overlaps({left:x,right:x+width,top:y,bottom:y+height},box)){
                const beside=box.right+5;
                if(beside+width<=parent.width-12)x=beside;
                else if(box.top-height-8>=minY)y=box.top-height-8;
              }
            }
          }
          element.style.left=`${x}px`;
          element.style.right='auto';
          element.style.top=`${y}px`;
          element.style.visibility=Math.abs(projected.x)<1.3&&Math.abs(projected.y)<1.3?'visible':'hidden';
          }
        }
        if(attack.current&&attackLabel.current&&game.activeMonster){
          const ally=battle.ally,monster=game.activeMonster;
          const cooldown=Math.max(ally.attackTimer,ally.recovery);
          const duration=attackInterval(monster)+(ally.skillWindup?0.45:0);
          const ready=ally.windup>0?1:Math.max(0,Math.min(1,1-cooldown/duration));
          attack.current.style.setProperty('--attack-ready',`${ready*100}%`);
          attack.current.style.setProperty('--ring-progress',`${ready*100}%`);
          attack.current.classList.toggle('winding',ally.windup>0);
          attack.current.classList.toggle('recharging',cooldown>0&&ally.windup<=0);
          attackLabel.current.textContent=ally.windup>0?'Golpe':cooldown>0?`${cooldown.toFixed(1)}s`:
            battle.command==='attack'&&Math.hypot(ally.x-battle.foe.x,ally.z-battle.foe.z)>attackRadius(monster)+0.05?'Indo':'Pronto';
        }
        if(dodge.current&&dodgeLabel.current){
          const cooldown=battle.ally.dodgeCooldown;
          const total=dodgeCooldown(game.activeMonster!);
          dodge.current.disabled=cooldown>0;
          dodge.current.style.setProperty('--cooldown',`${Math.min(100,cooldown/total*100)}%`);
          dodge.current.style.setProperty('--ring-progress',`${Math.max(0,100-cooldown/total*100)}%`);
          dodgeLabel.current.textContent=cooldown>0?cooldown.toFixed(1)+'s':'';
        }
        if(special.current&&specialLabel.current){
          const charge=battle.ally.charge;
          special.current.disabled=charge<100;
          special.current.style.setProperty('--special-charge',`${Math.min(100,charge)}%`);
          special.current.style.setProperty('--ring-progress',`${Math.min(100,charge)}%`);
          special.current.classList.toggle('ready',charge>=100);
          specialLabel.current.textContent=charge>=100?'Pronto':`${Math.floor(charge)}%`;
        }
      }
      frame=requestAnimationFrame(update);
    };
    frame=requestAnimationFrame(update);
    return()=>cancelAnimationFrame(frame);
  },[game,cameraRef]);
  if(game.battleMenu==='items'){
    const bag=game.save?.battleBag??[];
    const inventory=game.save?.inventory??[];
    const selected=game.selectedBattleBagSlot;
    const selectedEntry=inventory.find(item=>item.uid===bag[selected]);
    const selectedItem=selectedEntry?ITEMS[selectedEntry.itemId]:null;
    return <div className="battle-command-cluster quick-bag-cluster" ref={cluster} role="group" aria-label="Mochila de batalha">
      <div className="quick-bag-heading"><span><img src="/art/ui/hero-satchel.png" alt=""/> MOCHILA</span><button type="button" onClick={()=>game.closeBattleMenu()} aria-label="Fechar mochila"><span className="keyboard-key">Q </span>✕</button></div>
      <div className="quick-bag-grid">{Array.from({length:BAG_CAPACITY},(_,slot)=>{
        const entry=inventory.find(item=>item.uid===bag[slot]);
        const item=entry?ITEMS[entry.itemId]:null;
        return <button key={slot} type="button" className={`quick-bag-slot ${slot===selected?'selected':''} ${item?'filled':''}`}
          style={item?{'--accent':item.color} as React.CSSProperties:undefined}
          {...press(()=>{game.selectBattleBagSlot(slot);if(entry)game.useBattleItem(entry.uid);})}
          title={item?.description} aria-label={`${slot+1}: ${item?.name??'vazio'}${item?', usar item':''}`}>
          <kbd>{slot+1}</kbd>{item?<img src={itemArt(item.id)} alt=""/>:<span className="quick-bag-empty">—</span>}
          <strong>{item?.name??'Vazio'}</strong>
        </button>;
      })}</div>
      <div className="quick-bag-detail" style={selectedItem?{'--accent':selectedItem.color} as React.CSSProperties:undefined}>
        <strong>{selectedItem?.name??'Espaço vazio'}</strong><span>{selectedItem?.description??'Coloque itens na mochila antes da batalha.'}</span>
      </div>
      <div className="quick-bag-actions"><span>1–6 / setas · Q fecha</span><button type="button" disabled={!selectedItem} onClick={()=>game.useSelectedBattleItem()}><span className="keyboard-key">Z </span>Usar</button></div>
    </div>;
  }
  if(game.battleMenu==='cards'){
    const battle=game.battle!;
    const foe=SPECIES[battle.enemy.species];
    const chance=game.captureChance();
    const selected=game.selectedBattleCard;
    const available=game.save?.cards[selected]??0;
    const valid=!battle.guardian&&selected===foe.element&&chance>0&&available>0;
    return <div className="battle-command-cluster quick-cards-cluster" ref={cluster} role="group" aria-label="Cartas de captura">
      <div className="quick-cards-heading"><span>✦ CARTAS</span><button type="button" onClick={()=>game.closeBattleMenu()} aria-label="Fechar cartas"><span className="keyboard-key">S </span>✕</button></div>
      <div className="quick-cards-list">{ELEMENTS.map((element,index)=>{
        const count=game.save?.cards[element]??0;
        return <button type="button" key={element} className={`quick-card-option ${selected===element?'selected':''}`}
          style={{'--accent':ELEMENT_COLOR[element]} as React.CSSProperties}
          {...press(()=>{game.selectBattleCard(element);if(element===foe.element&&count&&chance&&!battle.guardian)game.capture(element);})}
          aria-label={`${index+1}: carta de ${ELEMENT_LABEL[element]}, ${count} disponíveis${element===foe.element&&chance?`, ${chance}% de chance`:''}`}>
          <kbd>{index+1}</kbd><img src={`/art/cards/${element}.png`} alt=""/>
          <span><strong>{ELEMENT_LABEL[element]}</strong><small>{element===foe.element&&chance?`${chance}% de chance`:element===foe.element?'Alvo acima de 50%':'Outro elemento'}</small></span><b>×{count}</b>
        </button>;
      })}</div>
      <p className="quick-cards-hint">{battle.guardian?'Guardiões não podem ser capturados.':chance===0?`Reduza ${foe.name} a 50% de PV.`:`${foe.name} exige carta de ${ELEMENT_LABEL[foe.element]}.`}</p>
      <div className="quick-cards-actions"><span>1–3 / setas · S fecha</span><button type="button" disabled={!valid} onClick={()=>game.useSelectedBattleCard()}><span className="keyboard-key">Z </span>Usar</button></div>
    </div>;
  }
  const command=game.battle?.command;
  const bagCount=game.save?.battleBag.filter(Boolean).length??0;
  return <div className="battle-command-cluster battle-actions-cluster" ref={cluster} role="group" aria-label="Comandos do monstro">
    <div className="battle-command-title">COMANDOS <span>SETAS: MOVER</span></div>
    <button className="command-bag" {...press(()=>game.toggleBattleBag())} title="Abrir mochila de batalha · Q"
      aria-label={`Abrir mochila de batalha, ${bagCount} de ${BAG_CAPACITY} itens`}>
      <kbd>Q</kbd><img className="command-bag-icon" src="/art/ui/hero-satchel.png" alt=""/>
      <strong>Mochila</strong><small>{bagCount}/{BAG_CAPACITY}</small>
    </button>
    <button ref={attack} className={`command-attack ${command==='attack'?'selected':''}`} {...press(()=>game.battleCommand('attack'))} title="Dar um golpe comum e voltar · Z" aria-label="Atacar">
      <kbd>Z</kbd><span className="command-icon">⚔</span><strong>Atacar</strong><small ref={attackLabel} className="command-cooldown">Pronto</small>
    </button>
    <button ref={special} className={`command-special ${command==='special'?'selected':''}`} {...press(()=>game.battleCommand('special'))}
      title={`${SPECIES[game.activeMonster!.species].skill.name} · C`} aria-label={`Especial: ${SPECIES[game.activeMonster!.species].skill.name}`}>
      <kbd>C</kbd><span className="command-icon">✦</span><strong>{SPECIES[game.activeMonster!.species].skill.name}</strong><small ref={specialLabel} className="command-cooldown">0%</small>
    </button>
    <button ref={dodge} className="command-dodge" {...press(()=>game.battleCommand('dodge'))} title="Sair da área do golpe · X" aria-label="Esquivar">
      <kbd>X</kbd><span className="command-icon">◇</span><strong>Esquivar</strong><small ref={dodgeLabel} className="command-cooldown"/>
    </button>
    <button className={command==='follow'?'command-return':'command-follow'}
      {...press(()=>game.battleCommand(game.battle?.command==='follow'?'return':'follow'))}
      title={command==='follow'?'Voltar para perto do herói · A':'Perseguir e atacar continuamente · A'}
      aria-label={command==='follow'?'Voltar':'Perseguir'}>
      <kbd>A</kbd><span className="command-icon">{command==='follow'?'↶':'➤'}</span><strong>{command==='follow'?'Voltar':'Perseguir'}</strong>
    </button>
    <button className="command-cards" {...press(()=>game.openBattleMenu('cards'))} title="Abrir cartas de captura · S" aria-label="Abrir cartas de captura">
      <kbd>S</kbd><span className="command-icon">✦</span><strong>Cartas</strong><small>{game.save?.cards[SPECIES[game.battle!.enemy.species].element]??0}</small>
    </button>
  </div>;
}
