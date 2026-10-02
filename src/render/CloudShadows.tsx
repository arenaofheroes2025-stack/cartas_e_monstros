import { memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { WorldData } from '../game/world';

const TEXTURE_SIZE = 64;

function hash(x: number, y: number, seed: number): number {
  let value = Math.imul(x + seed * 17, 374761393) ^ Math.imul(y - seed * 13, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, cells: number, seed: number): number {
  const gx = x * cells, gy = y * cells;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  const tx = (gx - ix) ** 2 * (3 - 2 * (gx - ix));
  const ty = (gy - iy) ** 2 * (3 - 2 * (gy - iy));
  const sample = (sx: number, sy: number) => hash((sx + cells) % cells, (sy + cells) % cells, seed);
  const top = THREE.MathUtils.lerp(sample(ix, iy), sample(ix + 1, iy), tx);
  const bottom = THREE.MathUtils.lerp(sample(ix, iy + 1), sample(ix + 1, iy + 1), tx);
  return THREE.MathUtils.lerp(top, bottom, ty);
}

export function makeCloudTexture(seed: number): THREE.DataTexture {
  const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  for (let y = 0; y < TEXTURE_SIZE; y++) for (let x = 0; x < TEXTURE_SIZE; x++) {
    const u = x / TEXTURE_SIZE, v = y / TEXTURE_SIZE;
    const density = 0.55 * smoothNoise(u, v, 3, seed) +
      0.3 * smoothNoise(u, v, 6, seed + 19) +
      0.15 * smoothNoise(u, v, 12, seed + 43);
    const value = Math.round(density * 255);
    const offset = (y * TEXTURE_SIZE + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const cloudUniforms = {
  uCloudMask: { value: makeCloudTexture(0) },
  uCloudOffset: { value: new THREE.Vector2() },
  uCloudStrength: { value: 0 }
};

export function cloudPhase(elapsed: number, hour: number): { x: number; y: number; strength: number } {
  const dawn = THREE.MathUtils.clamp((hour - 5) / 2.5, 0, 1);
  const dusk = THREE.MathUtils.clamp((20 - hour) / 2.5, 0, 1);
  return { x: elapsed * 0.006, y: elapsed * 0.0025, strength: dawn * dusk * 0.2 };
}

export function withCloudShadows<T extends THREE.MeshLambertMaterial>(material: T): T {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, cloudUniforms);
    shader.vertexShader = `varying vec2 vCloudWorldXZ;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec4 cloudPosition = vec4(transformed, 1.0);
       #ifdef USE_INSTANCING
         cloudPosition = instanceMatrix * cloudPosition;
       #endif
       vCloudWorldXZ = (modelMatrix * cloudPosition).xz;`
    );
    shader.fragmentShader = `varying vec2 vCloudWorldXZ;
      uniform sampler2D uCloudMask;
      uniform vec2 uCloudOffset;
      uniform float uCloudStrength;\n${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       float cloudDensity = texture2D(uCloudMask, vCloudWorldXZ / 36.0 + uCloudOffset).r;
       diffuseColor.rgb *= 1.0 - uCloudStrength * smoothstep(0.46, 0.68, cloudDensity);`
    );
  };
  material.customProgramCacheKey = () => 'cloud-shadows-v1';
  return material;
}

export const CloudShadows=memo(function CloudShadows({ game, world }: { game: Game; world: WorldData }) {
  useEffect(() => {
    const oldTexture = cloudUniforms.uCloudMask.value;
    cloudUniforms.uCloudMask.value = makeCloudTexture(world.seed);
    oldTexture.dispose();
  }, [world.seed]);
  useFrame(() => {
    const phase = cloudPhase(game.save?.elapsed ?? 0, game.hour);
    cloudUniforms.uCloudOffset.value.set(phase.x, phase.y);
    cloudUniforms.uCloudStrength.value = phase.strength;
  });
  return null;
});
