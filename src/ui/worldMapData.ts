import { index, type Tile, type WorldData } from '../game/world';
import { generateSeededChunk, poiForCell, chunkKey, chunkOf } from '../game/chunkWorld';
import { isDiscovered } from '../game/discovery';
import type { SaveData } from '../game/save';

export type MapView = 'terrain' | 'height';
export interface MapLandmark { id:string; name:string; kind:'village'|'house'|'shop'|'shrine'|'ruin'|'cave'|'tree'; x:number; z:number; height:number }
export interface MapBounds { minX:number; minZ:number; span:number }
export function worldMapBounds(save:SaveData,player:{x:number;z:number}):MapBounds{
  let minX=Math.min(0,Math.floor(player.x)),minZ=Math.min(0,Math.floor(player.z));
  let maxX=Math.max(95,Math.ceil(player.x)),maxZ=Math.max(95,Math.ceil(player.z));
  for(const key of Object.keys(save.discoveredChunks)){
    const [cx,cz]=key.split(',').map(Number);
    if(!Number.isSafeInteger(cx)||!Number.isSafeInteger(cz))continue;
    minX=Math.min(minX,cx*16);minZ=Math.min(minZ,cz*16);
    maxX=Math.max(maxX,cx*16+15);maxZ=Math.max(maxZ,cz*16+15);
  }
  minX=Math.floor((minX-16)/16)*16;minZ=Math.floor((minZ-16)/16)*16;
  const span=Math.ceil(Math.max(maxX-minX+17,maxZ-minZ+17,96)/16)*16;
  return {minX,minZ,span};
}

const BIOME_COLORS:Record<Tile['biome'],string[]>={
  bosque:['#335f51','#427662','#56846a','#6f936d','#8da77b'],
  brasa:['#593e3b','#775043','#93604a','#ad7351','#c89261'],
  lago:['#355f62','#447876','#568c82','#70a093','#91ad9c']
};
const HEIGHT_COLORS=['#356f93','#438e98','#74a67c','#c0b572','#e1a876','#cfaa91','#b79b8e','#c9c6c8','#e7edf2'];
const FOG_BIOME:Record<Tile['biome'],string>={bosque:'#18372f',brasa:'#382b2a',lago:'#18393d'};
const FOG_HEIGHT=['#163447','#204348','#344b3c','#494837','#554536'];
function mixColor(a:string,b:string,amount:number):string {
  const t=Math.max(0,Math.min(1,amount));
  return '#'+[1,3,5].map(offset=>Math.round(
    parseInt(a.slice(offset,offset+2),16)*(1-t)+parseInt(b.slice(offset,offset+2),16)*t
  ).toString(16).padStart(2,'0')).join('');
}

export function mapTileColor(tile:Tile,view:MapView):string {
  if(tile.terrain==='water')return view==='height'
    ?mixColor('#4b8bb1','#182e59',tile.waterDepth)
    :mixColor('#69aeb0','#1d496d',tile.waterDepth);
  if(view==='height')return HEIGHT_COLORS[Math.min(8,tile.height)];
  if(tile.terrain==='bridge')return '#b79a6d';
  if(tile.terrain==='path'||tile.terrain==='plaza')return '#c1a77b';
  if(tile.terrain==='stone')return '#82766c';
  return BIOME_COLORS[tile.biome][Math.min(4,tile.height)];
}

