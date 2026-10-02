import { memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { HEIGHT_STEP, tileAt, type Tile, type WorldData, WORLD_SIZE } from '../game/world';
import { TILE_ATLAS } from '../game/biomeArt';
import { imageTexture } from './art';
import { CHUNK_SIZE, useChunkVisibility } from './ChunkVisibility';
import { withCloudShadows } from './CloudShadows';
import { daylightPhase } from './daylightPhase';

const SURFACE=0.1;
const waterColumn=TILE_ATLAS.base.water%TILE_ATLAS.columns;
const waterRow=Math.floor(TILE_ATLAS.base.water/TILE_ATLAS.columns);
const waterUv={
  left:waterColumn/TILE_ATLAS.columns+0.5/(48*TILE_ATLAS.columns),
  right:(waterColumn+1)/TILE_ATLAS.columns-0.5/(48*TILE_ATLAS.columns),
  bottom:1-(waterRow+1)/TILE_ATLAS.rows+0.5/(48*TILE_ATLAS.rows),
  top:1-waterRow/TILE_ATLAS.rows-0.5/(48*TILE_ATLAS.rows)
};

export function waterGlintIntensity(hour:number):number {
  const daylight=daylightPhase(hour).daylight;
  const noon=THREE.MathUtils.smoothstep(hour,9,12)*
    (1-THREE.MathUtils.smoothstep(hour,12,15));
  return 0.08+daylight*(0.7+0.22*noon);
}

// North, east, south, west. A bridge is a shoreline too: the water laps at its edge.
export function shoreEdges(world:WorldData,x:number,z:number):[number,number,number,number] {
  return [[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dz])=>
    tileAt(world,x+dx,z+dz)?.terrain==='water'?0:1) as [number,number,number,number];
}

function cornerDepth(world:WorldData,x:number,z:number):number {
  let total=0,count=0;
  for(const dz of [-1,0])for(const dx of [-1,0]){
    const tile=tileAt(world,x+dx,z+dz);
    if(tile?.terrain==='water'){total+=tile.waterDepth;count++;}
  }
  return count?total/count:0.14;
}

