import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { HEIGHT_STEP, tileAt, type WorldData, WORLD_SIZE } from '../game/world';
import { TILE_ATLAS } from '../game/biomeArt';
import { biomeProfile, cliffIndex, overlayIndices, terrainIndex } from './terrainPalette';
import { terrainBrushTexture, urbanBrushTexture } from './TerrainBrush';
import { terrainAtlas } from './art';
import { withCloudShadows } from './CloudShadows';
import { CHUNK_SIZE, useChunkVisibility } from './ChunkVisibility';
import { WorldStore } from '../game/worldStore';
import { markGroundStencil } from './assetPositionCalibration';

const CHUNK = CHUNK_SIZE;
const SURFACE = 0.1;

function hash(x:number,z:number,seed:number):number {
  let value=Math.imul(x+seed,73856093)^Math.imul(z-seed,19349663);
  value=Math.imul(value^(value>>>13),1274126177);
  return (value>>>0)/4294967295;
}
function surfaceTone(x:number,z:number,seed:number):number {
  const nx=x/9,nz=z/9,ix=Math.floor(nx),iz=Math.floor(nz);
  const fx=(nx-ix)**2*(3-2*(nx-ix)),fz=(nz-iz)**2*(3-2*(nz-iz));
  const a=hash(ix,iz,seed)*(1-fx)+hash(ix+1,iz,seed)*fx;
  const b=hash(ix,iz+1,seed)*(1-fx)+hash(ix+1,iz+1,seed)*fx;
  return 0.94+0.12*(a*(1-fz)+b*fz);
}
function shoreTone(world:WorldData,x:number,z:number):number {
  let nearest=3;
  for(let dz=-2;dz<=1;dz++)for(let dx=-2;dx<=1;dx++){
    if(tileAt(world,x+dx,z+dz)?.terrain==='water')
      nearest=Math.min(nearest,Math.hypot(dx+0.5,dz+0.5));
  }
  return nearest<0.8?0.81:nearest<1.6?0.91:1;
}

