import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { HEIGHT_STEP, tileAt, type Tile, type WorldData, WORLD_SIZE } from '../game/world';
import { TILE_ATLAS } from '../game/biomeArt';
import { imageTexture } from './art';
import { CHUNK_SIZE, useChunkVisibility } from './ChunkVisibility';
import { withCloudShadows } from './CloudShadows';

const SURFACE=0.1;
const waterColumn=TILE_ATLAS.base.water%TILE_ATLAS.columns;
const waterRow=Math.floor(TILE_ATLAS.base.water/TILE_ATLAS.columns);
const waterUv={
  left:waterColumn/TILE_ATLAS.columns+0.5/(48*TILE_ATLAS.columns),
  right:(waterColumn+1)/TILE_ATLAS.columns-0.5/(48*TILE_ATLAS.columns),
  bottom:1-(waterRow+1)/TILE_ATLAS.rows+0.5/(48*TILE_ATLAS.rows),
  top:1-waterRow/TILE_ATLAS.rows-0.5/(48*TILE_ATLAS.rows)
};

// North, east, south, west. A bridge is a shoreline too: the water laps at its edge.
export function shoreEdges(world:WorldData,x:number,z:number):[number,number,number,number] {
  return [[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dz])=>
    tileAt(world,x+dx,z+dz)?.terrain==='water'?0:1) as [number,number,number,number];
}

export function waterGeometry(tiles:Tile[],world:WorldData):THREE.BufferGeometry {
  const positions:number[]=[],uvs:number[]=[],normals:number[]=[],localUvs:number[]=[],edges:number[]=[],indices:number[]=[];
  for(const tile of tiles){
    const {x,z}=tile,y=SURFACE+tile.height*HEIGHT_STEP,vertex=positions.length/3;
    positions.push(x,y,z,x+1,y,z,x+1,y,z+1,x,y,z+1);
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
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function animatedWaterMaterial(time:THREE.IUniform<number>,artwork:THREE.IUniform<number>):THREE.MeshLambertMaterial {
  const material=withCloudShadows(new THREE.MeshLambertMaterial({
    map:imageTexture('/art/terrain-atlas.png',true),
    side:THREE.DoubleSide
  }));
  const cloudCompile=material.onBeforeCompile.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    cloudCompile(shader,renderer);
    shader.uniforms.uWaterTime=time;
    shader.uniforms.uWaterArtwork=artwork;
    shader.vertexShader=`attribute vec2 waterLocalUv;
      attribute vec4 waterEdges;
      varying vec2 vWaterLocalUv;
      varying vec4 vWaterEdges;\n${shader.vertexShader}`.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       vWaterLocalUv=waterLocalUv;
       vWaterEdges=waterEdges;`);
    shader.fragmentShader=`uniform float uWaterTime;
      uniform float uWaterArtwork;
      varying vec2 vWaterLocalUv;
      varying vec4 vWaterEdges;\n${shader.fragmentShader}`.replace('#include <map_fragment>',`
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
        diffuseColor*=waterPaint;
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
        outgoingLight*=0.78;
      #endif
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey=()=> 'water-world-space-v3-artwork-cloud-v1';
  return material;
}

function WaterChunk({tiles,world,x,z,material}:{tiles:Tile[];world:WorldData;x:number;z:number;material:THREE.Material}) {
  const geometry=useMemo(()=>waterGeometry(tiles,world),[tiles,world]);
  const visible=useChunkVisibility(x,z);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group ref={visible}><mesh geometry={geometry} material={material} receiveShadow /></group>;
}

export function WaterSurface({world,game}:{world:WorldData;game:Game}) {
  const time=useMemo<THREE.IUniform<number>>(()=>({value:0}),[]);
  const artwork=useMemo<THREE.IUniform<number>>(()=>({value:0.55}),[]);
  const material=useMemo(()=>animatedWaterMaterial(time,artwork),[time,artwork]);
  const chunks=useMemo(()=>{
    const width=WORLD_SIZE/CHUNK_SIZE;
    const groups=Array.from({length:width*width},()=>[] as Tile[]);
    for(const tile of world.tiles)if(tile.terrain==='water')
      groups[Math.floor(tile.z/CHUNK_SIZE)*width+Math.floor(tile.x/CHUNK_SIZE)].push(tile);
    return groups;
  },[world]);
  useEffect(()=>()=>material.dispose(),[material]);
  useFrame(({clock})=>{
    time.value=game.save?.elapsed??clock.elapsedTime;
    const hour=game.hour;
    const daylight=THREE.MathUtils.clamp((hour-5)/2.5,0,1)*THREE.MathUtils.clamp((20-hour)/2.5,0,1);
    artwork.value=0.72-0.16*daylight;
  });
  const width=WORLD_SIZE/CHUNK_SIZE;
  return <group>{chunks.map((tiles,index)=>tiles.length>0&&
    <WaterChunk key={index} tiles={tiles} world={world} x={index%width} z={Math.floor(index/width)} material={material}/>)}</group>;
}
