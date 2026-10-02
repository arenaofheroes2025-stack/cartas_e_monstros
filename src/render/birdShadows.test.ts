import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { generateWorld, tileAt } from '../game/world';
import { birdShadowPoint, birdTerrainSurface, writeBirdShadowSurface } from './birdShadows';

describe('sombra dos pássaros',()=>{
  it('cai na altura da superfície atingida, mesmo após atravessar um desnível',()=>{
    const world=generateWorld(40732);
    const tile=world.tiles.find(tile=>tile.height>=2&&tileAt(world,tile.x+1,tile.z)?.height!==tile.height)!;
    const x=tile.x+0.8,z=tile.z+0.5,y=birdTerrainSurface(world,x,z)+3;
    const cast=birdShadowPoint(world,x,y,z);
    expect(cast.x).toBeGreaterThan(x);
    expect(cast.z).toBeGreaterThan(z);
    expect(cast.y).toBeCloseTo(birdTerrainSurface(world,cast.x,cast.z)+0.028,5);
    expect(cast.height).toBeCloseTo(y-birdTerrainSurface(world,cast.x,cast.z),5);
  });

  it('acompanha os blocos sob toda a área da sombra',()=>{
    const world=generateWorld(40732);
    const tile=world.tiles.find(tile=>tileAt(world,tile.x+1,tile.z)?.height!==tile.height)!;
    const x=tile.x+0.98,z=tile.z+0.5;
    const shadow={x,z,y:birdTerrainSurface(world,x,z)+0.028,height:3};
    const geometry=new THREE.CircleGeometry(1,16).rotateX(-Math.PI/2);
    writeBirdShadowSurface(geometry,world,shadow,0.45,0.25);
    const positions=geometry.getAttribute('position') as THREE.BufferAttribute;
    const heights=new Set<number>();
    for(let i=0;i<positions.count;i++){
      const surface=birdTerrainSurface(world,x+positions.getX(i)*0.45,z+positions.getZ(i)*0.25);
      heights.add(surface);
      expect(shadow.y+positions.getY(i)).toBeCloseTo(surface+0.028,4);
    }
    expect(heights.size).toBeGreaterThan(1);
    geometry.dispose();
  });
});
