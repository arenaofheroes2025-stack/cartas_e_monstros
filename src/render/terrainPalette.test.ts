import { describe, expect, it } from 'vitest';
import { BIOME_BRUSH_PROFILES, REGION_BIOME_PROFILE, TILE_ATLAS, TERRAIN_MATERIALS, BIOME_PROP_KITS, BIOME_PROP_SHEETS } from '../game/biomeArt';
import { generateWorld, tileAt, WORLD_SIZE } from '../game/world';
import { cliffIndex, overlayIndices, terrainIndex } from './terrainPalette';
import { terrainBrushPixels, urbanBrushPixels } from './TerrainBrush';

describe('paleta de tile maps',()=>{
  it('inclui as 16 regiões e três folhas de objetos independentes',()=>{
    expect(Object.keys(TILE_ATLAS.biome)).toHaveLength(16);
    expect(Object.keys(TILE_ATLAS.walls)).toHaveLength(16);
    expect(Object.keys(BIOME_PROP_KITS)).toHaveLength(16);
    expect(Object.keys(BIOME_BRUSH_PROFILES)).toHaveLength(16);
    expect(Object.values(BIOME_BRUSH_PROFILES).every(profile=>Object.keys(profile.layers).length===4)).toBe(true);
    expect(Object.values(BIOME_PROP_SHEETS).flat()).toHaveLength(48);
    expect(TERRAIN_MATERIALS.road.top).toBe(TILE_ATLAS.base.road);
    expect(TERRAIN_MATERIALS.volcanic.wall).toBe(TILE_ATLAS.walls.redBasalt);
  });
  it('preserva os solos originais e separa paredes das superfícies',()=>{
    const world=generateWorld(40732);
    const palette=world.tiles.map(tile=>terrainIndex(world,tile));
    expect(palette.every(index=>index>=0&&index<80)).toBe(true);
    expect(world.tiles.filter(tile=>['grass','stone','path'].includes(tile.terrain)).every(tile=>{
      const profile=BIOME_BRUSH_PROFILES[REGION_BIOME_PROFILE[tile.biome]];
      return terrainIndex(world,tile)===profile.base&&cliffIndex(world,tile)===profile.wall&&
        overlayIndices(tile)[0]===TILE_ATLAS.base.road;
    })).toBe(true);
    expect(world.tiles.filter(tile=>tile.terrain!=='water').every(tile=>{
      const wall=cliffIndex(world,tile);
      return wall>=64&&wall<80;
    })).toBe(true);
    expect(world.tiles.filter(tile=>tile.prop).length/world.tiles.length).toBeLessThan(0.08);
  });
  it('pinta caminhos e manchas contínuas a partir da semente',()=>{
    const world=generateWorld(40732);
    const pixels=terrainBrushPixels(world);
    expect(pixels).toEqual(terrainBrushPixels(generateWorld(40732)));
    const sample=(x:number,z:number,channel:number)=>pixels[(z*WORLD_SIZE+x)*4+channel];
    const path=world.tiles.find(tile=>tile.terrain==='path');
    expect(path).toBeDefined();
    expect(sample(path!.x,path!.z,0)).toBe(255);
    expect(world.tiles.filter(tile=>tile.terrain==='grass').some(tile=>sample(tile.x,tile.z,0)===0)).toBe(true);
    expect(world.tiles.filter(tile=>tile.terrain==='water').every(tile=>sample(tile.x,tile.z,1)===0)).toBe(true);
    expect(world.tiles.some(tile=>sample(tile.x,tile.z,1)>20)).toBe(true);
  });
  it('pinta a pedra da cidade sobre a base da floresta e suaviza a periferia',()=>{
    const world=generateWorld(40732);
    const pixels=urbanBrushPixels(world);
    const city=(x:number,z:number)=>pixels[(z*WORLD_SIZE+x)*4];
    const center=tileAt(world,world.start.x,world.start.z)!;
    expect(center.terrain).toBe('plaza');
    expect(terrainIndex(world,center)).toBe(TILE_ATLAS.base.forest);
    expect(cliffIndex(world,center)).toBe(TILE_ATLAS.walls.earth);
    expect(city(center.x,center.z)).toBe(255);
    expect(world.tiles.some(tile=>tile.terrain==='grass'&&city(tile.x,tile.z)>0&&city(tile.x,tile.z)<255)).toBe(true);
    const shrine=world.places.find(place=>place.kind==='shrine')!;
    expect(city(shrine.x,shrine.z)).toBe(0);
  });
});
