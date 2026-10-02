import { describe, expect, it } from 'vitest';
import { cloudPhase, makeCloudTexture } from './CloudShadows';

describe('sombras de nuvens', () => {
  it('reproduz a mesma máscara para a semente do mundo', () => {
    const first = makeCloudTexture(40732);
    const second = makeCloudTexture(40732);
    const other = makeCloudTexture(7291);
    expect(first.image.data).toEqual(second.image.data);
    expect(first.image.data).not.toEqual(other.image.data);
    const mask=first.image.data.filter((_,index)=>index%4===0);
    expect(mask.filter(value=>value<15).length).toBeGreaterThan(1000);
    expect(mask.filter(value=>value>170).length).toBeGreaterThan(500);
    expect(mask.filter(value=>value>15&&value<230).length).toBeGreaterThan(500);
    first.dispose(); second.dispose(); other.dispose();
  });

  it('se move com o relógio do jogo, enfraquece ao entardecer e some à noite', () => {
    const noon = cloudPhase(720, 12);
    const later = cloudPhase(780, 12);
    expect(later.x).toBeGreaterThan(noon.x);
    expect(later.y).toBeGreaterThan(noon.y);
    expect(noon.strength).toBeCloseTo(0.38);
    expect(cloudPhase(720+140,12).coverage).not.toBeCloseTo(noon.coverage);
    expect(noon.coverage).toBeGreaterThanOrEqual(0.16);
    expect(noon.coverage).toBeLessThanOrEqual(0.32);
    expect(cloudPhase(780,6).strength).toBe(0);
    expect(cloudPhase(780, 18).strength).toBeLessThan(noon.strength);
    expect(cloudPhase(780, 22).strength).toBe(0);
    expect(cloudPhase(720, 12)).toEqual(noon);
  });
});