export function mapLandmarks(world:WorldData,discovered:ReadonlySet<number>,save?:SaveData,bounds?:MapBounds):MapLandmark[] {
  const visible=(x:number,z:number)=>discovered.has(index(x,z));
  const landmarks:MapLandmark[]=[];
  if(visible(world.start.x,world.start.z))landmarks.push({id:'village',name:'Vilarejo',kind:'village',
    x:50,z:52,height:world.tiles[index(50,52)].height});
  for(const place of world.places){
    if(!visible(place.x,place.z))continue;
    landmarks.push({id:place.id,name:place.name,kind:place.kind==='shrine'?'shrine':'house',
      x:place.x,z:place.z,height:world.tiles[index(place.x,place.z)].height});
  }
  for(const decoration of world.decorations){
    if(!visible(decoration.x,decoration.z))continue;
    if(decoration.id!=='casa-vila'&&decoration.id!=='casa-padaria')continue;
    landmarks.push({id:decoration.id,name:decoration.id==='casa-vila'?'Empório da Vila':'Padaria',
      kind:decoration.id==='casa-vila'?'shop':'house',x:decoration.x,z:decoration.z,
      height:world.tiles[index(decoration.x,decoration.z)].height});
  }
  if(save&&bounds){
    for(let cz=Math.floor(bounds.minZ/128)-1;cz<=Math.ceil((bounds.minZ+bounds.span)/128);cz++)
      for(let cx=Math.floor(bounds.minX/128)-1;cx<=Math.ceil((bounds.minX+bounds.span)/128);cx++){
        const poi=poiForCell(cx,cz,world.seed);
        if(!poi||!isDiscovered(save,poi.x,poi.z,discovered))continue;
        const chunk=world.chunks?.get(chunkKey(chunkOf(poi.x),chunkOf(poi.z)))??
          generateSeededChunk(world.seed,chunkOf(poi.x),chunkOf(poi.z));
        const tile=chunk.tiles[(poi.z-chunk.z*16)*16+poi.x-chunk.x*16];
        landmarks.push({...poi,height:tile?.height??0});
      }
  }
  return landmarks;
}

export function drawWorldMap(canvas:HTMLCanvasElement,world:WorldData,discovered:ReadonlySet<number>,view:MapView,
  bounds:MapBounds={minX:0,minZ:0,span:world.size},save?:SaveData):void {
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const step=canvas.width/bounds.span;
  ctx.fillStyle='#071a26';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(const tile of world.tiles){
    const known=discovered.has(index(tile.x,tile.z));
    const x=(tile.x-bounds.minX)*step,z=(tile.z-bounds.minZ)*step;
    ctx.fillStyle=known?mapTileColor(tile,view):view==='height'?FOG_HEIGHT[Math.min(4,tile.height)]:
      tile.terrain==='water'?mixColor('#1c4850','#102a45',tile.waterDepth):FOG_BIOME[tile.biome];
    ctx.fillRect(x,z,step,step);
    const right=tile.x<world.size-1?world.tiles[index(tile.x+1,tile.z)]:undefined;
    const bottom=tile.z<world.size-1?world.tiles[index(tile.x,tile.z+1)]:undefined;
    ctx.fillStyle=known?'#102c33bb':'#071c24aa';
    if(right&&tile.height>right.height&&(known||view==='height'))
      ctx.fillRect(x+step-1,z,1,step);
    if(bottom&&tile.height>bottom.height&&(known||view==='height'))
      ctx.fillRect(x,z+step-1,step,1);
  }
  if(save)for(const key of Object.keys(save.discoveredChunks)){
    const [cx,cz]=key.split(',').map(Number);
    if(!Number.isSafeInteger(cx)||!Number.isSafeInteger(cz))continue;
    const chunk=world.chunks?.get(key)??generateSeededChunk(world.seed,cx,cz);
    for(const tile of chunk.tiles){
      if(!isDiscovered(save,tile.x,tile.z,discovered))continue;
      ctx.fillStyle=mapTileColor(tile,view);
      ctx.fillRect((tile.x-bounds.minX)*step,(tile.z-bounds.minZ)*step,Math.max(1,step),Math.max(1,step));
    }
  }
  ctx.fillStyle='#cad8c31c';
  for(let coordinate=Math.floor(bounds.minX/16)*16;coordinate<bounds.minX+bounds.span;coordinate+=16)
    ctx.fillRect((coordinate-bounds.minX)*step,0,1,canvas.height);
  for(let coordinate=Math.floor(bounds.minZ/16)*16;coordinate<bounds.minZ+bounds.span;coordinate+=16){
    ctx.fillRect(0,(coordinate-bounds.minZ)*step,canvas.width,1);
  }
}