export function waterGeometry(tiles:Tile[],world:WorldData,floor=false):THREE.BufferGeometry {
  const positions:number[]=[],uvs:number[]=[],normals:number[]=[],localUvs:number[]=[],edges:number[]=[],depths:number[]=[],indices:number[]=[];
  for(const tile of tiles){
    const {x,z}=tile,y=SURFACE+tile.height*HEIGHT_STEP,vertex=positions.length/3;
    const corners=[cornerDepth(world,x,z),cornerDepth(world,x+1,z),
      cornerDepth(world,x+1,z+1),cornerDepth(world,x,z+1)];
    positions.push(x,floor?y-0.12-corners[0]*0.78:y,z,
      x+1,floor?y-0.12-corners[1]*0.78:y,z,
      x+1,floor?y-0.12-corners[2]*0.78:y,z+1,
      x,floor?y-0.12-corners[3]*0.78:y,z+1);
    depths.push(...corners);
    normals.push(0,1,0,0,1,0,0,1,0,0,1,0);
    localUvs.push(0,0,1,0,1,1,0,1);
    // The map supplies the atlas uniform; these UVs keep Three's lighting shader map path enabled.
    uvs.push(waterUv.left,waterUv.top,waterUv.right,waterUv.top,
      waterUv.right,waterUv.bottom,waterUv.left,waterUv.bottom);
    const shore=shoreEdges(world,x,z);
    for(let corner=0;corner<4;corner++)edges.push(...shore);
    indices.push(vertex,vertex+1,vertex+2,vertex,vertex+2,vertex+3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('waterLocalUv',new THREE.Float32BufferAttribute(localUvs,2));
  geometry.setAttribute('waterEdges',new THREE.Float32BufferAttribute(edges,4));
  geometry.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depths,1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function underwaterFloorMaterial(time:THREE.IUniform<number>):THREE.MeshLambertMaterial {
  const material=withCloudShadows(new THREE.MeshLambertMaterial({
    map:imageTexture('/art/terrain-atlas.png',true),side:THREE.DoubleSide
  }));
  const cloudCompile=material.onBeforeCompile.bind(material);
  const beach=TILE_ATLAS.base.beach,river=TILE_ATLAS.biome.riverbank;
  const atlasUv=(id:number)=>`vec2((${id%TILE_ATLAS.columns}.0+0.0104+mirrored.x*0.9792)/4.0,
    1.0-(${Math.floor(id/TILE_ATLAS.columns)}.0+1.0)/20.0+(0.0104+mirrored.y*0.9792)/20.0)`;
  material.onBeforeCompile=(shader,renderer)=>{
    cloudCompile(shader,renderer);
    shader.uniforms.uWaterTime=time;
    shader.vertexShader=`attribute float waterDepth;
      varying float vWaterDepth;\n${shader.vertexShader}`.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       vWaterDepth=waterDepth;`);
    shader.fragmentShader=`uniform float uWaterTime;
      varying float vWaterDepth;\n${shader.fragmentShader}`.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        float refraction=sin(vCloudWorldXZ.x*4.3+uWaterTime*0.9)*
          cos(vCloudWorldXZ.y*3.8-uWaterTime*0.7);
        vec2 shifted=vCloudWorldXZ+vec2(refraction,-refraction)*
          (0.006+0.013*smoothstep(0.2,0.7,vWaterDepth));
        vec2 mirrored=1.0-abs(mod(shifted*0.56,2.0)-1.0);
        vec3 sand=texture2D(map,${atlasUv(beach)}).rgb;
        vec3 stones=texture2D(map,${atlasUv(river)}).rgb;
        float deposits=smoothstep(0.38,0.72,
          0.5+0.28*sin(vCloudWorldXZ.x*0.81+0.4)*sin(vCloudWorldXZ.y*1.07));
        vec3 bottom=mix(sand,stones,deposits*0.44);
        bottom*=mix(vec3(0.71,0.94,0.88),vec3(0.34,0.61,0.68),clamp(vWaterDepth,0.0,1.0));
        diffuseColor.rgb*=bottom;
      #endif
    `);
  };
  material.customProgramCacheKey=()=> 'water-floor-world-atlas-v2';
  return material;
}

function animatedWaterMaterial(time:THREE.IUniform<number>,artwork:THREE.IUniform<number>,sunlight:THREE.IUniform<number>):THREE.MeshLambertMaterial {
  const material=withCloudShadows(new THREE.MeshLambertMaterial({
    map:imageTexture('/art/terrain-atlas.png',true),
    side:THREE.DoubleSide,transparent:true,depthWrite:false
  }));
  const cloudCompile=material.onBeforeCompile.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    cloudCompile(shader,renderer);
    shader.uniforms.uWaterTime=time;
    shader.uniforms.uWaterArtwork=artwork;
    shader.uniforms.uWaterSunlight=sunlight;
    shader.vertexShader=`attribute vec2 waterLocalUv;
      attribute vec4 waterEdges;
      attribute float waterDepth;
      varying vec2 vWaterLocalUv;
      varying vec4 vWaterEdges;
      varying float vWaterDepth;\n${shader.vertexShader}`.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       vWaterLocalUv=waterLocalUv;
       vWaterEdges=waterEdges;
       vWaterDepth=waterDepth;`);
    shader.fragmentShader=`uniform float uWaterTime;
      uniform float uWaterArtwork;
      uniform float uWaterSunlight;
      varying vec2 vWaterLocalUv;
      varying vec4 vWaterEdges;
      varying float vWaterDepth;\n${shader.fragmentShader}`.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        vec4 waterPaint;
        vec2 flow=vec2(
          sin(dot(vCloudWorldXZ,vec2(5.3,3.7))-uWaterTime*1.35),
          cos(dot(vCloudWorldXZ,vec2(3.9,-4.8))+uWaterTime*0.93)
        )*0.012;
        vec2 moving=vCloudWorldXZ*0.52+vec2(uWaterTime*0.007,uWaterTime*0.005)+flow;
        // Mirroring repeats the original painted tile without hard UV jumps.
        vec2 mirrored=1.0-abs(mod(moving,2.0)-1.0);
        vec2 waterUv=vec2(mix(${waterUv.left.toFixed(6)},${waterUv.right.toFixed(6)},mirrored.x),
          mix(${waterUv.bottom.toFixed(6)},${waterUv.top.toFixed(6)},mirrored.y));
        waterPaint=texture2D(map,waterUv);
        float depth=clamp(vWaterDepth,0.0,1.0);
        waterPaint.rgb*=mix(vec3(1.12,1.12,1.05),vec3(0.58,0.73,0.83),
          smoothstep(0.25,1.0,depth));
        diffuseColor*=waterPaint;
        diffuseColor.a=mix(0.38,0.94,smoothstep(0.12,1.0,depth));
        float ripple=0.5+0.5*sin(vCloudWorldXZ.x*7.1+vCloudWorldXZ.y*4.3-uWaterTime*1.1)
          *sin(vCloudWorldXZ.y*5.6-vCloudWorldXZ.x*2.4+uWaterTime*0.78);
        diffuseColor.rgb*=0.975+0.05*ripple;
        float shore=max(max(
          vWaterEdges.x*(1.0-smoothstep(0.02,0.3,vWaterLocalUv.y)),
          vWaterEdges.y*(1.0-smoothstep(0.02,0.3,1.0-vWaterLocalUv.x))),max(
          vWaterEdges.z*(1.0-smoothstep(0.02,0.3,1.0-vWaterLocalUv.y)),
          vWaterEdges.w*(1.0-smoothstep(0.02,0.3,vWaterLocalUv.x))));
        float shoreWave=0.5+0.5*sin(vCloudWorldXZ.x*6.2+vCloudWorldXZ.y*5.1-uWaterTime*1.8);
        diffuseColor.rgb+=vec3(0.025,0.045,0.05)*shore*(0.45+0.55*shoreWave);
      #endif
    `).replace('#include <opaque_fragment>',`
      #ifdef USE_MAP
        outgoingLight=mix(outgoingLight,waterPaint.rgb,uWaterArtwork);
        outgoingLight*=0.66+0.12*uWaterSunlight;
        float sunGlint=smoothstep(0.87,0.98,ripple)*
          smoothstep(0.72,0.94,0.5+0.5*sin(vCloudWorldXZ.x*3.4-vCloudWorldXZ.y*2.8+uWaterTime*0.62));
        outgoingLight+=mix(vec3(0.045,0.085,0.11),vec3(0.15,0.17,0.15),uWaterSunlight)*
          sunGlint*(0.16+0.84*uWaterSunlight)*
          (1.0-0.35*clamp(vWaterDepth,0.0,1.0));
        // Sparse glints drift and blink on the water surface, in loose patches.
        vec2 glintGrid=(vCloudWorldXZ+vec2(uWaterTime*0.035,uWaterTime*0.018))*1.35;
        vec2 glintCell=floor(glintGrid);
        float glintSeed=fract(sin(dot(glintCell,vec2(127.1,311.7)))*43758.5453);
        vec2 glintCenter=vec2(fract(glintSeed*23.27),fract(glintSeed*47.11))*0.55+0.225;
        vec2 glintOffset=fract(glintGrid)-glintCenter;
        float glintPatch=smoothstep(0.42,0.65,0.5+0.5*
          sin(vCloudWorldXZ.x*0.32+1.2)*sin(vCloudWorldXZ.y*0.29-0.6));
        float glintBlink=smoothstep(0.4,0.88,0.5+0.5*sin(uWaterTime*2.4+glintSeed*19.0));
        float glintCore=1.0-smoothstep(0.0,0.095,length(glintOffset));
        float glintRayX=(1.0-smoothstep(0.0,0.025,abs(glintOffset.y)))*
          (1.0-smoothstep(0.08,0.28,abs(glintOffset.x)));
        float glintRayY=(1.0-smoothstep(0.0,0.025,abs(glintOffset.x)))*
          (1.0-smoothstep(0.08,0.28,abs(glintOffset.y)));
        float sparkle=step(0.84,glintSeed)*glintPatch*glintBlink*
          min(1.0,glintCore+0.45*(glintRayX+glintRayY));
        outgoingLight+=mix(vec3(0.12,0.2,0.24),vec3(0.85,0.91,0.78),uWaterSunlight)*
          sparkle*(0.15+0.85*uWaterSunlight);
      #endif
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey=()=> 'water-depth-surface-v7';
  return material;
}

function WaterChunk({tiles,world,x,z,material,floorMaterial}:{tiles:Tile[];world:WorldData;x:number;z:number;material:THREE.Material;floorMaterial:THREE.Material}) {
  const geometry=useMemo(()=>waterGeometry(tiles,world),[tiles,world]);
  const floor=useMemo(()=>waterGeometry(tiles,world,true),[tiles,world]);
  const visible=useChunkVisibility(x,z);
  useEffect(()=>()=>{geometry.dispose();floor.dispose();},[geometry,floor]);
  return <group ref={visible}>
    <mesh geometry={floor} material={floorMaterial} receiveShadow />
    <mesh geometry={geometry} material={material} receiveShadow />
  </group>;
}

export const WaterSurface=memo(function WaterSurface({world,game}:{world:WorldData;game:Game}) {
  const time=useMemo<THREE.IUniform<number>>(()=>({value:0}),[]);
  const artwork=useMemo<THREE.IUniform<number>>(()=>({value:0.55}),[]);
  const sunlight=useMemo<THREE.IUniform<number>>(()=>({value:1}),[]);
  const material=useMemo(()=>animatedWaterMaterial(time,artwork,sunlight),[time,artwork,sunlight]);
  const floorMaterial=useMemo(()=>underwaterFloorMaterial(time),[time]);
  const chunks=useMemo(()=>{
    const width=WORLD_SIZE/CHUNK_SIZE;
    const groups=Array.from({length:width*width},()=>[] as Tile[]);
    for(const tile of world.tiles)if(tile.terrain==='water')
      groups[Math.floor(tile.z/CHUNK_SIZE)*width+Math.floor(tile.x/CHUNK_SIZE)].push(tile);
    return groups;
  },[world]);
  useEffect(()=>()=>{material.dispose();floorMaterial.dispose();},[material,floorMaterial]);
  useFrame(({clock})=>{
    time.value=game.save?.elapsed??clock.elapsedTime;
    const daylight=daylightPhase(game.hour).daylight;
    artwork.value=0.48+0.08*daylight;
    sunlight.value=waterGlintIntensity(game.hour);
  });
  const width=WORLD_SIZE/CHUNK_SIZE;
  return <group>{chunks.map((tiles,index)=>tiles.length>0&&
    <WaterChunk key={index} tiles={tiles} world={world} x={index%width} z={Math.floor(index/width)} material={material} floorMaterial={floorMaterial}/>)}</group>;
});
