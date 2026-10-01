import { useEffect, useRef, type RefObject } from 'react';
import { type Camera, Vector3 } from 'three';
import { Game } from '../game/game';
import { itemArt } from '../game/items';
import './battleCommandCallout.css';

const projected=new Vector3();
function overlaps(a:{left:number;right:number;top:number;bottom:number},b:{left:number;right:number;top:number;bottom:number}):boolean {
  return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
}

export function BattleCommandCallout({game,cameraRef}:{game:Game;cameraRef:RefObject<Camera|null>}) {
  const bubble=useRef<HTMLDivElement>(null);
  const cue=game.battle?.cue;
  useEffect(()=>{
    if(!cue)return;
    let frame=0;
    const update=()=>{
      const element=bubble.current,camera=cameraRef.current,battle=game.battle;
      if(element&&camera&&battle&&battle.cue?.sequence===cue.sequence){
        const parent=element.parentElement?.getBoundingClientRect();
        if(parent){
          const player=game.player;
          projected.set(player.x,game.getGroundHeight(player.x,player.z)+2.16+game.playerVisualLift,player.z).project(camera);
          const visible=game.mode==='battle'&&!game.battleMenu&&projected.z>=-1&&projected.z<=1&&
            Math.abs(projected.x)<1.15&&Math.abs(projected.y)<1.15;
          element.style.visibility=visible?'visible':'hidden';
          if(visible){
            const x=(projected.x+1)*parent.width*0.5;
            const y=(1-projected.y)*parent.height*0.5-8;
            const width=element.offsetWidth,height=element.offsetHeight,half=width*0.5;
            let left=Math.max(8,Math.min(parent.width-width-8,x-half));
            let bottom=Math.max(height+9,Math.min(parent.height-32,y));
            const obstructions=['.combatant.enemy','.flee-button','.battle-command-cluster','.battle-bottom']
              .map(selector=>element.parentElement?.querySelector<HTMLElement>(selector))
              .filter((item):item is HTMLElement=>!!item)
              .map(item=>{const rect=item.getBoundingClientRect();return {
                left:rect.left-parent.left-6,right:rect.right-parent.left+6,
                top:rect.top-parent.top-6,bottom:rect.bottom-parent.top+6
              };});
            const box=(at:number,base:number)=>({left:at,right:at+width,top:base-height,bottom:base});
            if(obstructions.some(obstruction=>overlaps(box(left,bottom),obstruction))){
              const candidates=obstructions.flatMap(obstruction=>[obstruction.left-width-8,obstruction.right+8])
                .filter(candidate=>candidate>=8&&candidate+width<=parent.width-8&&
                  obstructions.every(obstruction=>!overlaps(box(candidate,bottom),obstruction)))
                .sort((a,b)=>Math.abs(a-left)-Math.abs(b-left));
              if(candidates.length)left=candidates[0];
              else {
                const obstruction=obstructions.find(item=>overlaps(box(left,bottom),item));
                if(obstruction)bottom=Math.min(parent.height-8,obstruction.bottom+height+8);
              }
            }
            element.style.left=`${left+half}px`;
            element.style.top=`${bottom}px`;
          }
        }
      }
      frame=requestAnimationFrame(update);
    };
    frame=requestAnimationFrame(update);
    return()=>cancelAnimationFrame(frame);
  },[game,cameraRef,cue?.sequence]);
  if(!cue||game.battle?.intro!==0)return null;
  return <div ref={bubble} key={cue.sequence} className="battle-command-callout" role="status"
    style={{'--cue-color':cue.color} as React.CSSProperties} aria-label={`Herói ordenou: ${cue.label}`}>
    <span className="battle-command-callout-icon" aria-hidden="true">
      {cue.itemId?<img src={itemArt(cue.itemId)} alt=""/>:cue.icon}
    </span>
    <strong>{cue.label}</strong>
  </div>;
}
