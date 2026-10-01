import { describe, expect, it } from 'vitest';
import { generateWorld, tileAt } from '../game/world';
import { shoreEdges, waterGeometry } from './WaterSurface';

describe('superfície contínua da água',()=>{
  it('marca somente margens externas, incluindo pontes',()=>{
    const world=generateWorld(40732);
    const edge=world.tiles.find(tile=>tile.terrain==='water'&&
      [[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dz])=>tileAt(world,tile.x+dx,tile.z+dz)?.terrain!=='water'))!;
    const flags=shoreEdges(world,edge.x,edge.z);
    expect(flags.some(Boolean)).toBe(true);
    for(const [direction,[dx,dz]] of [[0,[0,-1]],[1,[1,0]],[2,[0,1]],[3,[-1,0]]] as const)
      expect(flags[direction]).toBe(tileAt(world,edge.x+dx,edge.z+dz)?.terrain==='water'?0:1);
    const interior=world.tiles.find(tile=>tile.terrain==='water'&&shoreEdges(world,tile.x,tile.z).every(flag=>flag===0));
    expect(interior).toBeDefined();
  });
  it('mantém a borda geométrica de tiles vizinhos na mesma posição do mundo',()=>{
    const world=generateWorld(40732);
    const left=world.tiles.find(tile=>tile.terrain==='water'&&tileAt(world,tile.x+1,tile.z)?.terrain==='water')!;
    const right=tileAt(world,left.x+1,left.z)!;
    const geometry=waterGeometry([left,right],world);
    const positions=geometry.getAttribute('position');
    const shoreline=geometry.getAttribute('waterEdges');
    expect([positions.getX(1),positions.getY(1),positions.getZ(1)]).toEqual(
      [positions.getX(4),positions.getY(4),positions.getZ(4)]);
    expect(shoreline.getY(0)).toBe(0);
    expect(shoreline.getW(4)).toBe(0);
    geometry.dispose();
  });
});
