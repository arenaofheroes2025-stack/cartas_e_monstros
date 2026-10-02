/** Offset the camera focus toward the player's actual movement on the map. */
export function cameraLookAhead(vx:number,vz:number,width:number,height:number):{x:number;z:number} {
  const speed=Math.hypot(vx,vz);
  if(speed<=0.35)return {x:0,z:0};
  const progress=Math.min(1,(speed-0.35)/2.85);
  const strength=progress*progress*(3-2*progress);
  const reach=width<1000?(height>width?1.05:1.35):1.8;
  return {x:vx/speed*reach*strength,z:vz/speed*reach*strength};
}

/** Ease into and out of the look-ahead at the same deliberately gentle pace. */
export function smoothCameraLookAhead(
  current:{x:number;z:number},desired:{x:number;z:number},delta:number
):{x:number;z:number} {
  // A long frame must not cause a visible jump in the camera's focus.
  const blend=1-Math.exp(-1.6*Math.min(Math.max(delta,0),0.1));
  return {
    x:current.x+(desired.x-current.x)*blend,
    z:current.z+(desired.z-current.z)*blend,
  };
}
