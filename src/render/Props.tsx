import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HEIGHT_STEP, type Decoration, type Place, type Tile, type WorldData } from '../game/world';
import { imageTexture, treeWindTexture } from './art';
import { withCloudShadows } from './CloudShadows';
import { withSpriteDepth } from './spriteDepth';
import { CHUNK_SIZE, useChunkVisibility } from './ChunkVisibility';
import { WorldStore } from '../game/worldStore';
import type { WorldChunk } from '../game/chunkWorld';
import { Game } from '../game/game';
import { placeSize, PROP_SIZE } from '../game/assets';
import { SPRITE_FACING, SPRITE_UP } from './camera';
import { makeProjectedShadowGeometry, projectedShadowMaterial } from './ProjectedShadows';
import { calibratedCasterHeight, shadowGroupForAsset, shadowGroupOffset } from './shadowCalibration';
import { battlePropOpacity } from './battlePropOpacity';
import { TREE_WIND_PHASES, treeWindBucket, treeWindConfig, treeWindFrame, type TreeWindAsset } from './treeAnimations';

const propArt: {asset:string;size:number;matches:(tile:Tile)=>boolean}[] = Object.entries(PROP_SIZE).map(([asset,size])=>({
  asset,size,
  matches:(tile:Tile)=>asset==='willow'?tile.prop==='tree'&&tile.biome==='lago':
    asset==='tree'?tile.prop==='tree'&&tile.biome!=='lago':tile.prop===asset
}));

