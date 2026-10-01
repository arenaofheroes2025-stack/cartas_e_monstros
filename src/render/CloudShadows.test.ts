import { describe, expect, it } from 'vitest';
import { cloudPhase, makeCloudTexture } from './CloudShadows';

describe('sombras de nuvens', () => {
  it('reproduz a mesma máscara para a semente do mundo', () => {
    const first = makeCloudTexture(40732);
    const second = makeCloudTexture(40732);
    const other = makeCloudTexture(7291);
    expect(first.image.data).toEqual(second.image.data);
    expect(first.image.data).not.toEqual(other.image.data);
    first.dispose(); second.dispose(); other.dispose();
  });

  it('se move com o relógio do jogo, enfraquece ao entardecer e some à noite', () => {
    const noon = cloudPhase(720, 12);
    const later = cloudPhase(780, 12);
    expect(later.x).toBeGreaterThan(noon.x);
    expect(later.y).toBeGreaterThan(noon.y);
    expect(cloudPhase(780, 18).strength).toBeLessThan(noon.strength);
    expect(cloudPhase(780, 22).strength).toBe(0);
    expect(cloudPhase(720, 12)).toEqual(noon);
  });
});
