/** NippleJS uses an upward-positive Y axis; game controls use downward-positive Y. */
export function joystickMovement(vector:{x:number;y:number}|undefined):{x:number;y:number} {
  if(!vector)return {x:0,y:0};
  const x=Number.isFinite(vector.x)?vector.x:0;
  const y=Number.isFinite(vector.y)&&vector.y!==0?-vector.y:0;
  const length=Math.hypot(x,y);
  if(length<0.12)return {x:0,y:0};
  const scale=1/Math.max(1,length);
  return {x:x*scale,y:y*scale};
}