function geometryForChunk(world: WorldData, chunkX: number, chunkZ: number): THREE.BufferGeometry {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors:number[]=[], indices: number[] = [];
  const localUvs:number[]=[],neighbors:number[]=[],parities:number[]=[],overlays:number[]=[],brushEnabled:number[]=[];
  const palette=new Map<string,number>();
  const coast=new Map<string,number>();
  const wetTone=(x:number,z:number):number=>{
    const key=`${x},${z}`;
    let value=coast.get(key);
    if(value===undefined){value=shoreTone(world,x,z);coast.set(key,value);}
    return value;
  };
  const indexFor=(tile:NonNullable<ReturnType<typeof tileAt>>):number=>{
    const key=`${tile.x},${tile.z}`;
    let value=palette.get(key);
    if(value===undefined){value=terrainIndex(world,tile);palette.set(key,value);}
    return value;
  };
  const add = (a: number[], b: number[], c: number[], d: number[], normal: number[], atlas: number,flipX=false,flipZ=false,tones:number[]=[1,1,1,1],edgeIndices:number[]=[-1,-1,-1,-1],layerIndices:number[]=[-1,-1,-1,-1],painted=0) => {
    const start=positions.length/3;
    positions.push(...a,...b,...c,...d);
    for(let i=0;i<4;i++) normals.push(...normal);
    const col=atlas%TILE_ATLAS.columns,row=Math.floor(atlas/TILE_ATLAS.columns),padX=0.5/192,padY=0.5/(48*TILE_ATLAS.rows);
    const left=col/4+padX,right=(col+1)/4-padX,bottom=1-(row+1)/TILE_ATLAS.rows+padY,top=1-row/TILE_ATLAS.rows-padY;
    const u0=flipX?right:left,u1=flipX?left:right,v0=flipZ?top:bottom,v1=flipZ?bottom:top;
    uvs.push(u0,v1,u1,v1,u1,v0,u0,v0);
    for(const tone of tones)colors.push(tone,tone,tone);
    localUvs.push(0,0,1,0,1,1,0,1);
    for(let i=0;i<4;i++){
      neighbors.push(...edgeIndices);
      parities.push(flipX?1:0,flipZ?1:0);
      overlays.push(...layerIndices);
      brushEnabled.push(painted);
    }
    indices.push(start,start+1,start+2,start,start+2,start+3);
  };
  for(let z=chunkZ*CHUNK;z<(chunkZ+1)*CHUNK;z++) {
    for(let x=chunkX*CHUNK;x<(chunkX+1)*CHUNK;x++) {
      const tile=tileAt(world,x,z);
      if(!tile)continue;
      if(tile.terrain==='water')continue;
      const y=SURFACE+tile.height*HEIGHT_STEP;
      const ownIndex=indexFor(tile);
      const edgeIndices=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dz])=>{
        const other=tileAt(world,x+dx,z+dz);
        if(!other||other.height!==tile.height||!['grass','stone','path','ramp'].includes(tile.terrain)||
          !['grass','stone','path','ramp'].includes(other.terrain))return -1;
        const otherIndex=indexFor(other);
        return otherIndex===ownIndex?-1:otherIndex;
      });
      add([x,y,z],[x+1,y,z],[x+1,y,z+1],[x,y,z+1],[0,1,0],ownIndex,x%2===1,z%2===1,[
        surfaceTone(x,z,world.seed)*wetTone(x,z),
        surfaceTone(x+1,z,world.seed)*wetTone(x+1,z),
        surfaceTone(x+1,z+1,world.seed)*wetTone(x+1,z+1),
        surfaceTone(x,z+1,world.seed)*wetTone(x,z+1)
      ],edgeIndices,overlayIndices(tile),
        ['grass','stone','path','ramp'].includes(tile.terrain)||
        (tile.terrain==='plaza'&&ownIndex===biomeProfile(tile).base)?
          (x>=0&&z>=0&&x<WORLD_SIZE&&z<WORLD_SIZE?1:2):0);
      const neighbors=[
        {dx:0,dz:-1,n:[0,0,-1],a:[x,y,z],b:[x+1,y,z],c:[x+1,0,z],d:[x,0,z]},
        {dx:1,dz:0,n:[1,0,0],a:[x+1,y,z],b:[x+1,y,z+1],c:[x+1,0,z+1],d:[x+1,0,z]},
        {dx:0,dz:1,n:[0,0,1],a:[x+1,y,z+1],b:[x,y,z+1],c:[x,0,z+1],d:[x+1,0,z+1]},
        {dx:-1,dz:0,n:[-1,0,0],a:[x,y,z+1],b:[x,y,z],c:[x,0,z],d:[x,0,z+1]}
      ];
      for(const edge of neighbors) {
        const other=tileAt(world,x+edge.dx,z+edge.dz);
        const otherY=other && other.terrain!=='water' ? SURFACE+other.height*HEIGHT_STEP : 0.03;
        if(otherY>=y-0.01) continue;
        const wall=cliffIndex(world,tile);
        let top=y,level=0;
        while(top-otherY>0.01){
          let bottom=Math.max(otherY,top-HEIGHT_STEP);
          const wetLine=other?.terrain==='water'?otherY+0.19:0;
          if(wetLine>otherY&&bottom<wetLine&&top>wetLine+0.01)bottom=wetLine;
          const face=edge.n[0]>0?0.84:edge.n[2]>0?0.9:0.97;
          const wet=other?.terrain==='water'&&top<=wetLine+0.01;
          const upper=wet?0.69*face:0.98*face;
          const lower=wet?0.55*face:0.73*face;
          add([edge.a[0],top,edge.a[2]],[edge.b[0],top,edge.b[2]],
            [edge.c[0],bottom,edge.c[2]],[edge.d[0],bottom,edge.d[2]],edge.n,wall,
            (x+z)%2===1,level%2===1,[upper,upper,lower,lower]);
          top=bottom;level++;
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('terrainLocalUv',new THREE.Float32BufferAttribute(localUvs,2));
  geometry.setAttribute('terrainNeighbors',new THREE.Float32BufferAttribute(neighbors,4));
  geometry.setAttribute('terrainParity',new THREE.Float32BufferAttribute(parities,2));
  geometry.setAttribute('terrainOverlays',new THREE.Float32BufferAttribute(overlays,4));
  geometry.setAttribute('terrainBrushEnabled',new THREE.Float32BufferAttribute(brushEnabled,1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function TerrainChunk({world,x,z,material,revision}:{world:WorldData;x:number;z:number;material:THREE.Material;revision:number}) {
  const geometry=useMemo(()=>geometryForChunk(world,x,z),[world,x,z,revision]);
  const visibility=useChunkVisibility(x,z);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group ref={visibility}><mesh geometry={geometry} material={material} receiveShadow castShadow /></group>;
}

export const TerrainChunks=memo(function TerrainChunks({world,revision=0}:{world:WorldData;revision?:number}) {
  const brush=useMemo(()=>terrainBrushTexture(world),[world]);
  useEffect(()=>()=>brush.dispose(),[brush]);
  const urbanBrush=useMemo(()=>urbanBrushTexture(world),[world]);
  useEffect(()=>()=>urbanBrush.dispose(),[urbanBrush]);
  const material=useMemo(()=>{
    const atlas=terrainAtlas();
    const surface=withCloudShadows(new THREE.MeshLambertMaterial({map:atlas,emissiveMap:atlas,emissive:'#ffffff',emissiveIntensity:0.13,vertexColors:true,side:THREE.DoubleSide}),true);
    const cloudCompile=surface.onBeforeCompile.bind(surface);
    surface.onBeforeCompile=(shader,renderer)=>{
      cloudCompile(shader,renderer);
      shader.uniforms.uGroundBrush={value:brush};
      shader.uniforms.uUrbanBrush={value:urbanBrush};
      shader.uniforms.uWorldSeed={value:world.seed};
      shader.vertexShader=`attribute vec2 terrainLocalUv;
        attribute vec4 terrainNeighbors;
        attribute vec2 terrainParity;
        attribute vec4 terrainOverlays;
        attribute float terrainBrushEnabled;
        varying vec2 vTerrainLocalUv;
        varying vec4 vTerrainNeighbors;
        varying vec2 vTerrainParity;
        varying vec4 vTerrainOverlays;
        varying float vTerrainBrushEnabled;
        varying float vTerrainElevation;\n${shader.vertexShader}`.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         vTerrainLocalUv=terrainLocalUv;
         vTerrainNeighbors=terrainNeighbors;
         vTerrainParity=terrainParity;
         vTerrainOverlays=terrainOverlays;
         vTerrainBrushEnabled=terrainBrushEnabled;
         vTerrainElevation=position.y;`);
      shader.fragmentShader=`varying vec2 vTerrainLocalUv;
        varying vec4 vTerrainNeighbors;
        varying vec2 vTerrainParity;
        varying vec4 vTerrainOverlays;
        varying float vTerrainBrushEnabled;
        varying float vTerrainElevation;
        uniform sampler2D uGroundBrush;
        uniform sampler2D uUrbanBrush;
        uniform float uWorldSeed;
        float terrainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uWorldSeed*0.0031)*43758.5453);}
        float terrainNoise(vec2 p){
          vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
          return mix(mix(terrainHash(i),terrainHash(i+vec2(1.0,0.0)),f.x),
            mix(terrainHash(i+vec2(0.0,1.0)),terrainHash(i+vec2(1.0,1.0)),f.x),f.y);
        }
        vec2 terrainAtlasUv(float index,vec2 local,vec2 parity){
          float col=mod(index,4.0),row=floor(index/4.0);
          vec2 sampleLocal=vec2(parity.x>0.5?1.0-local.x:local.x,
            parity.y>0.5?local.y:1.0-local.y);
          return vec2((col+0.0104+sampleLocal.x*0.9792)/4.0,
            1.0-(row+1.0)/20.0+(0.0104+sampleLocal.y*0.9792)/20.0);
        }\n${shader.fragmentShader}`.replace('#include <map_fragment>',`
        #ifdef USE_MAP
          vec4 terrainColor=texture2D(map,vMapUv);
          float north=vTerrainNeighbors.x<0.0?0.0:0.5*(1.0-smoothstep(0.0,0.78,vTerrainLocalUv.y));
          float east=vTerrainNeighbors.y<0.0?0.0:0.5*(1.0-smoothstep(0.0,0.78,1.0-vTerrainLocalUv.x));
          float south=vTerrainNeighbors.z<0.0?0.0:0.5*(1.0-smoothstep(0.0,0.78,1.0-vTerrainLocalUv.y));
          float west=vTerrainNeighbors.w<0.0?0.0:0.5*(1.0-smoothstep(0.0,0.78,vTerrainLocalUv.x));
          terrainColor*=max(0.0,1.0-north-east-south-west);
          if(north>0.001)terrainColor+=north*texture2D(map,terrainAtlasUv(vTerrainNeighbors.x,vec2(vTerrainLocalUv.x,1.0-vTerrainLocalUv.y),vec2(vTerrainParity.x,1.0-vTerrainParity.y)));
          if(east>0.001)terrainColor+=east*texture2D(map,terrainAtlasUv(vTerrainNeighbors.y,vec2(1.0-vTerrainLocalUv.x,vTerrainLocalUv.y),vec2(1.0-vTerrainParity.x,vTerrainParity.y)));
          if(south>0.001)terrainColor+=south*texture2D(map,terrainAtlasUv(vTerrainNeighbors.z,vec2(vTerrainLocalUv.x,1.0-vTerrainLocalUv.y),vec2(vTerrainParity.x,1.0-vTerrainParity.y)));
          if(west>0.001)terrainColor+=west*texture2D(map,terrainAtlasUv(vTerrainNeighbors.w,vec2(1.0-vTerrainLocalUv.x,vTerrainLocalUv.y),vec2(1.0-vTerrainParity.x,vTerrainParity.y)));
          if(vTerrainBrushEnabled>0.5){
            vec2 brushWarp=vec2(
              sin(vCloudWorldXZ.y*2.1+sin(vCloudWorldXZ.x*1.3)),
              cos(vCloudWorldXZ.x*1.8+sin(vCloudWorldXZ.y*1.5)))*0.13;
            vec4 paint;
            if(vTerrainBrushEnabled<1.5){
              paint=texture2D(uGroundBrush,(vCloudWorldXZ+brushWarp)/96.0);
            }else{
              vec2 p=vCloudWorldXZ+brushWarp;
              float dense=0.63*smoothstep(0.39,0.71,terrainNoise(p/13.0));
              float feature=0.42*smoothstep(0.47,0.72,terrainNoise(p/9.0+vec2(7.1,3.4)));
              float accent=0.3*smoothstep(0.57,0.79,terrainNoise(p/4.0+vec2(2.8,8.2)));
              float trailX=p.x+sin(p.y/32.0+uWorldSeed*0.01)*9.0+
                sin(p.y/13.0+uWorldSeed*0.013)*3.0;
              float trailZ=p.y+sin(p.x/39.0+uWorldSeed*0.01)*10.0+
                sin(p.x/17.0+uWorldSeed*0.017)*3.0;
              float trailDistance=min(abs(trailX-floor(trailX/135.0+0.5)*135.0),
                abs(trailZ-floor(trailZ/151.0+0.5)*151.0));
              float road=1.0-smoothstep(0.22,1.35,trailDistance+
                (terrainNoise(p/4.0+vec2(9.0,2.0))-0.5)*0.35);
              float hillFade=1.0-smoothstep(2.4,4.5,vTerrainElevation);
              paint=vec4(road*(0.34+0.28*hillFade),dense,feature,accent);
              vec2 edgePoint=clamp(p,vec2(0.5),vec2(95.5));
              float seam=max(max(max(0.0,-p.x),max(0.0,p.x-96.0)),
                max(max(0.0,-p.y),max(0.0,p.y-96.0)));
              paint=mix(texture2D(uGroundBrush,edgePoint/96.0),paint,smoothstep(0.0,6.0,seam));
            }
            vec2 tileLocal=vTerrainLocalUv;
            if(paint.g>0.003)terrainColor=mix(terrainColor,
              texture2D(map,terrainAtlasUv(vTerrainOverlays.y,tileLocal,vTerrainParity)),paint.g);
            if(paint.b>0.003)terrainColor=mix(terrainColor,
              texture2D(map,terrainAtlasUv(vTerrainOverlays.z,tileLocal,vTerrainParity)),paint.b);
            if(paint.a>0.003)terrainColor=mix(terrainColor,
              texture2D(map,terrainAtlasUv(vTerrainOverlays.w,tileLocal,vTerrainParity)),paint.a);
            vec2 cityWarp=vec2(
              sin(vCloudWorldXZ.y*1.83+sin(vCloudWorldXZ.x*1.17)),
              cos(vCloudWorldXZ.x*1.59+sin(vCloudWorldXZ.y*1.27)))*0.25;
            float cityPaint=vTerrainBrushEnabled<1.5?
              texture2D(uUrbanBrush,(vCloudWorldXZ+cityWarp)/96.0).r:0.0;
            float city=smoothstep(0.05,0.91,cityPaint);
            if(city>0.003)terrainColor=mix(terrainColor,
              texture2D(map,terrainAtlasUv(4.0,tileLocal,vTerrainParity)),city);
            float road=smoothstep(0.09,0.82,paint.r);
            if(road>0.003)terrainColor=mix(terrainColor,
              texture2D(map,terrainAtlasUv(vTerrainOverlays.x,tileLocal,vTerrainParity)),road);
          }
          diffuseColor*=terrainColor;
        #endif
      `);
    };
    surface.customProgramCacheKey=()=> 'terrain-world-brush-v4-continuous-exterior';
    return markGroundStencil(surface);
  },[brush,urbanBrush]);
  useEffect(()=>()=>material.dispose(),[material]);
  const chunks=[];
  for(let z=0;z<WORLD_SIZE/CHUNK;z++) for(let x=0;x<WORLD_SIZE/CHUNK;x++) {
    chunks.push(<TerrainChunk key={x+'-'+z} world={world} x={x} z={z} material={material}
      revision={world instanceof WorldStore?world.getChunkRevision(x,z):revision}/>);
  }
  if(world instanceof WorldStore)for(const chunk of world.visibleChunks())
    chunks.push(<TerrainChunk key={`${chunk.x},${chunk.z}`} world={world} x={chunk.x} z={chunk.z} material={material}
      revision={world.getChunkRevision(chunk.x,chunk.z)}/>);
  return <group>{chunks}</group>;
});
