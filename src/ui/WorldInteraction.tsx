import { useEffect, useRef, useState, type RefObject } from 'react';
import { type Camera, Vector3 } from 'three';
import { Game, type InteractionTarget } from '../game/game';
import { DIALOG_CHOICE_KEYS } from '../input/dialogChoices';
import { SPRITE_UP } from '../render/camera';
import './worldInteraction.css';

const projected=new Vector3();
const spriteAnchor=new Vector3();

function placeAt(
  element:HTMLElement,camera:Camera,rect:DOMRect,x:number,y:number,z:number,
  offsetX:number,offsetY:number,centered:boolean
):void {
  projected.set(x,y,z).project(camera);
  const visible=projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<1.4&&Math.abs(projected.y)<1.4;
  element.style.visibility=visible?'visible':'hidden';
  if(!visible)return;
  const screenX=(projected.x+1)*0.5*rect.width+offsetX;
  const screenY=(1-projected.y)*0.5*rect.height+offsetY;
  const halfWidth=centered?element.offsetWidth*0.5:0;
  element.style.left=`${Math.max(halfWidth+10,Math.min(rect.width-halfWidth-10,screenX))}px`;
  const minY=centered?element.offsetHeight+12:50;
  element.style.top=`${Math.max(minY,Math.min(rect.height-15,screenY))}px`;
}

export function WorldInteraction({game,cameraRef}:{game:Game;cameraRef:RefObject<Camera|null>}) {
  const layer=useRef<HTMLDivElement>(null);
  const action=useRef<HTMLButtonElement>(null);
  const speech=useRef<HTMLDivElement>(null);
  const lastTouchAction=useRef(0);
  const [nearby,setNearby]=useState<InteractionTarget|null>(null);
  const press=(action:()=>void)=>({
    onPointerDown:(event:React.PointerEvent)=>{if(event.pointerType==='touch'){lastTouchAction.current=Date.now();action();}},
    onClick:(event:React.MouseEvent)=>{if((event.nativeEvent as PointerEvent).pointerType==='touch'||Date.now()-lastTouchAction.current<2000)return;action();}
  });

  useEffect(()=>{
    let frame=0;
    let shown='';
    let lastCheck=-Infinity;
    const update=(time:number)=>{
      if(time-lastCheck>90){
        lastCheck=time;
        const target=game.nearbyInteraction();
        const key=target?`${target.kind}:${target.id}`:'';
        if(key!==shown){shown=key;setNearby(target);}
      }
      const camera=cameraRef.current;
      const rect=layer.current?.getBoundingClientRect();
      if(camera&&rect){
        if(action.current){
          const player=game.player;
          spriteAnchor.set(player.x,game.getGroundHeight(player.x,player.z)+0.1+game.playerVisualLift,player.z)
            .addScaledVector(SPRITE_UP,1.42);
          placeAt(action.current,camera,rect,spriteAnchor.x,spriteAnchor.y,
            spriteAnchor.z,36,-20,false);
        }
        if(speech.current&&game.dialog){
          const {x,z}=game.dialog.anchor;
          spriteAnchor.set(x,game.getGroundHeight(x,z)+0.1,z)
            .addScaledVector(SPRITE_UP,2.2);
          placeAt(speech.current,camera,rect,spriteAnchor.x,spriteAnchor.y,
            spriteAnchor.z,0,-12,true);
          if(action.current){
            const buttonBox=action.current.getBoundingClientRect();
            const speechBox=speech.current.getBoundingClientRect();
            if(buttonBox.left<speechBox.right&&buttonBox.right>speechBox.left&&
               buttonBox.top<speechBox.bottom&&buttonBox.bottom>speechBox.top){
              action.current.style.top=`${Math.min(rect.height-buttonBox.height/2-10,
                speechBox.bottom-rect.top+buttonBox.height/2+12)}px`;
            }
          }
        }
      }
      frame=requestAnimationFrame(update);
    };
    frame=requestAnimationFrame(update);
    return()=>cancelAnimationFrame(frame);
  },[game,cameraRef]);

  if(game.mode!=='explore'&&game.mode!=='dialog')return null;
  const talking=game.mode==='dialog'&&!!game.dialog;
  const simpleDialog=talking&&(game.dialog?.actions.length??0)<=1;
  const canAct=!!(simpleDialog||(game.mode==='explore'&&nearby));
  const performAction=()=>simpleDialog&&game.dialog?.actions.length===1?game.chooseDialogAction(0):game.interact();
  return <div className="world-interaction-layer" ref={layer}>
    {canAct?<button ref={action} className="world-action"
      {...press(performAction)}
      aria-label={simpleDialog?'Terminar fala':`${nearby?.verb}: ${nearby?.name}`}>
      <kbd>Z</kbd><span><strong>{talking?'Terminar fala':nearby?.verb}</strong>
        {!talking?<small>{nearby?.name}</small>:null}</span>
    </button>:null}
    {(canAct||(talking&&game.dialog?.actions.length))?<div className={`world-touch-actions ${talking?'dialog':''}`} role="group" aria-label="Ações disponíveis">
      {canAct?<button type="button" {...press(performAction)}><span className="world-touch-symbol">✦</span><span>{talking?'Terminar fala':nearby?.verb}<small>{talking?'Continuar':nearby?.name}</small></span></button>:null}
      {talking&&(game.dialog?.actions.length??0)>1?game.dialog!.actions.map((option,index)=><button type="button" key={`${option.label}-${index}`}
        {...press(()=>game.chooseDialogAction(index))}><span className="world-touch-symbol">{index+1}</span><span>{option.label}</span></button>):null}
    </div>:null}
    {talking&&game.dialog?<div ref={speech} className="world-speech" role="dialog" aria-label={game.dialog.title}>
      <strong className="world-speech-name">{game.dialog.title}</strong>
      <p>{game.dialog.text}</p>
      {game.dialog.actions.length>1?<div className="world-speech-actions">{game.dialog.actions.map((option,index)=><button
        key={`${option.label}-${index}`} {...press(()=>game.chooseDialogAction(index))}>
        <kbd>{DIALOG_CHOICE_KEYS[index]?.toUpperCase()??index+1}</kbd><span>{option.label}</span>
      </button>)}</div>:null}
    </div>:null}
  </div>;
}
