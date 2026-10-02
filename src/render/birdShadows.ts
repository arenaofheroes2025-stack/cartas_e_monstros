import * as THREE from 'three';
import { HEIGHT_STEP, tileAt, type WorldData } from '../game/world';
import { SHADOW_SLOPE } from './sun';

const SURFACE = 0.1;
const SHADOW_LIFT = 0.028;

export interface BirdShadowPoint { x: number; y: number; z: number; height: number }

export function birdTerrainSurface(world: WorldData, x: number, z: number): number {
  const tile=tileAt(world,Math.floor(x),Math.floor(z));
  return SURFACE+(tile?.height??0)*HEIGHT_STEP;
}

export function birdShadowPoint(world: WorldData, x: number, y: number, z: number): BirdShadowPoint {
  let shadowX=x,shadowZ=z;
  for(let i=0;i<3;i++){
    const height=Math.max(0,y-birdTerrainSurface(world,shadowX,shadowZ));
    shadowX=x+SHADOW_SLOPE.x*height;
    shadowZ=z+SHADOW_SLOPE.z*height;
  }
  const surface=birdTerrainSurface(world,shadowX,shadowZ);
  return {x:shadowX,y:surface+SHADOW_LIFT,z:shadowZ,height:Math.max(0,y-surface)};
}

// Keep the disc on tile tops when its edge crosses a change in elevation.
export function writeBirdShadowSurface(geometry: THREE.BufferGeometry,world: WorldData,
  shadow: BirdShadowPoint,radiusX: number,radiusZ: number): void {
  const positions=geometry.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<positions.count;i++){
    const x=shadow.x+positions.getX(i)*radiusX;
    const z=shadow.z+positions.getZ(i)*radiusZ;
    positions.setY(i,birdTerrainSurface(world,x,z)+SHADOW_LIFT-shadow.y);
  }
  positions.needsUpdate=true;
}
