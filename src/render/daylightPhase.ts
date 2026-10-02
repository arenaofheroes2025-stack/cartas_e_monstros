import * as THREE from 'three';

export function daylightPhase(hour:number):{daylight:number;morning:number;warmth:number} {
  const dawn=THREE.MathUtils.smoothstep(hour,6,8.5);
  const dusk=1-THREE.MathUtils.smoothstep(hour,17,18.5);
  const daylight=dawn*dusk;
  const morning=THREE.MathUtils.smoothstep(hour,6,7)*
    (1-THREE.MathUtils.smoothstep(hour,7.5,10.5))*daylight;
  const evening=THREE.MathUtils.smoothstep(hour,14,16)*
    (1-THREE.MathUtils.smoothstep(hour,17.5,18.5))*daylight;
  return {daylight,morning,warmth:evening};
}

export function townLightPhase(hour:number):number {
  return Math.max(
    1-THREE.MathUtils.smoothstep(hour,6,7.5),
    THREE.MathUtils.smoothstep(hour,17.5,18.5)
  );
}
