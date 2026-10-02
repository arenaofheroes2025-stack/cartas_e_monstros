import { chunkKey, generateSeededChunk, type WorldChunk, type WorldPointOfInterest } from './chunkWorld';
import { CHUNK_SIZE, WORLD_SIZE, type CardCache, type Decoration, type ItemSpawn, type Place, type Point, type Tile, type WalkingNpcSpawn, type WildSpawn, type WorldData } from './world';

export type StreamQuality='high'|'low';
export interface StreamProfile { render:number;active:number;simulation:number;preload:number;cache:number }
export const STREAM_PROFILES:Record<StreamQuality,StreamProfile>={
  low:{render:1,active:1,simulation:2,preload:3,cache:4},
  high:{render:2,active:2,simulation:3,preload:4,cache:6}
};
const isCore=(x:number,z:number)=>x>=0&&x<WORLD_SIZE/CHUNK_SIZE&&z>=0&&z<WORLD_SIZE/CHUNK_SIZE;

export class WorldStore implements WorldData {
  seed:number;size:number;tiles:Tile[];start:Point;places:Place[];decorations:Decoration[];
  wild:WildSpawn[];walkers:WalkingNpcSpawn[];caches:CardCache[];items:ItemSpawn[];
  chunks=new Map<string,WorldChunk>();
  pointsOfInterest:WorldPointOfInterest[]=[];
  revision=0;
  onChunkChange:((chunk:WorldChunk,loaded:boolean)=>void)|null=null;
  onViewChange:(()=>void)|null=null;
  onError:((message:string)=>void)|null=null;
  private worker:Worker|null=null;
  private pending=new Set<string>();
  private queue:{x:number;z:number;score:number}[]=[];
  private busy=false;
  private center={x:3,z:3};
  private profile:StreamProfile=STREAM_PROFILES.low;
  private lastUpdate=0;
  private chunkChanges:Record<string,{removedItems:string[];openedCaches:string[];removedProps:string[]}>={};
  private chunkRevisions=new Map<string,number>();
  private visualReady=new Set<string>();
  private visualQueue:WorldChunk[]=[];
  private visualScheduled=false;
  private readyListeners=new Set<()=>void>();
  constructor(core:WorldData){
    this.seed=core.seed;this.size=core.size;this.tiles=core.tiles;this.start=core.start;
    this.places=core.places;this.decorations=core.decorations;this.wild=core.wild;
    this.walkers=core.walkers;this.caches=core.caches;this.items=core.items;
    if(typeof Worker!=='undefined')try{
      this.worker=new Worker(new URL('./chunkWorker.ts',import.meta.url),{type:'module'});
      this.worker.onmessage=(event:MessageEvent<{ok:boolean;chunk?:WorldChunk;x?:number;z?:number;error?:string}>)=>{
        this.busy=false;
        const result=event.data;
        if(result.ok&&result.chunk){
          this.pending.delete(chunkKey(result.chunk.x,result.chunk.z));
          if(Math.max(Math.abs(result.chunk.x-this.center.x),Math.abs(result.chunk.z-this.center.z))<=this.profile.cache)
            this.installChunk(result.chunk);
        }else{
          this.pending.delete(chunkKey(result.x??0,result.z??0));
          this.onError?.(result.error??'Falha ao gerar região.');
        }
        this.pump();
      };
      this.worker.onerror=()=>{this.worker?.terminate();this.worker=null;this.busy=false;this.pump();};
    }catch{this.worker=null;}
  }
  dispose():void{this.worker?.terminate();this.worker=null;this.queue=[];this.pending.clear();this.visualQueue=[];this.readyListeners.clear();}
  async prepareSpawn(player:Point,quality:StreamQuality):Promise<void>{
    this.updateStreaming(player,{x:0,z:0},quality,true);
    const cx=Math.floor(player.x/CHUNK_SIZE),cz=Math.floor(player.z/CHUNK_SIZE);
    const ready=()=>{
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        const x=cx+dx,z=cz+dz;
        if(!isCore(x,z)&&!this.visualReady.has(chunkKey(x,z)))return false;
      }
      return true;
    };
    if(ready())return;
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{this.readyListeners.delete(check);reject(new Error('A região demorou demais para carregar.'));},20000);
      const check=()=>{if(ready()){clearTimeout(timer);this.readyListeners.delete(check);resolve();}};
      this.readyListeners.add(check);
    });
  }
  setChunkChanges(changes:Record<string,{removedItems:string[];openedCaches:string[];removedProps:string[]}>):void{
    this.chunkChanges=changes;
    for(const [key,delta] of Object.entries(changes)){
      const [cx,cz]=key.split(',').map(Number);
      if(!isCore(cx,cz))continue;
      for(const point of delta.removedProps){
        const [x,z]=point.split(',').map(Number);
        if(x<0||z<0||x>=WORLD_SIZE||z>=WORLD_SIZE)continue;
        const tile=this.tiles[z*WORLD_SIZE+x];
        tile.prop=null;tile.blocked=false;
      }
    }
  }
  removeChunkItem(item:ItemSpawn):void{
    const chunk=this.chunks.get(chunkKey(Math.floor(item.x/CHUNK_SIZE),Math.floor(item.z/CHUNK_SIZE)));
    if(chunk)chunk.items=chunk.items.filter(entry=>entry.id!==item.id);
  }
  removeProp(x:number,z:number):boolean{
    const cx=Math.floor(x/CHUNK_SIZE),cz=Math.floor(z/CHUNK_SIZE);
    const chunk=this.chunks.get(chunkKey(cx,cz));
    const tile=isCore(cx,cz)?this.tiles[z*WORLD_SIZE+x]:
      chunk?.tiles[(z-cz*CHUNK_SIZE)*CHUNK_SIZE+x-cx*CHUNK_SIZE];
    if(!tile?.prop)return false;
    const changes=this.chunkChanges[chunkKey(cx,cz)]??={removedItems:[],openedCaches:[],removedProps:[]};
    changes.removedProps.push(`${x},${z}`);
    tile.prop=null;tile.blocked=false;
    this.touchNeighborhood(cx,cz);this.revision++;this.onViewChange?.();
    return true;
  }
  getChunkRevision(x:number,z:number):number{return this.chunkRevisions.get(chunkKey(x,z))??0;}
  private touchNeighborhood(x:number,z:number):void{
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      const key=chunkKey(x+dx,z+dz);
      this.chunkRevisions.set(key,(this.chunkRevisions.get(key)??0)+1);
    }
  }
  private scheduleVisual():void{
    if(this.visualScheduled||!this.visualQueue.length)return;
    this.visualScheduled=true;
    const activate=()=>{
      this.visualScheduled=false;
      this.visualQueue.sort((a,b)=>Math.hypot(a.x-this.center.x,a.z-this.center.z)-
        Math.hypot(b.x-this.center.x,b.z-this.center.z));
      const chunk=this.visualQueue.shift();
      if(chunk&&this.chunks.get(chunkKey(chunk.x,chunk.z))===chunk){
        this.visualReady.add(chunkKey(chunk.x,chunk.z));
        this.touchNeighborhood(chunk.x,chunk.z);
        this.revision++;
        this.onChunkChange?.(chunk,true);
        for(const listener of this.readyListeners)listener();
      }
      this.scheduleVisual();
    };
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(activate);
    else activate();
  }
  installChunk(chunk:WorldChunk):void{
    const key=chunkKey(chunk.x,chunk.z);
    if(this.chunks.has(key))return;
    const changes=this.chunkChanges[key];
    if(changes){
      const removed=new Set(changes.removedItems);
      chunk.items=chunk.items.filter(item=>!removed.has(item.id));
      const opened=new Set(changes.openedCaches);
      chunk.caches=chunk.caches.filter(cache=>!opened.has(cache.id));
      const props=new Set(changes.removedProps);
      for(const tile of chunk.tiles)if(props.has(`${tile.x},${tile.z}`)){tile.prop=null;tile.blocked=false;}
    }
    this.chunks.set(key,chunk);
    this.wild.push(...chunk.wild);this.caches.push(...chunk.caches);
    this.items.push(...chunk.items);this.pointsOfInterest.push(...chunk.pointsOfInterest);
    this.visualQueue.push(chunk);
    this.scheduleVisual();
  }
  evictChunk(chunk:WorldChunk):void{
    const key=chunkKey(chunk.x,chunk.z);
    if(!this.chunks.has(key))return;
    this.chunks.delete(key);
    const wasVisual=this.visualReady.delete(key);
    const ids=new Set(chunk.wild.map(item=>item.id));this.wild=this.wild.filter(item=>!ids.has(item.id));
    const cacheIds=new Set(chunk.caches.map(item=>item.id));this.caches=this.caches.filter(item=>!cacheIds.has(item.id));
    const itemIds=new Set(chunk.items.map(item=>item.id));this.items=this.items.filter(item=>!itemIds.has(item.id));
    const poiIds=new Set(chunk.pointsOfInterest.map(item=>item.id));
    this.pointsOfInterest=this.pointsOfInterest.filter(item=>!poiIds.has(item.id));
    if(wasVisual){this.touchNeighborhood(chunk.x,chunk.z);this.revision++;this.onChunkChange?.(chunk,false);}
  }
  private pump():void{
    if(this.busy)return;
    while(this.queue.length){
      const next=this.queue.shift()!,key=chunkKey(next.x,next.z);
      if(this.chunks.has(key)){this.pending.delete(key);continue;}
      this.busy=true;
      if(this.worker)this.worker.postMessage({seed:this.seed,x:next.x,z:next.z});
      else setTimeout(()=>{
        try{this.installChunk(generateSeededChunk(this.seed,next.x,next.z));}
        catch(error){this.onError?.(String(error));}
        finally{this.pending.delete(key);this.busy=false;this.pump();}
      },0);
      break;
    }
  }
  updateStreaming(player:Point,move:Point,quality:StreamQuality,force=false):void{
    const now=performance.now();
    const cx=Math.floor(player.x/CHUNK_SIZE),cz=Math.floor(player.z/CHUNK_SIZE);
    if(!force&&now-this.lastUpdate<250&&cx===this.center.x&&cz===this.center.z)return;
    const moved=cx!==this.center.x||cz!==this.center.z;
    this.lastUpdate=now;this.center={x:cx,z:cz};
    this.profile=STREAM_PROFILES[quality];
    const wanted:{x:number;z:number;score:number}[]=[];
    for(let dz=-this.profile.preload;dz<=this.profile.preload;dz++)
      for(let dx=-this.profile.preload;dx<=this.profile.preload;dx++){
        const x=cx+dx,z=cz+dz,key=chunkKey(x,z);
        if(isCore(x,z)||this.chunks.has(key)||this.pending.has(key))continue;
        const distance=Math.hypot(dx,dz);
        const forward=dx*move.x+dz*move.z;
        wanted.push({x,z,score:distance-forward*0.55});
      }
    wanted.sort((a,b)=>a.score-b.score);
    this.queue=this.queue.filter(chunk=>{
      const keep=Math.max(Math.abs(chunk.x-cx),Math.abs(chunk.z-cz))<=this.profile.preload;
      if(!keep)this.pending.delete(chunkKey(chunk.x,chunk.z));
      return keep;
    });
    for(const chunk of wanted){this.queue.push(chunk);this.pending.add(chunkKey(chunk.x,chunk.z));}
    this.queue.sort((a,b)=>a.score-b.score);
    for(const chunk of [...this.chunks.values()])if(Math.max(Math.abs(chunk.x-cx),Math.abs(chunk.z-cz))>this.profile.cache)
      this.evictChunk(chunk);
    for(const key of this.chunkRevisions.keys()){
      const [x,z]=key.split(',').map(Number);
      if(!isCore(x,z)&&Math.max(Math.abs(x-cx),Math.abs(z-cz))>this.profile.cache+1)
        this.chunkRevisions.delete(key);
    }
    if(moved){this.revision++;this.onViewChange?.();}
    this.pump();
  }
  visibleChunks():WorldChunk[]{
    const radius=this.profile.render;
    return [...this.chunks.values()].filter(chunk=>
      this.visualReady.has(chunkKey(chunk.x,chunk.z))&&
      Math.max(Math.abs(chunk.x-this.center.x),Math.abs(chunk.z-this.center.z))<=radius+2);
  }
  loadedChunkCount():number{return this.chunks.size;}
}
