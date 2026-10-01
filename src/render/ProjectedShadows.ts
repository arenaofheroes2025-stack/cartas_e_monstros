import * as THREE from 'three';
import { HEIGHT_STEP, tileAt, type WorldData } from '../game/world';
import { SHADOW_SLOPE } from './sun';
import { SHADOW_CALIBRATION } from './shadowCalibration';

const SURFACE = 0.1;
export const SHADOW_SEGMENTS = 5;
const sharedOpacity:{value:number} = { value: SHADOW_CALIBRATION.opacity };

export interface ShadowOrigin { x: number; z: number; y: number }

// Isometric art includes visible floor depth inside the image. Treating every
// pixel of a tall house/tree as vertical height casts its roof too far away.
// The silhouette keeps the image UVs; only its physical projection is capped.
export function shadowCasterHeight(visualHeight: number): number {
  return Math.min(visualHeight, SHADOW_CALIBRATION.casterHeight);
}

export function setProjectedShadowOpacity(value: number): void {
  sharedOpacity.value = value;
}

function terrainHeight(world: WorldData, x: number, z: number): number {
  const tile = tileAt(world, Math.floor(x), Math.floor(z));
  return SURFACE + (tile?.height ?? 0) * HEIGHT_STEP;
}

// Project a pixel of the vertical billboard along the same rays as the sun.
// Iterating the receiver height lets a silhouette continue onto lower ground.
export function projectedPoint(world: WorldData, origin: ShadowOrigin, width: number,
  height: number, u: number, v: number, lift = 0, footV = 0): [number, number, number] {
  const across = (u - 0.5) * width * Math.SQRT1_2;
  const sourceX = origin.x + across;
  const sourceZ = origin.z - across;
  const sourceY = origin.y + lift + Math.max(0, v - footV) * height;
  let receiverY = origin.y, x = sourceX, z = sourceZ;
  for (let iteration = 0; iteration < 3; iteration++) {
    const drop = Math.max(0, sourceY - receiverY);
    x = sourceX + SHADOW_SLOPE.x * drop;
    z = sourceZ + SHADOW_SLOPE.z * drop;
    receiverY = Math.min(sourceY, terrainHeight(world, x, z));
  }
  return [x, receiverY + 0.026, z];
}

export function makeProjectedShadowGeometry(world: WorldData, origins: ShadowOrigin[],
  width: number, height: number, footV = 0): THREE.BufferGeometry {
  const positions = new Float32Array(origins.length * (SHADOW_SEGMENTS + 1) ** 2 * 3);
  const uvs: number[] = [], indices: number[] = [];
  for (let item = 0; item < origins.length; item++) {
    const start = item * (SHADOW_SEGMENTS + 1) ** 2;
    for (let row = 0; row <= SHADOW_SEGMENTS; row++) for (let column = 0; column <= SHADOW_SEGMENTS; column++)
      uvs.push(column / SHADOW_SEGMENTS, footV + (1 - footV) * row / SHADOW_SEGMENTS);
    for (let row = 0; row < SHADOW_SEGMENTS; row++) for (let column = 0; column < SHADOW_SEGMENTS; column++) {
      const a = start + row * (SHADOW_SEGMENTS + 1) + column;
      indices.push(a, a + 1, a + SHADOW_SEGMENTS + 2, a, a + SHADOW_SEGMENTS + 2, a + SHADOW_SEGMENTS + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  origins.forEach((origin, index) => writeProjectedShadow(geometry, world, origin, width, height, index, 0, footV));
  geometry.computeBoundingSphere();
  return geometry;
}

export function writeProjectedShadow(geometry: THREE.BufferGeometry, world: WorldData,
  origin: ShadowOrigin, width: number, height: number, item = 0, lift = 0, footV = 0): void {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const uvs = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let row = 0; row <= SHADOW_SEGMENTS; row++) for (let column = 0; column <= SHADOW_SEGMENTS; column++) {
    const v = footV + (1 - footV) * row / SHADOW_SEGMENTS;
    const [x, y, z] = projectedPoint(world, origin, width, height,
      column / SHADOW_SEGMENTS, v, lift, footV);
    const vertex = item * (SHADOW_SEGMENTS + 1) ** 2 + row * (SHADOW_SEGMENTS + 1) + column;
    positions.setXYZ(vertex, x, y, z);
    uvs.setXY(vertex, column / SHADOW_SEGMENTS, v);
  }
  positions.needsUpdate = true;
  uvs.needsUpdate = true;
}

export function projectedShadowMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uRepeat: { value: new THREE.Vector2(1, 1) },
      uOffset: { value: new THREE.Vector2() },
      uFlip: { value: 0 },
      uAlphaCut: { value: 0.2 },
      uEdgeSoftness: { value: SHADOW_CALIBRATION.softness },
      uFootGain: { value: SHADOW_CALIBRATION.footGain },
      uTopGain: { value: 0.9 },
      uOpacity: sharedOpacity,
      uFade: { value: 1 }
    },
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D uTexture;
      uniform vec2 uRepeat;
      uniform vec2 uOffset;
      uniform float uFlip;
      uniform float uAlphaCut;
      uniform float uEdgeSoftness;
      uniform float uFootGain;
      uniform float uTopGain;
      uniform float uOpacity;
      uniform float uFade;
      varying vec2 vUv;
      void main(){
        vec2 sampleUv=vec2(mix(vUv.x,1.0-vUv.x,uFlip),vUv.y)*uRepeat+uOffset;
        float silhouette=texture2D(uTexture,sampleUv).a;
        if(silhouette<uAlphaCut)discard;
        float contact=uOpacity*uFade*mix(uFootGain,uTopGain,vUv.y);
        float shape=smoothstep(0.5-uEdgeSoftness,0.5+uEdgeSoftness,silhouette);
        gl_FragColor=vec4(0.025,0.04,0.055,shape*contact);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    toneMapped: false
  });
}
