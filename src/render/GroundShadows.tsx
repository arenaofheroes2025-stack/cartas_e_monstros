import { memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { HEIGHT_STEP, tileAt, type WorldData, WORLD_SIZE } from '../game/world';
import { CHUNK_SIZE, useChunkVisibility } from './ChunkVisibility';
import { daylightPhase } from './daylightPhase';
import { SHADOW_SLOPE } from './sun';
import { WorldStore } from '../game/worldStore';

const SURFACE = 0.1;

// Thin shaded lips show a descending edge from the upper surface. The lower
// band follows the sun and grows with the height difference. Neither uses a
// round or generic asset shadow.
export function reliefGeometry(world: WorldData, chunkX: number, chunkZ: number): THREE.BufferGeometry {
  const positions: number[] = [], alphas: number[] = [], indices: number[] = [];
  const add = (a: number[], b: number[], c: number[], d: number[], near: number, far: number) => {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    alphas.push(near, near, far, far);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };
  for (let z = chunkZ * CHUNK_SIZE; z < (chunkZ + 1) * CHUNK_SIZE; z++) {
    for (let x = chunkX * CHUNK_SIZE; x < (chunkX + 1) * CHUNK_SIZE; x++) {
      const high = tileAt(world, x, z);
      if(!high)continue;
      if (high.terrain === 'water') continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const low = tileAt(world, x + dx, z + dz);
        if (!low || high.height <= low.height) continue;
        const difference = high.height - low.height;
        const facingAway = dx * SHADOW_SLOPE.x + dz * SHADOW_SLOPE.z > 0;
        const castWidth = Math.min(0.78, (facingAway ? 0.31 : 0.18) + difference * (facingAway ? 0.12 : 0.06));
        const castAlpha = Math.min(0.78, (facingAway ? 0.54 : 0.28) + difference * 0.07);
        const upperAlpha = Math.min(0.57, 0.3 + difference * 0.065);
        const wallAlpha = facingAway ? 0.36 : 0.17;
        const highY = SURFACE + high.height * HEIGHT_STEP;
        const lowY = SURFACE + low.height * HEIGHT_STEP;
        const [ax, az, bx, bz] = dx === 1 ? [x + 1, z, x + 1, z + 1] :
          dx === -1 ? [x, z + 1, x, z] :
            dz === 1 ? [x + 1, z + 1, x, z + 1] : [x, z, x + 1, z];
        const lowSurface = lowY + 0.019;
        add([ax, lowSurface, az], [bx, lowSurface, bz],
          [bx + dx * castWidth, lowSurface, bz + dz * castWidth],
          [ax + dx * castWidth, lowSurface, az + dz * castWidth], castAlpha, 0);
        const topSurface = highY + 0.019;
        const rim = 0.19;
        add([ax, topSurface, az], [bx, topSurface, bz],
          [bx - dx * rim, topSurface, bz - dz * rim],
          [ax - dx * rim, topSurface, az - dz * rim], upperAlpha, 0);
        const faceOffset = 0.012;
        add([ax + dx * faceOffset, highY - 0.015, az + dz * faceOffset],
          [bx + dx * faceOffset, highY - 0.015, bz + dz * faceOffset],
          [bx + dx * faceOffset, lowY + 0.02, bz + dz * faceOffset],
          [ax + dx * faceOffset, lowY + 0.02, az + dz * faceOffset], wallAlpha * 0.45, wallAlpha);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('shadeAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function ShadowChunk({world,x,z,material,revision}:{world:WorldData;x:number;z:number;material:THREE.Material;revision:number}) {
  const geometry=useMemo(()=>reliefGeometry(world,x,z),[world,x,z,revision]);
  const visible = useChunkVisibility(x, z);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group ref={visible}>
    {geometry.getAttribute('position').count > 0 &&
      <mesh geometry={geometry} material={material} renderOrder={2}/>}
  </group>;
}

export const GroundShadows=memo(function GroundShadows({game,world,revision=0}:{game:Game;world:WorldData;revision?:number}) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {uStrength:{value:1}},
    vertexShader: `attribute float shadeAlpha;
      varying float vShadeAlpha;
      void main(){vShadeAlpha=shadeAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying float vShadeAlpha;
      uniform float uStrength;
      void main(){gl_FragColor=vec4(0.025,0.04,0.055,vShadeAlpha*uStrength);}`,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    polygonOffset:true,polygonOffsetFactor:-2
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const daylight = daylightPhase(game.hour).daylight;
    material.uniforms.uStrength.value = 0.64 + daylight * 0.4;
  });
  const width = WORLD_SIZE / CHUNK_SIZE;
  const chunks=[];
  for(let z=0;z<width;z++)for(let x=0;x<width;x++)chunks.push(<ShadowChunk key={`${x},${z}`} world={world}
    x={x} z={z} material={material} revision={world instanceof WorldStore?world.getChunkRevision(x,z):revision}/>);
  if(world instanceof WorldStore)for(const chunk of world.visibleChunks())
    chunks.push(<ShadowChunk key={`${chunk.x},${chunk.z}`} world={world} x={chunk.x} z={chunk.z}
      material={material} revision={world.getChunkRevision(chunk.x,chunk.z)}/>);
  return <group>{chunks}</group>;
});
