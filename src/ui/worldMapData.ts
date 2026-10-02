import { index, type Tile, type WorldData } from '../game/world';

export type MapView = 'terrain' | 'height';
export interface MapLandmark { id:string; name:string; kind:'village'|'house'|'shop'|'shrine'; x:number; z:number; height:number }

const BIOME_COLORS:Record<Tile['biome'],string[]>={
  bosque:['#335f51','#427662','#56846a','#6f936d','#8da77b'],
  brasa:['#593e3b','#775043','#93604a','#ad7351','#c89261'],
  lago:['#355f62','#447876','#568c82','#70a093','#91ad9c']
};
const HEIGHT_COLORS=['#356f93','#438e98','#74a67c','#c0b572','#e1a876'];
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
  if(view==='height')return HEIGHT_COLORS[Math.min(4,tile.height)];
  if(tile.terrain==='bridge')return '#b79a6d';
  if(tile.terrain==='path'||tile.terrain==='plaza'||tile.terrain==='ramp')return '#c1a77b';
  if(tile.terrain==='stone')return '#82766c';
  return BIOME_COLORS[tile.biome][Math.min(4,tile.height)];
}

export function mapLandmarks(world:WorldData,discovered:ReadonlySet<number>):MapLandmark[] {
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
  return landmarks;
}

export function drawWorldMap(canvas:HTMLCanvasElement,world:WorldData,discovered:ReadonlySet<number>,view:MapView):void {
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const step=canvas.width/world.size;
  ctx.fillStyle='#071a26';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(const tile of world.tiles){
    const known=discovered.has(index(tile.x,tile.z));
    const x=tile.x*step,z=tile.z*step;
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
  ctx.fillStyle='#cad8c31c';
  for(let coordinate=0;coordinate<world.size;coordinate+=16){
    ctx.fillRect(coordinate*step,0,1,canvas.height);
    ctx.fillRect(0,coordinate*step,canvas.width,1);
  }
}
