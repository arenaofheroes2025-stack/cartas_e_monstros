import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HEIGHT_STEP } from '../game/world';
import { ASSET_POSITION_CALIBRATION, GROUND_STENCIL, SPRITE_STENCIL,
  groundOnlyOverlay, groundingDepthBias, markGroundStencil, markSpriteStencil } from './assetPositionCalibration';

describe('approved asset position calibration', () => {
  it('uses the submitted group offsets and leaves world Z unchanged', () => {
    expect(ASSET_POSITION_CALIBRATION.heightY).toEqual({
      personagens: 0.01, casas: -0.61, arvores: -0.26,
      pedras: -0.12, plantas: -0.16, objetos: -0.08
    });
    expect(Object.values(ASSET_POSITION_CALIBRATION.frontOfTerrain).every(Boolean)).toBe(true);
  });

  it('lets a supporting floor show through while a higher foreground level stays nearer', () => {
    const houseBias = groundingDepthBias(ASSET_POSITION_CALIBRATION.heightY.casas);
    const plantBias = groundingDepthBias(ASSET_POSITION_CALIBRATION.heightY.plantas);
    expect(houseBias).toBeGreaterThan(plantBias);
    expect(plantBias).toBeLessThan(HEIGHT_STEP);
    expect(groundingDepthBias(0.01)).toBeCloseTo(0.035);
  });

  it('restricts the second sprite pass to visible ground pixels', () => {
    const ground = markGroundStencil(new THREE.MeshBasicMaterial());
    const sprite = markSpriteStencil(new THREE.MeshBasicMaterial());
    const overlay = groundOnlyOverlay(new THREE.MeshBasicMaterial());
    expect(ground.stencilRef).toBe(GROUND_STENCIL);
    expect(sprite.stencilRef).toBe(SPRITE_STENCIL);
    expect(overlay.stencilRef).toBe(GROUND_STENCIL);
    expect(overlay.stencilFunc).toBe(THREE.EqualStencilFunc);
    expect(overlay.depthTest).toBe(true);
    expect(overlay.depthWrite).toBe(false);
  });
});
