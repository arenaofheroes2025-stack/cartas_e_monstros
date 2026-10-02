import { describe, expect, it } from 'vitest';
import { generateWorld, index } from '../game/world';
import { mapLandmarks, mapTileColor } from './worldMapData';

describe('mapa ampliado',()=>{
  it('mostra locais descobertos e não revela santuários ainda encobertos',()=>{
    const world=generateWorld(346);
    const known=new Set([index(48,48),index(50,52),index(44,46)]);
    const names=mapLandmarks(world,known).map(item=>item.name);
    expect(names).toContain('Vilarejo');
    expect(names).toContain('Ateliê de Cartas');
    expect(names).not.toContain('Casa de Repouso');
    expect(names.some(name=>name.startsWith('Santuário'))).toBe(false);
  });
  it('usa altura real para a leitura de relevo e mantém a água identificável',()=>{
    const world=generateWorld(346);
    const land=world.tiles.find(tile=>tile.terrain==='grass')!;
    const water=world.tiles.find(tile=>tile.terrain==='water'&&tile.waterDepth<0.22)!;
    expect(mapTileColor(land,'height')).not.toBe(mapTileColor(land,'terrain'));
    expect(mapTileColor(water,'height')).not.toBe(mapTileColor(water,'terrain'));
    const deep=world.tiles.find(tile=>tile.terrain==='water'&&tile.waterDepth>water.waterDepth+0.5)!;
    expect(mapTileColor(deep,'terrain')).not.toBe(mapTileColor(water,'terrain'));
  });
});
