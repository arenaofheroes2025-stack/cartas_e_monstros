import type { Point } from '../game/world';

// The fixed camera looks from (+x,+z), so screen right points toward (+x,-z).
export function facingForDirection(dx: number, dz: number, fallback: 1 | -1 = 1): 1 | -1 {
  const horizontal=dx-dz;
  if (Math.abs(horizontal)>0.001) return horizontal>0?1:-1;
  const depth=dx+dz;
  if (Math.abs(depth)>0.001) return depth>0?1:-1;
  return fallback;
}

export function facingToward(from: Point, to: Point, fallback: 1 | -1 = 1): 1 | -1 {
  return facingForDirection(to.x-from.x,to.z-from.z,fallback);
}