function InstancedProp({tiles,asset,size,game,world,phaseBucket=0,fading=false}:{tiles:Tile[];asset:string;size:number;game:Game;world:WorldData;phaseBucket?:number;fading?:boolean}) {
  const ref=useRef<THREE.InstancedMesh>(null);
  const ghostRef=useRef<THREE.InstancedMesh>(null);
  const faded=useRef(new Set<number>());
  const lastCheck=useRef(0);
  const windFrame=useRef(-1);
  const canFade=size>=3;
  const ghostLimit=canFade?Math.min(16,tiles.length):0;
  const visualHeight=size;
  const shadowGroup=shadowGroupForAsset(asset);
  const shadowOffset=shadowGroupOffset(shadowGroup);
  const wind=treeWindConfig(asset);
  const initialArt=wind?treeWindTexture(asset as TreeWindAsset):imageTexture(`/art/environment/${asset}.png`);
  const footV=imageTexture(`/art/environment/${asset}.png`).userData.footV as number;
  const geometry=useMemo(()=>new THREE.PlaneGeometry(size,visualHeight),[size,visualHeight]);
  const shadowGeometry=useMemo(()=>makeProjectedShadowGeometry(world,tiles.map(tile=>({
    x:tile.x+0.5+shadowOffset.x,z:tile.z+0.5+shadowOffset.z,y:0.1+tile.height*HEIGHT_STEP
  })),size,calibratedCasterHeight(visualHeight,shadowGroup),footV),[world,tiles,asset,size,visualHeight,footV]);
  const shadowMaterial=useMemo(()=>{
    const material=projectedShadowMaterial(initialArt);
    material.uniforms.uRepeat.value.copy(initialArt.repeat);
    material.uniforms.uOffset.value.copy(initialArt.offset);
    return material;
  },[initialArt]);
  useLayoutEffect(()=>()=>{geometry.dispose();shadowGeometry.dispose();shadowMaterial.dispose();},[geometry,shadowGeometry,shadowMaterial]);
  const material=useMemo(()=>{const art=initialArt;return withSpriteDepth(withCloudShadows(new THREE.MeshLambertMaterial({
    map:art,emissiveMap:art,emissive:'#ffffff',emissiveIntensity:0.3,
    transparent:true,alphaTest:fading?0.01:0.2,side:THREE.DoubleSide,depthWrite:true
  })));},[initialArt,fading]);
  const ghostMaterial=useMemo(()=>{if(!canFade)return null;const art=initialArt;return withSpriteDepth(withCloudShadows(new THREE.MeshLambertMaterial({
    map:art,emissiveMap:art,emissive:'#ffffff',emissiveIntensity:0.3,
    transparent:true,opacity:0.42,alphaTest:0.16,side:THREE.DoubleSide,depthWrite:false
  })));},[initialArt,canFade]);
  useLayoutEffect(()=>()=>{material.dispose();ghostMaterial?.dispose();},[material,ghostMaterial]);
  useLayoutEffect(()=>{
    if(!ref.current)return;
    const dummy=new THREE.Object3D();
    tiles.forEach((tile,i)=>{
      dummy.position.set(tile.x+0.5,0.1+tile.height*HEIGHT_STEP,tile.z+0.5)
        .addScaledVector(SPRITE_UP,visualHeight*(0.5-footV));
      dummy.quaternion.copy(SPRITE_FACING);
      dummy.scale.set(1,1,1);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i,dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate=true;
    ref.current.computeBoundingSphere();
    if(ghostRef.current){
      for(let i=0;i<ghostLimit;i++){
        dummy.scale.setScalar(0);dummy.updateMatrix();
        ghostRef.current.setMatrixAt(i,dummy.matrix);
      }
      ghostRef.current.instanceMatrix.needsUpdate=true;
      ghostRef.current.visible=false;
    }
    faded.current.clear();
  },[tiles,visualHeight,ghostLimit,footV]);
  useFrame(({clock})=>{
    if(wind&&ref.current?.parent?.visible){
      const frame=treeWindFrame(asset as TreeWindAsset,clock.elapsedTime,phaseBucket);
      if(frame!==windFrame.current){
        windFrame.current=frame;
        const art=treeWindTexture(asset as TreeWindAsset,frame);
        material.map=art;
        material.emissiveMap=art;
        material.needsUpdate=true;
        if(ghostMaterial){
          ghostMaterial.map=art;
          ghostMaterial.emissiveMap=art;
          ghostMaterial.needsUpdate=true;
        }
        shadowMaterial.uniforms.uTexture.value=art;
        shadowMaterial.uniforms.uRepeat.value.copy(art.repeat);
        shadowMaterial.uniforms.uOffset.value.copy(art.offset);
      }
    }
    if(!ref.current||!ghostRef.current||!canFade||!ref.current.parent?.visible||clock.elapsedTime-lastCheck.current<0.12)return;
    lastCheck.current=clock.elapsedTime;
    const player=game.player;
    const candidates=(game.mode==='explore'||(game.mode==='pause'&&!game.battle))?tiles.map((tile,i)=>{
      const dx=tile.x+0.5-player.x,dz=tile.z+0.5-player.z;
      return {i,dx,dz,distance:Math.hypot(dx,dz)};
    }).filter(({dx,dz,distance})=>distance<Math.max(2.7,size*(wind?1.12:0.82))&&
      (dx+dz)*Math.SQRT1_2>(wind?-0.15:0.15)&&
      Math.abs((dx-dz)*Math.SQRT1_2)<size*(wind?0.56:0.4))
      .sort((a,b)=>a.distance-b.distance).slice(0,ghostLimit):[];
    const next=new Set(candidates.map(item=>item.i));
    if(next.size===faded.current.size&&[...next].every(i=>faded.current.has(i)))return;
    const dummy=new THREE.Object3D();
    for(const i of new Set([...faded.current,...next])){
      const tile=tiles[i];
      dummy.position.set(tile.x+0.5,0.1+tile.height*HEIGHT_STEP,tile.z+0.5)
        .addScaledVector(SPRITE_UP,visualHeight*(0.5-footV));
      dummy.quaternion.copy(SPRITE_FACING);
      dummy.scale.setScalar(next.has(i)?0:1);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i,dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate=true;
    for(let slot=0;slot<ghostLimit;slot++){
      const tile=candidates[slot]&&tiles[candidates[slot].i];
      if(tile)dummy.position.set(tile.x+0.5,0.1+tile.height*HEIGHT_STEP,tile.z+0.5)
        .addScaledVector(SPRITE_UP,visualHeight*(0.5-footV));
      dummy.quaternion.copy(SPRITE_FACING);
      dummy.scale.setScalar(tile?1:0);
      dummy.updateMatrix();
      ghostRef.current.setMatrixAt(slot,dummy.matrix);
    }
    ghostRef.current.instanceMatrix.needsUpdate=true;
    ghostRef.current.visible=candidates.length>0;
    faded.current=next;
  });
  if(!tiles.length)return null;
  return <>
    <mesh geometry={shadowGeometry} material={shadowMaterial} renderOrder={3}/>
    <instancedMesh ref={ref} args={[geometry,material,tiles.length]} receiveShadow/>
    {canFade&&ghostMaterial?<instancedMesh ref={ghostRef} args={[geometry,ghostMaterial,ghostLimit]} renderOrder={8} frustumCulled={false}/>:null}
  </>;
}

function PlaceArt({place,world,fading=false}:{place:Place|Decoration;world:WorldData;fading?:boolean}) {
  const meshRef=useRef<THREE.Mesh>(null);
  const tile=world.tiles[place.z*world.size+place.x];
  const size=placeSize(place);
  const visualHeight=size;
  // Large buildings need stable subpixel sampling as the camera glides.
  const building=place.kind==='house'||place.id.startsWith('casa-')||
    place.id==='woodcutter-hut'||place.id==='boathouse';
  const art=imageTexture(`/art/environment/${place.id}.png`,building);
  const shadowGroup=place.kind==='house'?'casas':shadowGroupForAsset(place.id);
  const shadowOffset=shadowGroupOffset(shadowGroup);
  const footV=art.userData.footV as number;
  const shadowGeometry=useMemo(()=>makeProjectedShadowGeometry(world,[{
    x:place.x+0.5+shadowOffset.x,z:place.z+0.5+shadowOffset.z,y:0.1+tile.height*HEIGHT_STEP
  }],size,calibratedCasterHeight(visualHeight,shadowGroup),footV),
    [world,place.x,place.z,place.id,place.kind,size,visualHeight,tile.height,footV]);
  const shadowMaterial=useMemo(()=>{
    const material=projectedShadowMaterial(art);
    material.uniforms.uAlphaCut.value=0.14;
    return material;
  },[art]);
  useLayoutEffect(()=>()=>{shadowGeometry.dispose();shadowMaterial.dispose();},[shadowGeometry,shadowMaterial]);
  const material=useMemo(()=>withSpriteDepth(withCloudShadows(new THREE.MeshLambertMaterial({
    map:art,emissiveMap:art,emissive:'#ffffff',emissiveIntensity:0.3,
    transparent:true,alphaTest:fading?0.01:0.14,side:THREE.DoubleSide,depthWrite:true
  }))),[art,fading]);
  useLayoutEffect(()=>()=>material.dispose(),[material]);
  const matrix=useMemo(()=>new THREE.Matrix4().compose(
    new THREE.Vector3(place.x+0.5,0.1+tile.height*HEIGHT_STEP,place.z+0.5)
      .addScaledVector(SPRITE_UP,visualHeight*(0.5-footV)),
    SPRITE_FACING,new THREE.Vector3(1,1,1)),
    [place.x,place.z,tile.height,visualHeight,footV]);
  useLayoutEffect(()=>{
    if(!meshRef.current)return;
    meshRef.current.matrix.copy(matrix);
    meshRef.current.matrixWorldNeedsUpdate=true;
  },[matrix]);
  return <>
    <mesh geometry={shadowGeometry} material={shadowMaterial} renderOrder={3}/>
    <mesh ref={meshRef} matrixAutoUpdate={false} material={material} receiveShadow>
      <planeGeometry args={[size,visualHeight]}/>
    </mesh>
  </>;
}

interface ArenaCutout { x:number; z:number; radius:number }

function outsideArena(x:number,z:number,size:number,arena?:ArenaCutout):boolean {
  return !arena || Math.hypot(x+0.5-arena.x,z+0.5-arena.z)>arena.radius+size*0.85;
}

function chunkTouchesArena(x:number,z:number,arena:ArenaCutout):boolean {
  const nearestX=THREE.MathUtils.clamp(arena.x,x*CHUNK_SIZE,(x+1)*CHUNK_SIZE);
  const nearestZ=THREE.MathUtils.clamp(arena.z,z*CHUNK_SIZE,(z+1)*CHUNK_SIZE);
  return Math.hypot(nearestX-arena.x,nearestZ-arena.z)<=arena.radius+6.5;
}

const PropChunk=memo(function PropChunk({tiles,places,world,x,z,arena,game,part,revision}:{tiles:Tile[];places:(Place|Decoration)[];world:WorldData;x:number;z:number;arena?:ArenaCutout;game:Game;part:'inside'|'outside';revision:number}) {
  const visibility=useChunkVisibility(x,z,8);
  const groups=useMemo(()=>propArt.flatMap(config=>{
    const matching=tiles.filter(tile=>config.matches(tile)&&
      outsideArena(tile.x,tile.z,config.size,arena)===(part==='outside'));
    if(!treeWindConfig(config.asset))return [{...config,tiles:matching,phaseBucket:0}];
    const buckets=Array.from({length:TREE_WIND_PHASES},()=>[] as Tile[]);
    matching.forEach(tile=>buckets[treeWindBucket(config.asset as TreeWindAsset,tile.x,tile.z)].push(tile));
    return buckets.map((group,phaseBucket)=>({...config,tiles:group,phaseBucket}));
  }),
    [tiles,part,arena?.x,arena?.z,arena?.radius,revision]);
  const visiblePlaces=useMemo(()=>places.filter(place=>outsideArena(place.x,place.z,placeSize(place),arena)===(part==='outside')),
    [places,part,arena?.x,arena?.z,arena?.radius]);
  return <group ref={visibility}>
    {groups.map(config=>config.tiles.length>0&&<InstancedProp key={`${config.asset}-${config.phaseBucket}`} tiles={config.tiles} asset={config.asset} size={config.size} game={game} world={world} phaseBucket={config.phaseBucket} fading={part==='inside'}/>)}
    {visiblePlaces.map(place=><PlaceArt key={place.id} place={place} world={world} fading={part==='inside'}/>)}
  </group>;
});

const exteriorProps=new WeakMap<WorldChunk,Tile[]>();
function propsForChunk(chunk:WorldChunk):Tile[]{
  let tiles=exteriorProps.get(chunk);
  if(!tiles){tiles=chunk.tiles.filter(tile=>!!tile.prop);exteriorProps.set(chunk,tiles);}
  return tiles;
}
export function Props({world,game,revision=0}:{world:WorldData;game:Game;revision?:number}) {
  const [arena,setArena]=useState<ArenaCutout|null>(null);
  const inside=useRef<THREE.Group>(null);
  const fade=useRef(1);
  const lastFade=useRef(-1);
  const released=useRef(false);
  const battle=game.battle;
  useEffect(()=>{
    if(!battle)return;
    fade.current=1;
    lastFade.current=-1;
    released.current=false;
    setArena({...battle.center,radius:battle.radius});
  },[battle]);
  useFrame((_,delta)=>{
    const next=battlePropOpacity(game.battle,fade.current,delta);
    fade.current=next;
    const root=inside.current;
    if(root&&(lastFade.current<0||Math.abs(next-lastFade.current)>0.002)){
      root.visible=next>0.003;
      if(root.visible)root.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return;
        const material=object.material;
        if(material instanceof THREE.ShaderMaterial){
          if(material.uniforms.uFade)material.uniforms.uFade.value=next;
        }else if(material instanceof THREE.MeshLambertMaterial){
          const base=material.userData.arenaBaseOpacity??material.opacity;
          material.userData.arenaBaseOpacity=base;
          material.opacity=base*next;
          material.depthWrite=base===1&&next>0.995;
        }
      });
      lastFade.current=next;
    }
    if(!game.battle&&arena&&next>=1&&!released.current){
      released.current=true;
      setArena(null);
    }
  });
  const coreChunks=useMemo(()=>{
    const width=Math.ceil(world.size/CHUNK_SIZE);
    const list=Array.from({length:width*width},(_,i)=>({x:i%width,z:Math.floor(i/width),tiles:[] as Tile[],places:[] as (Place|Decoration)[]}));
    for(const tile of world.tiles) {
      if(tile.prop) list[Math.floor(tile.z/CHUNK_SIZE)*width+Math.floor(tile.x/CHUNK_SIZE)].tiles.push(tile);
    }
    for(const place of world.places) list[Math.floor(place.z/CHUNK_SIZE)*width+Math.floor(place.x/CHUNK_SIZE)].places.push(place);
    for(const place of world.decorations) list[Math.floor(place.z/CHUNK_SIZE)*width+Math.floor(place.x/CHUNK_SIZE)].places.push(place);
    return list;
  },[world]);
  const outerChunks=useMemo(()=>world instanceof WorldStore?world.visibleChunks().map(chunk=>({
    x:chunk.x,z:chunk.z,tiles:propsForChunk(chunk),places:[] as (Place|Decoration)[]
  })):[],[world,revision]);
  const chunks=[...coreChunks,...outerChunks];
  const affected=chunks.map(chunk=>!!arena&&chunkTouchesArena(chunk.x,chunk.z,arena));
  return <group>
    <group>{chunks.map((chunk,index)=><PropChunk key={`${chunk.x},${chunk.z}`} tiles={chunk.tiles} places={chunk.places} world={world} x={chunk.x} z={chunk.z} arena={affected[index]?arena??undefined:undefined} game={game} part="outside" revision={world instanceof WorldStore?world.getChunkRevision(chunk.x,chunk.z):revision}/>)}</group>
    {arena?<group ref={inside}>{chunks.map((chunk,index)=>affected[index]?<PropChunk key={`${chunk.x},${chunk.z}`} tiles={chunk.tiles} places={chunk.places} world={world} x={chunk.x} z={chunk.z} arena={arena} game={game} part="inside" revision={world instanceof WorldStore?world.getChunkRevision(chunk.x,chunk.z):revision}/>:null)}</group>:null}
  </group>;
}
