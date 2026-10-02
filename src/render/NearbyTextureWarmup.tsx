import { memo, useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Game } from '../game/game';
import { propAsset } from '../game/assets';
import { WorldData } from '../game/world';
import { imageTexture } from './art';
import { CHUNK_SIZE } from './ChunkVisibility';
import { chunkKey } from '../game/chunkWorld';
import { WorldStore } from '../game/worldStore';

// Decode happens when the world mounts; upload nearby art to the GPU during
// browser idle time so crossing a chunk border is less likely to pause a frame.
export const NearbyTextureWarmup=memo(function NearbyTextureWarmup({game,world,revision=0}:{game:Game;world:WorldData;revision?:number}) {
  const {gl}=useThree();
  const warmedRef=useRef(new Set<string>());
  const assetsByChunk=useMemo(()=>{
    const chunks=new Map<string,Set<string>>();
    const add=(x:number,z:number,asset:string|null)=>{
      if(!asset)return;
      const key=chunkKey(Math.floor(x/CHUNK_SIZE),Math.floor(z/CHUNK_SIZE));
      let assets=chunks.get(key);
      if(!assets){assets=new Set();chunks.set(key,assets);}
      assets.add(asset);
    };
    for(const tile of world.tiles)add(tile.x,tile.z,propAsset(tile));
    if(world instanceof WorldStore)for(const chunk of world.chunks.values())
      for(const tile of chunk.tiles)add(tile.x,tile.z,propAsset(tile));
    for(const place of world.places)add(place.x,place.z,place.id);
    for(const decoration of world.decorations)add(decoration.x,decoration.z,decoration.id);
    return chunks;
  },[world,revision]);

  useEffect(()=>{
    const warmed=warmedRef.current;
    let nearby:string[]=[];
    let lastChunk='';
    let pendingIdle=0;
    const refreshNearby=()=>{
      const cx=Math.floor(game.player.x/CHUNK_SIZE);
      const cz=Math.floor(game.player.z/CHUNK_SIZE);
      const current=chunkKey(cx,cz);
      if(current===lastChunk)return;
      lastChunk=current;
      const found=new Set<string>();
      // Center first, then the next two rings the player could walk into.
      for(let radius=0;radius<=2;radius++)for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
        const x=cx+dx,z=cz+dz;
        for(const asset of assetsByChunk.get(chunkKey(x,z))??[])found.add(asset);
      }
      nearby=[...found];
    };
    const uploadOne=()=>{
      pendingIdle=0;
      if(document.hidden||game.mode==='battle')return;
      refreshNearby();
      for(const asset of nearby){
        if(warmed.has(asset))continue;
        const texture=imageTexture(`/art/environment/${asset}.png`);
        const image=texture.image as HTMLImageElement|undefined;
        if(!image?.complete||!image.naturalWidth)continue;
        gl.initTexture(texture);
        warmed.add(asset);
        break;
      }
    };
    const interval=window.setInterval(()=>{
      if(document.hidden||game.mode==='battle'||pendingIdle)return;
      if('requestIdleCallback' in window){
        pendingIdle=window.requestIdleCallback(deadline=>{
          pendingIdle=0;
          if(deadline.timeRemaining()>3)uploadOne();
        });
      }else uploadOne();
    },180);
    return()=>{
      window.clearInterval(interval);
      if(pendingIdle)window.cancelIdleCallback(pendingIdle);
    };
  },[assetsByChunk,game,gl]);
  return null;
});
