import { useEffect, useRef, type RefObject } from 'react';
import type { Camera } from 'three';
import { Game } from '../game/game';
import { ELEMENT_LABEL, maxHp, SPECIES } from '../game/content';
import { monsterPortrait } from '../render/art';
import { ITEMS, type TimedStatus } from '../game/items';
import { BattleCommands } from './BattleCommands';
import { BattleCommandCallout } from './BattleCommandCallout';
import { BattleActorBars } from './BattleActorBars';
import './combatReadability.css';

function StatusPills({statuses}:{statuses:TimedStatus[]}) {
  const refs=useRef<Record<string,HTMLElement|null>>({});
  useEffect(()=>{
    let frame=0;let last=0;
    const update=(time:number)=>{
      if(time-last>90){for(const status of statuses){const target=refs.current[status.itemId];if(target)target.textContent=`${Math.ceil(status.remaining)}s`;}last=time;}
      frame=requestAnimationFrame(update);
    };
    frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);
  },[statuses]);
  return statuses.length?<div className="battle-statuses" aria-label="Efeitos temporários">{statuses.map(status=><span key={`${status.targetUid}-${status.stat}`} className="battle-status" style={{'--status-color':ITEMS[status.itemId].color} as React.CSSProperties} title={ITEMS[status.itemId].description}>
    <img src={`/art/items/${status.itemId}.png`} alt=""/>{status.amount>0?'+':''}{status.amount} {status.stat==='attack'?'ATQ':status.stat==='defense'?'DEF':'VEL'} <b ref={element=>{refs.current[status.itemId]=element;}}>{Math.ceil(status.remaining)}s</b>
  </span>)}</div>:null;
}

export function BattleHud({game,cameraRef,onAllyDetails,onEnemyDetails}:{game:Game;cameraRef:RefObject<Camera|null>;onAllyDetails:(uid:string)=>void;onEnemyDetails:()=>void}) {
  const lastTouchAction=useRef(0);
  const menuOpenedAt=useRef(0);
  const previousMenu=useRef(game.battleMenu);
  if(game.battleMenu!==previousMenu.current){
    if(game.battleMenu==='items'||game.battleMenu==='cards')menuOpenedAt.current=Date.now();
    previousMenu.current=game.battleMenu;
  }
  const press=(action:()=>void)=>({
    onPointerDown:(event:React.PointerEvent)=>{if(event.pointerType==='touch'){lastTouchAction.current=Date.now();action();}},
    onClick:(event:React.MouseEvent)=>{if((event.nativeEvent as PointerEvent).pointerType==='touch'||Date.now()-lastTouchAction.current<2000)return;action();}
  });
  const battle=game.battle,save=game.save,ally=game.activeMonster;
  if(!battle||!save||!ally)return null;
  const friend=SPECIES[ally.species],foe=SPECIES[battle.enemy.species];
  if(battle.defeat)return <div className="battle-ui battle-finish-ui" aria-live="polite">
    <div className="battle-finish-label"><span>DERROTA</span><strong>Sua equipe desmaiou</strong><small>A guardiã está a caminho.</small></div>
  </div>;
  if(battle.finisher)return <div className="battle-ui battle-finish-ui" aria-live="polite">
    <div className="battle-finish-label"><span>VITÓRIA</span><strong>{foe.name} foi derrotado</strong><small>+{battle.finisher.xp} XP para {friend.name}</small></div>
  </div>;
  if(battle.captureSequence)return <div className="battle-ui battle-finish-ui" aria-live="polite">
    <div className="battle-finish-label"><span>{battle.captureSequence.success&&battle.captureSequence.announced?'CAPTURA':'CARTA LANÇADA'}</span>
      <strong>{battle.captureSequence.success&&battle.captureSequence.announced?`${foe.name} capturado!`:`A carta envolve ${foe.name}...`}</strong>
      <small>{battle.captureSequence.success&&battle.captureSequence.announced?`Parabéns! ${foe.name} entrou na ${battle.captureSequence.destination}.`:'Aguarde o resultado da captura.'}</small>
    </div>
  </div>;
  return <div className="battle-ui">
    {game.battleMenu==='items'||game.battleMenu==='cards'?<button type="button" className="quick-bag-backdrop"
      onClick={()=>{if(Date.now()-menuOpenedAt.current>500)game.closeBattleMenu();}}
      aria-label="Fechar seleção e voltar à batalha"/>:null}
    <BattleActorBars game={game} cameraRef={cameraRef} onAllyDetails={onAllyDetails}/>
    <BattleCommands game={game} cameraRef={cameraRef}/>
    {game.battleMenu!=='items'&&game.battleMenu!=='cards'?<BattleCommandCallout game={game} cameraRef={cameraRef}/>:null}
    <div className="battle-top">
      <button type="button" className="combatant enemy" {...press(onEnemyDetails)} aria-label={`Ver atributos de ${foe.name}, inimigo`}><img src={monsterPortrait(foe.id)} alt=""/><div><small>{battle.guardian?'GUARDIÃO':'SELVAGEM'} · {ELEMENT_LABEL[foe.element]}</small><strong>{foe.name} <span>Nv. {battle.enemy.level}</span></strong><small className="combatant-details">{Math.ceil(battle.foe.hp)} / {maxHp(battle.enemy)} PV · Especial {Math.floor(battle.foe.charge)}%</small><StatusPills statuses={battle.statuses.filter(status=>status.targetUid===battle.enemy.uid)}/></div></button>
      <button className="flee-button" onClick={()=>game.flee()}>Sair da arena</button>
    </div>
    <div className="battle-bottom battle-tools-only">
      {battle.statuses.some(status=>status.targetUid===ally.uid)?<div className="battle-ally-statuses"><StatusPills statuses={battle.statuses.filter(status=>status.targetUid===ally.uid)}/></div>:null}
      <div className="battle-utility">
        <button {...press(()=>game.openBattleMenu('party'))} aria-label="Abrir equipe"><img src={monsterPortrait(ally.species)} alt=""/><span>Equipe<small>{save.party.length} monstros</small></span></button>
      </div>
    </div>
  </div>;
}
