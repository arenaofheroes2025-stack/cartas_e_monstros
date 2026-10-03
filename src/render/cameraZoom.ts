import { BATTLE_RECALL_END_SECONDS, BATTLE_ZOOM_OUT_END_SECONDS, CAPTURE_RECALL_END_SECONDS, CAPTURE_ZOOM_OUT_END_SECONDS } from '../game/game';

/** Desired pixels per world unit at the player's elevation. */
export function cameraZoom(width:number,height:number,inBattle:boolean):number {
  const portrait=height>width;
  if(width>=1000)return inBattle?110:102;
  if(portrait)return inBattle?93:83;
  if(height<=500)return inBattle?83:73;
  return inBattle?89:77;
}

/** Give phone-sized viewports a little more room without changing desktop framing. */
export function cameraProfileZoomScale(width:number,zoomScale:number):number {
  return width<1000?Math.max(0.1,zoomScale-0.2):zoomScale;
}

/** Match the old framing at the focus plane while allowing real depth perspective. */
export function perspectiveFovForZoom(height:number,pixelsPerUnit:number,distance:number):number {
  return 2*Math.atan(height/(2*pixelsPerUnit*distance))*180/Math.PI;
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
