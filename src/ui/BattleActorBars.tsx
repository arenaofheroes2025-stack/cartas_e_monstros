import { useEffect, useRef, type RefObject } from 'react';
import { type Camera, Vector3 } from 'three';
import { Game } from '../game/game';
import { maxHp, SPECIES } from '../game/content';
import { attackInterval, enemyAttackInterval } from '../game/battle/rules';
import './battleActorBars.css';

const projected=new Vector3();

function ActorBars({game,cameraRef,side,onDetails}:{game:Game;cameraRef:RefObject<Camera|null>;side:'ally'|'foe';onDetails?:()=>void}) {
  const root=useRef<HTMLDivElement>(null);
  const lastTouch=useRef(0);
  const health=useRef<HTMLSpanElement>(null);
  const attack=useRef<HTMLSpanElement>(null);
  const special=useRef<HTMLSpanElement>(null);
  const warning=useRef<HTMLElement>(null);
  useEffect(()=>{
    let frame=0;
    const update=()=>{
      const battle=game.battle,camera=cameraRef.current,element=root.current;
      if(battle&&camera&&element&&health.current&&attack.current&&special.current&&warning.current){
        const actor=side==='foe'?battle.foe:battle.ally;
        const monster=side==='foe'?battle.enemy:game.activeMonster;
        const bounds=element.parentElement?.getBoundingClientRect();
        if(monster&&bounds){
          const evolved=SPECIES[monster.species].evolved;
          projected.set(actor.x,game.getGroundHeight(actor.x,actor.z)+(evolved?1.55:1.25),actor.z).project(camera);
          const x=(projected.x+1)*bounds.width*0.5;
          const y=(1-projected.y)*bounds.height*0.5;
          element.style.left=`${x}px`;
          element.style.top=`${y}px`;
          element.style.visibility=projected.z<1&&Math.abs(projected.x)<1.05&&Math.abs(projected.y)<1.05?'visible':'hidden';
          health.current.style.width=`${Math.max(0,Math.min(100,actor.hp/maxHp(monster)*100))}%`;
          const interval=side==='foe'?enemyAttackInterval(monster,game.statusBonus(monster.uid,'speed')):
            attackInterval(monster,game.statusBonus(monster.uid,'speed'));
          const progress=actor.windup>0?1:Math.max(0,Math.min(1,1-Math.max(actor.attackTimer,actor.recovery)/interval));
          attack.current.style.width=`${progress*100}%`;
          special.current.style.width=`${Math.max(0,Math.min(100,actor.charge))}%`;
          element.classList.toggle('winding',actor.windup>0);
          element.classList.toggle('recovering',actor.recovery>0&&actor.windup<=0);
          element.classList.toggle('special-ready',actor.charge>=100);
          element.classList.toggle('special-windup',actor.windup>0&&actor.skillWindup);
          const notice=actor.windup>0&&actor.skillWindup?SPECIES[monster.species].skill.name:'';
          if(warning.current.textContent!==notice)warning.current.textContent=notice;
          const label=`${side==='foe'?'Inimigo':'Aliado'}: ${Math.ceil(actor.hp)} de ${maxHp(monster)} PV; golpe comum ${Math.round(progress*100)}%; especial ${Math.floor(actor.charge)}%`;
          if(element.getAttribute('aria-label')!==label)element.setAttribute('aria-label',label);
        }
      }
      frame=requestAnimationFrame(update);
    };
    frame=requestAnimationFrame(update);
    return()=>cancelAnimationFrame(frame);
  },[game,cameraRef,side]);
  return <div ref={root} className={`battle-actor-bars ${side}`} role={side==='ally'?'group':'img'} aria-label={side==='foe'?'Vida e golpes do inimigo':'Vida e golpes do aliado'}>
    <strong ref={warning} className="actor-special-warning"/>
    <span className="actor-meter health"><span ref={health}/></span>
    <span className="actor-meter attack"><span ref={attack}/></span>
    <span className="actor-meter special"><span ref={special}/></span>
    {side==='ally'&&onDetails?<button type="button" className="actor-details-trigger" aria-label="Ver ficha da sua criatura" title="Ver ficha da criatura"
      onPointerDown={event=>{if(event.pointerType==='touch'){lastTouch.current=Date.now();onDetails();}}}
      onClick={event=>{if((event.nativeEvent as PointerEvent).pointerType==='touch'||Date.now()-lastTouch.current<2000)return;onDetails();}}>i</button>:null}
  </div>;
}

export function BattleActorBars({game,cameraRef,onAllyDetails}:{game:Game;cameraRef:RefObject<Camera|null>;onAllyDetails:(uid:string)=>void}) {
  return <><ActorBars game={game} cameraRef={cameraRef} side="foe"/><ActorBars game={game} cameraRef={cameraRef} side="ally" onDetails={()=>{const uid=game.activeMonster?.uid;if(uid)onAllyDetails(uid);}}/></>;
}
