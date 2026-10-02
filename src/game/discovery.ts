import type { SaveData } from './save';
import { CHUNK_SIZE, WORLD_SIZE, index } from './world';
import { chunkKey, chunkOf } from './chunkWorld';
const coreSeen=new WeakMap<SaveData,Set<number>>();

export function markDiscovered(save:SaveData,x:number,z:number):void{
  if(x>=0&&z>=0&&x<WORLD_SIZE&&z<WORLD_SIZE){
    let seen=coreSeen.get(save);
    if(!seen){seen=new Set(save.discovered);coreSeen.set(save,seen);}
    const id=index(x,z);
    if(!seen.has(id)){seen.add(id);save.discovered.push(id);}
    return;
  }
  const cx=chunkOf(x),cz=chunkOf(z),key=chunkKey(cx,cz);
  const bit=(z-cz*CHUNK_SIZE)*CHUNK_SIZE+x-cx*CHUNK_SIZE;
  const nibble=Math.floor(bit/4),mask=1<<(bit%4);
  const existing=save.discoveredChunks[key]??'0'.repeat(64);
  const value=parseInt(existing[nibble]??'0',16)|mask;
  save.discoveredChunks[key]=existing.slice(0,nibble)+value.toString(16)+existing.slice(nibble+1);
}

export function isDiscovered(save:Pick<SaveData,'discovered'|'discoveredChunks'>,x:number,z:number,core?:ReadonlySet<number>):boolean{
  if(x>=0&&z>=0&&x<WORLD_SIZE&&z<WORLD_SIZE)
    return core?core.has(index(x,z)):save.discovered.includes(index(x,z));
  const cx=chunkOf(x),cz=chunkOf(z),key=chunkKey(cx,cz);
  const bit=(z-cz*CHUNK_SIZE)*CHUNK_SIZE+x-cx*CHUNK_SIZE;
  return !!(parseInt(save.discoveredChunks[key]?.[Math.floor(bit/4)]??'0',16)&(1<<(bit%4)));
}
