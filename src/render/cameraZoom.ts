import { BATTLE_RECALL_END_SECONDS, BATTLE_ZOOM_OUT_END_SECONDS, CAPTURE_RECALL_END_SECONDS, CAPTURE_ZOOM_OUT_END_SECONDS } from '../game/game';

/** Orthographic pixels per world unit for each playable viewport. */
export function cameraZoom(width:number,height:number,inBattle:boolean):number {
  const portrait=height>width;
  if(width>=1000)return inBattle?82:60;
  if(portrait)return inBattle?78:60;
  if(height<=500)return inBattle?60:48;
  return inBattle?76:56;
}

/** Hold the close framing until the ally's card reaches the hero, then ease out. */
export function victoryCameraZoom(width:number,height:number,elapsed:number):number {
  const battle=cameraZoom(width,height,true);
  const explore=cameraZoom(width,height,false);
  const ease=(start:number,end:number)=>{
    const t=Math.max(0,Math.min(1,(elapsed-start)/(end-start)));
    return t*t*(3-2*t);
  };
  const close=battle*(1+0.2*ease(0,0.45));
  return close+(explore-close)*ease(BATTLE_RECALL_END_SECONDS,BATTLE_ZOOM_OUT_END_SECONDS);
}

/** Keep the captured creature in focus, then return to exploration after the ally is recalled. */
export function captureCameraZoom(width:number,height:number,elapsed:number):number {
  const battle=cameraZoom(width,height,true);
  const explore=cameraZoom(width,height,false);
  const ease=(start:number,end:number)=>{
    const t=Math.max(0,Math.min(1,(elapsed-start)/(end-start)));
    return t*t*(3-2*t);
  };
  const close=battle*(1+0.16*ease(0.55,1.05));
  return close+(explore-close)*ease(CAPTURE_RECALL_END_SECONDS,CAPTURE_ZOOM_OUT_END_SECONDS);
}
