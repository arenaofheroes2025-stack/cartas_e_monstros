import { describe, expect, it } from 'vitest';
import { PROP_SIZE } from '../game/assets';
import { dominantShadowDirection, groundProfile, sunlightDirection } from './shadowProfiles';

describe('apoio e direção das sombras',()=>{
  it('gera base para cada objeto, com tronco menor que a copa e casa deslocada para trás',()=>{
    for(const [asset,size] of Object.entries(PROP_SIZE)){
      const profile=groundProfile(asset,size);
      expect(profile.width,asset).toBeGreaterThan(0);
      expect(profile.depth,asset).toBeGreaterThan(0);
      expect(Number.isFinite(profile.offsetX),asset).toBe(true);
    }
    expect(groundProfile('tree',PROP_SIZE.tree).width).toBeLessThan(PROP_SIZE.tree*0.4);
    const house=groundProfile('casa-cartas',6.25);
    expect((house.offsetX+house.offsetZ)*Math.SQRT1_2).toBeLessThan(-0.8);
  });
  it('projeta a sombra na direção oposta à luz local à noite',()=>{
    const source={id:'lamp',x:4,y:2,z:5,groundY:0,color:'#fff',reach:6.5};
    const direction=dominantShadowDirection(23,6,5,[source]);
    expect(direction.x).toBeCloseTo(1);
    expect(direction.z).toBeCloseTo(0);
    const sun=sunlightDirection(12);
    expect(sun.x).toBeGreaterThan(0);
    expect(sun.z).toBeGreaterThan(0);
  });
});
