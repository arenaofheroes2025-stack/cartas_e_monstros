import { memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { WorldData } from '../game/world';
import { daylightPhase } from './daylightPhase';
import type { SceneLightSource } from './lightSources';

const TEXTURE_SIZE = 128;
const TOWN_LIGHT_LIMIT = 6;

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
  const puffs:{x:number;y:number;rx:number;ry:number;opacity:number}[]=[];
  const wrap=(value:number)=>(value%1+1)%1;
  for(let group=0;group<9;group++){
    const x=(group%3+0.5+(hash(group,11,seed)-0.5)*0.4)/3;
    const y=(Math.floor(group/3)+0.5+(hash(group,29,seed)-0.5)*0.4)/3;
    const radius=0.055+hash(group,47,seed)*0.025;
    const opacity=0.45+hash(group,143,seed)*0.55;
    const count=7+Math.floor(hash(group,53,seed)*3);
    for(let index=0;index<count;index++){
      const dx=index===0?0:(hash(group,index+61,seed)-0.5)*radius*2.1;
      const dy=index===0?0:(hash(group,index+73,seed)-0.5)*radius*1.7;
      puffs.push({
        x:wrap(x+dx),y:wrap(y+dy),
        rx:radius*(index===0?1.18:0.63+hash(group,index+83,seed)*0.54),
        ry:radius*(index===0?0.92:0.52+hash(group,index+97,seed)*0.5),
        opacity
      });
    }
  }
  for (let y = 0; y < TEXTURE_SIZE; y++) for (let x = 0; x < TEXTURE_SIZE; x++) {
    const u = x / TEXTURE_SIZE, v = y / TEXTURE_SIZE;
    const edgeNoise=(smoothNoise(u,v,16,seed+91)-0.5)*0.08;
    let silhouette=0;
    for(const puff of puffs){
      const dx=Math.abs(u-puff.x),dy=Math.abs(v-puff.y);
      const wrappedX=Math.min(dx,1-dx),wrappedY=Math.min(dy,1-dy);
      if(wrappedX>puff.rx*1.2||wrappedY>puff.ry*1.2)continue;
      const distance=Math.sqrt((wrappedX/puff.rx)**2+(wrappedY/puff.ry)**2)+edgeNoise;
      silhouette=Math.max(silhouette,puff.opacity*(1-THREE.MathUtils.smoothstep(distance,0.7,1.14)));
    }
    const value = Math.round(silhouette * 255);
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
  uCloudStrength: { value: 0 },
  uCloudCoverage: { value: 0.2 },
  uWorldLightGrade: { value: new THREE.Vector3(1,1,1) },
  uWorldLightFill: { value: 0 },
  uWorldSpriteLift: { value: 0 },
  uTownLights: { value: Array.from({length:TOWN_LIGHT_LIMIT},()=>new THREE.Vector4()) },
  uTownLightCount: { value: 0 },
  uTownLightNight: { value: 0 }
};

export function setWorldLightGrade(red:number,green:number,blue:number,fill:number,spriteLift:number):void {
  cloudUniforms.uWorldLightGrade.value.set(red,green,blue);
  cloudUniforms.uWorldLightFill.value=fill;
  cloudUniforms.uWorldSpriteLift.value=spriteLift;
}

export function setTownLightSources(sources:readonly SceneLightSource[]):void {
  const count=Math.min(sources.length,TOWN_LIGHT_LIMIT);
  cloudUniforms.uTownLightCount.value=count;
  for(let index=0;index<count;index++){
    const source=sources[index];
    cloudUniforms.uTownLights.value[index].set(source.x,source.z,source.reach,
      source.kind==='lamp'?1:0.85);
  }
}

export function setTownLightNight(night:number):void {
  cloudUniforms.uTownLightNight.value=night;
}

export function cloudPhase(elapsed: number, hour: number): { x: number; y: number; strength: number; coverage:number } {
  return {
    x:elapsed*0.0022,y:elapsed*0.001,
    strength:daylightPhase(hour).daylight*0.38,
    coverage:0.24+0.08*Math.sin(elapsed*0.022)
  };
}

export function withCloudShadows<T extends THREE.MeshLambertMaterial>(material: T, townGround=false): T {
  // Sprites use a stronger painted emissive layer than the terrain. Lift their
  // dark painted details in daylight without fading the inked silhouettes.
  const spriteArtwork=!!material.emissiveMap&&material.emissiveIntensity>=0.25;
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
      uniform float uCloudStrength;
      uniform float uCloudCoverage;
      uniform vec3 uWorldLightGrade;
      uniform float uWorldLightFill;
      uniform float uWorldSpriteLift;
      ${spriteArtwork||townGround?`uniform vec4 uTownLights[${TOWN_LIGHT_LIMIT}];
      uniform float uTownLightCount;
      uniform float uTownLightNight;`:''}\n${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       float cloudDensity = texture2D(uCloudMask, vCloudWorldXZ / 64.0 + uCloudOffset).r;
       float cloudShade = 1.0 - uCloudStrength * smoothstep(uCloudCoverage, uCloudCoverage + 0.3, cloudDensity);`
    ).replace('#include <tonemapping_fragment>',
      `gl_FragColor.rgb *= uWorldLightGrade +
         uWorldLightFill * (vec3(1.0) - clamp(gl_FragColor.rgb,0.0,1.0));
       ${spriteArtwork?'gl_FragColor.rgb = mix(gl_FragColor.rgb,max(gl_FragColor.rgb,sqrt(max(gl_FragColor.rgb,vec3(0.0)))),uWorldSpriteLift);':''}
       gl_FragColor.rgb *= cloudShade;
       ${spriteArtwork||townGround?`if(uTownLightNight>0.001&&uTownLightCount>0.5){
         float townFill=0.0;
         for(int i=0;i<${TOWN_LIGHT_LIMIT};i++){
           if(float(i)>=uTownLightCount)break;
           vec2 difference=vCloudWorldXZ-uTownLights[i].xy;
           float radius=uTownLights[i].z*${townGround?'0.62':'1.0'};
           float radial=dot(difference,difference)/(radius*radius);
           townFill+=uTownLights[i].w*(1.0-smoothstep(0.08,0.95,radial));
         }
         townFill=min(townFill,${townGround?'1.0':'1.3'})*uTownLightNight;
         ${townGround?`gl_FragColor.rgb=gl_FragColor.rgb*(1.0+townFill*0.25)+
           vec3(0.055,0.038,0.016)*townFill;`:`gl_FragColor.rgb=gl_FragColor.rgb*(1.0+townFill*0.12)+
           vec3(0.045,0.03,0.015)*townFill;`}
       }`:''}
       #include <tonemapping_fragment>`);
  };
  material.customProgramCacheKey = () => `cloud-shadows-v11-${townGround?'town-ground':spriteArtwork?'sprite':'terrain'}`;
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
    cloudUniforms.uCloudCoverage.value = phase.coverage;
  });
  return null;
});
