import { useEffect, useRef, type RefObject } from 'react';
import type { Camera } from 'three';
import { Game } from '../game/game';
import { ELEMENT_COLOR, ELEMENT_LABEL, maxHp, SPECIES } from '../game/content';
import { enemyAttackInterval } from '../game/battle/rules';
import { monsterPortrait } from '../render/art';
import { ITEMS, type TimedStatus } from '../game/items';
import { BattleCommands } from './BattleCommands';
import { BattleCommandCallout } from './BattleCommandCallout';
import './combatReadability.css';

function Meter({value,max,color}:{value:number;max:number;color:string}) {
  return <div className="meter"><div style={{width:Math.max(0,Math.min(100,value/max*100))+'%',background:color}}/></div>;
}

function EnemyAttackMeter({game}:{game:Game}) {
  const label=useRef<HTMLSpanElement>(null);
  const fill=useRef<HTMLElement>(null);
  const special=useRef<HTMLElement>(null);
  useEffect(()=>{
    let frame=0;
    const update=()=>{
      const battle=game.battle;
      if(battle&&label.current&&fill.current&&special.current){
        const foe=battle.foe;
        const progress=foe.windup>0?1:Math.max(0,Math.min(1,1-foe.attackTimer/enemyAttackInterval(battle.enemy,game.statusBonus(battle.enemy.uid,'speed'))));
        fill.current.style.width=`${progress*100}%`;
        fill.current.classList.toggle('winding',foe.windup>0);
        fill.current.classList.toggle('recovering',foe.recovery>0&&foe.windup<=0);
        label.current.textContent=foe.windup>0?(foe.skillWindup?'⚠ Habilidade sendo preparada':'⚠ Golpe sendo preparado'):
          foe.recovery>0?`Contra-ataque · ${foe.recovery.toFixed(1)}s`:
          foe.attackTimer>0?`Próximo ataque em ${foe.attackTimer.toFixed(1)}s`:'Ataque pronto';
        special.current.textContent=`Especial ${Math.floor(foe.charge)}%`;
      }
      frame=requestAnimationFrame(update);
    };
    update();return()=>cancelAnimationFrame(frame);
  },[game]);
  return <section className="enemy-attack-meter" aria-label="Preparação do ataque inimigo">
    <span ref={label}>Próximo ataque</span><span className="enemy-attack-track"><i ref={fill}/></span><small ref={special}>Especial 0%</small>
  </section>;
}

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

export function BattleHud({game,cameraRef}:{game:Game;cameraRef:RefObject<Camera|null>}) {
  const battle=game.battle,save=game.save,ally=game.activeMonster;
  if(!battle||!save||!ally)return null;
  const friend=SPECIES[ally.species],foe=SPECIES[battle.enemy.species];
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
    {game.battleMenu==='items'||game.battleMenu==='cards'?<button type="button" className="quick-bag-backdrop" onClick={()=>game.closeBattleMenu()} aria-label="Fechar seleção e voltar à batalha"/>:null}
    <BattleCommands game={game} cameraRef={cameraRef}/>
    {game.battleMenu!=='items'&&game.battleMenu!=='cards'?<BattleCommandCallout game={game} cameraRef={cameraRef}/>:null}
    <div className="battle-top">
      <div className="combatant enemy"><img src={monsterPortrait(foe.id)} alt=""/><div><small>{battle.guardian?'GUARDIÃO':'SELVAGEM'} · {ELEMENT_LABEL[foe.element]}</small><strong>{foe.name} <span>Nv. {battle.enemy.level}</span></strong><Meter value={battle.foe.hp} max={maxHp(battle.enemy)} color={ELEMENT_COLOR[foe.element]}/><small>{Math.ceil(battle.foe.hp)} / {maxHp(battle.enemy)} PV</small><EnemyAttackMeter game={game}/><StatusPills statuses={battle.statuses.filter(status=>status.targetUid===battle.enemy.uid)}/></div></div>
      <div className="battle-caption"><span>ARENA</span><strong>{battle.messageTime>0?battle.message:'Comande seu monstro e mova-se pela arena.'}</strong></div>
      <button className="flee-button" onClick={()=>game.flee()}>Sair da arena</button>
    </div>
    <div className="battle-bottom">
      <div className="combatant ally"><img src={monsterPortrait(friend.id)} alt=""/><div><small>SEU MONSTRO · {ELEMENT_LABEL[friend.element]}</small><strong>{friend.name} <span>Nv. {ally.level}</span></strong><Meter value={battle.ally.hp} max={maxHp(ally)} color="#9ad9aa"/><small>{Math.ceil(battle.ally.hp)} / {maxHp(ally)} PV · Habilidade {Math.floor(battle.ally.charge)}%</small><StatusPills statuses={battle.statuses.filter(status=>status.targetUid===ally.uid)}/></div></div>
      <div className="battle-utility">
        <button onClick={()=>game.toggleBattleBag()} aria-label={game.battleMenu==='items'?'Fechar mochila':'Abrir mochila'}><img src="/art/ui/hero-satchel.png" alt=""/><span>Mochila<small>{save.battleBag.filter(Boolean).length}/6 · Q</small></span></button>
        <button onClick={()=>game.openBattleMenu('party')} aria-label="Abrir equipe"><img src={monsterPortrait(ally.species)} alt=""/><span>Equipe<small>{save.party.length} monstros</small></span></button>
      </div>
    </div>
    <div className="battle-tip">Clique no chão para posicionar · Espaço pula · Z/X/C/V comandam · Q mochila · B cartas</div>
  </div>;
}
