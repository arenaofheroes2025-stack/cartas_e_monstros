import * as THREE from 'three';
import type { ShadowGroup } from './shadowCalibration';
import { CAMERA_OFFSET } from './camera';

// Values approved in the asset-position laboratory. World Z remains unchanged.
export const ASSET_POSITION_CALIBRATION: {
  heightY: Record<ShadowGroup, number>;
  frontOfTerrain: Record<ShadowGroup, boolean>;
} = {
  heightY: {
    personagens: 0.01, casas: -0.61, arvores: -0.26,
    pedras: -0.12, plantas: -0.16, objetos: -0.08
  },
  frontOfTerrain: {
    personagens: true, casas: true, arvores: true,
    pedras: true, plantas: true, objetos: true
  }
};

// Ground owns stencil 1. Visible sprite pixels own 2. A second sprite pass
// can then fill ground pixels without drawing over another sprite.
export const GROUND_STENCIL = 1;
export const SPRITE_STENCIL = 2;

/** Move a lowered sprite just in front of its own ground plane in depth space.
 * A higher foreground tile still has a nearer depth and correctly hides it. */
export function groundingDepthBias(heightOffsetY: number): number {
  return Math.max(0, -heightOffsetY) * CAMERA_OFFSET.length() / CAMERA_OFFSET.y + 0.035;
}

export function markGroundStencil<T extends THREE.Material>(material: T): T {
  material.stencilWrite = true;
  material.stencilRef = GROUND_STENCIL;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilZPass = THREE.ReplaceStencilOp;
  return material;
}

export function markSpriteStencil<T extends THREE.Material>(material: T): T {
  material.stencilWrite = true;
  material.stencilRef = SPRITE_STENCIL;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilZPass = THREE.ReplaceStencilOp;
  return material;
}

export function groundOnlyOverlay<T extends THREE.Material>(material: T): T {
  material.depthTest = true;
  material.depthWrite = false;
  material.stencilWrite = true;
  material.stencilRef = GROUND_STENCIL;
  material.stencilFunc = THREE.EqualStencilFunc;
  material.stencilZPass = THREE.KeepStencilOp;
  return material;
}
