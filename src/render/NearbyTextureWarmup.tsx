import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Game } from '../game/game';
import { propAsset } from '../game/assets';
import { WorldData } from '../game/world';
import { imageTexture } from './art';
import { CHUNK_SIZE } from './ChunkVisibility';

// Decode happens when the world mounts; upload nearby art to the GPU during
// browser idle time so crossing a chunk border is less likely to pause a frame.
export function NearbyTextureWarmup({game,world}:{game:Game;world:WorldData}) {
  const {gl}=useThree();
  const assetsByChunk=useMemo(()=>{
    const width=Math.ceil(world.size/CHUNK_SIZE);
    const chunks=Array.from({length:width*width},()=>new Set<string>());
    const add=(x:number,z:number,asset:string|null)=>{
      if(asset)chunks[Math.floor(z/CHUNK_SIZE)*width+Math.floor(x/CHUNK_SIZE)].add(asset);
    };
    for(const tile of world.tiles)add(tile.x,tile.z,propAsset(tile));
    for(const place of world.places)add(place.x,place.z,place.id);
    for(const decoration of world.decorations)add(decoration.x,decoration.z,decoration.id);
    return {chunks,width};
  },[world]);

  useEffect(()=>{
    const warmed=new Set<string>();
    let nearby:string[]=[];
    let lastChunk=-1;
    let pendingIdle=0;
    const refreshNearby=()=>{
      const cx=Math.floor(game.player.x/CHUNK_SIZE);
      const cz=Math.floor(game.player.z/CHUNK_SIZE);
      const current=cz*assetsByChunk.width+cx;
      if(current===lastChunk)return;
      lastChunk=current;
      const found=new Set<string>();
      // Center first, then the next two rings the player could walk into.
      for(let radius=0;radius<=2;radius++)for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
        const x=cx+dx,z=cz+dz;
        if(x<0||z<0||x>=assetsByChunk.width||z>=assetsByChunk.width)continue;
        for(const asset of assetsByChunk.chunks[z*assetsByChunk.width+x])found.add(asset);
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
}
