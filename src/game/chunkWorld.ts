import { BIOME_PROP_KITS } from './biomeArt';
import { BASE_SPECIES, SPECIES, type Biome } from './content';
import { CHUNK_SIZE, WORLD_SIZE, generateWorld, type CardCache, type ItemSpawn, type Tile, type WildSpawn, type WorldData } from './world';
import { ITEM_IDS } from './items';

export interface WorldPointOfInterest { id:string; name:string; kind:'ruin'|'cave'|'tree'; x:number; z:number }
export interface WorldChunk {
  x:number; z:number; tiles:Tile[]; wild:WildSpawn[]; caches:CardCache[]; items:ItemSpawn[];
  pointsOfInterest:WorldPointOfInterest[];
}

export const chunkKey=(x:number,z:number)=>`${x},${z}`;
export const chunkOf=(coordinate:number)=>Math.floor(coordinate/CHUNK_SIZE);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(v:number)=>v*v*(3-2*v);
function hash(x:number,z:number,seed:number):number {
  let n=Math.imul(x^seed,374761393)^Math.imul(z+seed,668265263);
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967296;
}
function noise(x:number,z:number,seed:number):number {
  const ix=Math.floor(x),iz=Math.floor(z),fx=smooth(x-ix),fz=smooth(z-iz);
  const a=hash(ix,iz,seed)*(1-fx)+hash(ix+1,iz,seed)*fx;
  const b=hash(ix,iz+1,seed)*(1-fx)+hash(ix+1,iz+1,seed)*fx;
  return a*(1-fz)+b*fz;
}
function coreEdge(core:WorldData,x:number,z:number):Tile {
  const px=clamp(x,0,WORLD_SIZE-1),pz=clamp(z,0,WORLD_SIZE-1);
  return core.tiles[pz*WORLD_SIZE+px];
}
function lakeAt(x:number,z:number,seed:number):{distance:number;radius:number;floorHeight:number}|null {
  const cellX=Math.floor(x/112),cellZ=Math.floor(z/112);
  let closest:{distance:number;radius:number;floorHeight:number}|null=null;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const gx=cellX+dx,gz=cellZ+dz;
    if(hash(gx,gz,seed+91)>0.62)continue;
    const centerX=gx*112+20+hash(gx,gz,seed+92)*72;
    const centerZ=gz*112+20+hash(gx,gz,seed+93)*72;
    const radius=9+hash(gx,gz,seed+94)*12;
    const warp=(noise(x/13,z/13,seed+95)-0.5)*5;
    const distance=Math.hypot(x-centerX,z-centerZ)+warp;
    if(distance<radius+16&&(!closest||distance-radius<closest.distance-closest.radius))
      closest={distance,radius,floorHeight:1+Math.floor(hash(gx,gz,seed+96)*2)};
  }
  return closest;
}
function macro(x:number,z:number,seed:number,core?:WorldData) {
  const warpX=(noise(x/125,z/125,seed+13)-0.5)*24;
  const warpZ=(noise(x/125,z/125,seed+17)-0.5)*24;
  const wx=x+warpX,wz=z+warpZ;
  const continental=noise(wx/230,wz/230,seed+29);
  const highland=noise(wx/155,wz/155,seed+37);
  const ridges=1-Math.abs(noise(wx/92,wz/92,seed+41)*2-1);
  const foothill=noise(wx/42,wz/42,seed+43);
  // Broad highland masses contain walkable benches, with smaller ridges on top.
  const mountain=smooth(clamp((highland-0.53)/0.17,0,1));
  let height=clamp(Math.round(1+(continental-0.47)*2.2+mountain*(3.8+2.1*ridges)+
    (foothill-0.5)*(0.65+mountain*1.3)),0,8);
  const moisture=noise(wx/115,wz/115,seed+59)*0.75+noise(wx/35,wz/35,seed+60)*0.25;
  const warmth=noise(wx/225,wz/225,seed+61)-height*0.037;
  let landscape:NonNullable<Tile['landscape']>=height>=6?(height>=7&&warmth<0.33?'ice':'mountain'):
    height>=4?(warmth>0.69&&noise(wx/75,wz/75,seed+63)>0.68?'volcanic':'mountain'):
    moisture<0.29&&height>=2?'rocky':
    moisture>0.70&&height<=1?'swamp':
    moisture>0.43?'forest':'field';
  // Long, meandering channels are sampled in world coordinates, so a chunk never owns a river endpoint.
  const lane=Math.round(x/256);
  let riverDistance=Infinity;
  for(let n=lane-1;n<=lane+1;n++){
    const center=n*256+86+Math.sin(z/57+n*2.1+seed*0.001)*15+
      (noise(z/85,n*7,seed+83)-0.5)*24;
    riverDistance=Math.min(riverDistance,Math.abs(x-center));
  }
  const lake=lakeAt(x,z,seed);
  if(lake){
    const basin=lake.distance<lake.radius+3?1:
      smooth(clamp((lake.radius+15-lake.distance)/12,0,1));
    height=Math.min(height,Math.round(height*(1-basin)+lake.floorHeight*basin));
  }
  const inLake=!!lake&&lake.distance<lake.radius&&height<=3;
  let water=(riverDistance<1.8+moisture*2.2&&height<=3)||inLake||continental<0.19;
  if(lake&&lake.distance<lake.radius+4&&height<=2)landscape='lake';
  if(core){
    const dx=x<0?-x:x>=WORLD_SIZE?x-WORLD_SIZE+1:0;
    const dz=z<0?-z:z>=WORLD_SIZE?z-WORLD_SIZE+1:0;
    const edgeDistance=Math.hypot(dx,dz);
    if(edgeDistance>0&&edgeDistance<=38){
      const edge=coreEdge(core,x,z);
      const edgeWarp=(noise(x/16,z/16,seed+109)-0.5)*10+
        (noise(x/7,z/7,seed+111)-0.5)*3;
      const t=edgeDistance<=2?0:smooth(clamp((edgeDistance-2+edgeWarp)/31,0,1));
      height=Math.round(edge.height*(1-t)+height*t);
      const edgeWater=edge.terrain==='water';
      if(t<1){
        const waterWeight=(edgeWater?1-t:0)+(water?t:0)+
          (noise(x/11,z/11,seed+103)-0.5)*t*(1-t);
        water=waterWeight>=0.5;
      }
      const boundary=0.48+(noise(x/11,z/11,seed+113)-0.5)*0.42;
      if(t<boundary)landscape=edge.biome==='brasa'?'volcanic':edge.biome==='lago'?'lake':'forest';
    }
  }
  const biome:Biome=landscape==='volcanic'?'brasa':
    landscape==='lake'||landscape==='swamp'||landscape==='ice'?'lago':'bosque';
  return {height,water,biome,landscape,riverDistance,inLake};
}
export function poiForCell(cellX:number,cellZ:number,seed:number):WorldPointOfInterest|null {
  if(hash(cellX,cellZ,seed+311)>0.39)return null;
  const x=cellX*128+20+Math.floor(hash(cellX,cellZ,seed+313)*88);
  const z=cellZ*128+20+Math.floor(hash(cellX,cellZ,seed+317)*88);
  if(x>=-24&&x<120&&z>=-24&&z<120)return null;
  const kind=(['ruin','cave','tree'] as const)[Math.floor(hash(cellX,cellZ,seed+319)*3)];
  return {id:`poi-${cellX}-${cellZ}`,kind,name:kind==='ruin'?'Ruínas antigas':kind==='cave'?'Entrada rochosa':'Árvore ancestral',x,z};
}
function nearbyPoi(x:number,z:number,seed:number):WorldPointOfInterest|null {
  const cellX=Math.floor(x/128),cellZ=Math.floor(z/128);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const poi=poiForCell(cellX+dx,cellZ+dz,seed);
    if(poi&&Math.abs(poi.x-x)<=4&&Math.abs(poi.z-z)<=4)return poi;
  }
  return null;
}
function landscapeProp(tile:Tile,rank:number):Tile['prop'] {
  const kit=BIOME_PROP_KITS[tile.landscape==='lake'?'riverbank':tile.landscape??'forest'];
  const ground=kit.filter(prop=>!['tree','pine','copper-tree','marsh-willow','river-stones'].includes(prop));
  return ground[Math.floor(rank*ground.length)] as Tile['prop'];
}
function treeProp(tile:Tile,rank:number):Tile['prop'] {
  if(tile.landscape==='swamp'||tile.landscape==='lake')return 'marsh-willow';
  if(tile.landscape==='ice'||tile.landscape==='mountain')return 'pine';
  if(tile.landscape==='field')return rank<0.68?'tree':'copper-tree';
  return rank<0.55?'tree':rank<0.88?'pine':'copper-tree';
}
function isLocalMinimum(x:number,z:number,seed:number,rank:number,radius=1):boolean {
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++)
    if((dx||dz)&&hash(x+dx,z+dz,seed)<rank)return false;
  return true;
}
function corridor(x:number,z:number,cx:number,cz:number,seed:number):boolean{
  const left=cx*CHUNK_SIZE,top=cz*CHUNK_SIZE,centerX=left+8,centerZ=top+8;
  const westZ=top+4+Math.floor(hash(cx,cz,seed+501)*8);
  const eastZ=top+4+Math.floor(hash(cx+1,cz,seed+501)*8);
  const northX=left+4+Math.floor(hash(cx,cz,seed+503)*8);
  const southX=left+4+Math.floor(hash(cx,cz+1,seed+503)*8);
  const between=(value:number,a:number,b:number)=>value>=Math.min(a,b)&&value<=Math.max(a,b);
  return (z===westZ&&between(x,left,centerX))||(x===centerX&&between(z,westZ,centerZ))||
    (z===eastZ&&between(x,centerX,left+15))||(x===centerX&&between(z,eastZ,centerZ))||
    (x===northX&&between(z,top,centerZ))||(z===centerZ&&between(x,northX,centerX))||
    (x===southX&&between(z,centerZ,top+15))||(z===centerZ&&between(x,southX,centerX));
}
export function generateChunk(seed:number,cx:number,cz:number,core?:WorldData):WorldChunk {
  if(!Number.isSafeInteger(cx)||!Number.isSafeInteger(cz))throw new RangeError('Invalid chunk coordinate');
  const tiles:Tile[]=[],wild:WildSpawn[]=[],caches:CardCache[]=[],items:ItemSpawn[]=[];
  const pointsOfInterest:WorldPointOfInterest[]=[];
  const geography=new Map<string,ReturnType<typeof macro>>();
  const at=(x:number,z:number)=>{
    const key=`${x},${z}`;
    let sample=geography.get(key);
    if(!sample){sample=macro(x,z,seed,core);geography.set(key,sample);}
    return sample;
  };
  for(let lz=0;lz<CHUNK_SIZE;lz++)for(let lx=0;lx<CHUNK_SIZE;lx++){
    const x=cx*CHUNK_SIZE+lx,z=cz*CHUNK_SIZE+lz;
    const m=at(x,z);
    const poi=nearbyPoi(x,z,seed);
    let height=m.height,water=m.water;
    const poiDistance=poi?Math.hypot(x-poi.x,z-poi.z):Infinity;
    if(poiDistance<3){height=at(poi!.x,poi!.z).height;water=false;}
    const trailX=x+Math.sin(z/32+seed*0.01)*9+Math.sin(z/13+seed*0.013)*3;
    const trailZ=z+Math.sin(x/39+seed*0.01)*10+Math.sin(x/17+seed*0.017)*3;
    const path=Math.abs(trailX-Math.round(trailX/135)*135)<1.35||
      Math.abs(trailZ-Math.round(trailZ/151)*151)<1.35;
    const transit=corridor(x,z,cx,cz,seed);
    let terrain:Tile['terrain']=water?'water':height>=4?'stone':'grass';
    if(path)terrain=water?(m.riverDistance<4.3&&!m.inLake?'bridge':'water'):'path';
    // Only short, narrow river crossings become bridges; lakes keep their outline.
    if(transit&&water&&!m.inLake&&m.riverDistance<4.3)terrain='bridge';
    if(terrain==='bridge')water=false;
    const surface=water?(m.inLake?height:Math.max(0,height-1)):height;
    let shore=Infinity,lowShore=Infinity;
    if(water)for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){
      if(!dx&&!dz||Math.hypot(dx,dz)>3.2)continue;
      const neighbor=at(x+dx,z+dz);
      if(neighbor.water)continue;
      const distance=Math.hypot(dx,dz);
      shore=Math.min(shore,distance);
      if(neighbor.height<=surface+1)lowShore=Math.min(lowShore,distance);
    }
    const depth=water?clamp(shore<=1.5?1:shore<=2.25?2:shore<=3.2?3:
      1+Math.floor(hash(x,z,seed+127)*2)+(m.riverDistance>4?2:0),1,5):0;
    const bedHeight=water?clamp(surface-depth,-5,-1):height;
    const tile:Tile={x,z,height:surface,bedHeight,
      waterDepth:water?clamp((surface-bedHeight)/5,0,1):0,biome:m.biome,landscape:m.landscape,
      terrain,prop:null,blocked:water};
    if(poiDistance<0.5){
      tile.prop=poi!.kind==='ruin'?'ruin-arch':poi!.kind==='cave'?'cave-boulder':
        tile.biome==='lago'?'marsh-willow':'tree';
      tile.blocked=true;
      pointsOfInterest.push(poi!);
      caches.push({id:`cache-${poi!.id}`,element:tile.biome==='brasa'?'fogo':tile.biome==='lago'?'agua':'natureza',x,z});
    }else if(water&&poiDistance>3){
      const willowRank=hash(x,z,seed+1901);
      if(tile.biome==='lago'&&lowShore<=2.25&&depth<=2&&
        willowRank<0.055&&isLocalMinimum(x,z,seed+1901,willowRank,3))
        tile.prop='tree';
      else if(lowShore<=1.5&&depth<=2&&hash(x,z,seed+1903)<0.08)
        tile.prop='river-stones';
      else if(hash(x,z,seed+1905)<(shore<=2.25?0.035:0.012))
        tile.prop='reeds';
    }else if(!water&&terrain!=='path'&&!transit&&poiDistance>3){
      const cluster=noise(x/17,z/17,seed+157)*0.72+noise(x/7,z/7,seed+159)*0.28;
      const lush=smooth(clamp((cluster-0.30)/0.37,0,1));
      const wooded=tile.landscape==='forest'||tile.landscape==='swamp'||tile.landscape==='lake';
      const scattered=tile.landscape==='field';
      const alpine=tile.landscape==='ice'||tile.landscape==='mountain';
      const treeRank=hash(x,z,seed+151);
      const treeChance=wooded?0.025+lush*0.14:scattered?0.01+lush*0.055:
        alpine?0.012+lush*0.075:0;
      const wetBank=tile.landscape==='swamp'||tile.landscape==='lake';
      const treeSite=treeRank<treeChance&&isLocalMinimum(x,z,seed+151,treeRank);
      const closeToWater=wetBank&&treeSite&&
        [-4,-3,-2,-1,0,1,2,3,4].some(dz=>[-4,-3,-2,-1,0,1,2,3,4].some(dx=>
          Math.hypot(dx,dz)<4.5&&at(x+dx,z+dz).water));
      if(treeSite&&!closeToWater){
        tile.prop=treeProp(tile,hash(x,z,seed+163));tile.blocked=true;
      }else{
        const detail=hash(x,z,seed+169);
        const detailChance=(wooded?0.045:scattered?0.035:alpine?0.045:0.025)+
          lush*(wooded?0.14:alpine?0.11:0.075);
        if(detail<detailChance){
          tile.prop=landscapeProp(tile,hash(x,z,seed+171));
          tile.blocked=tile.prop?.includes('boulder')===true||tile.prop==='fallen-log';
        }
      }
    }
    tiles.push(tile);
  }
  // A one-level change is always a climbable slope. Larger cliffs remain as terrain features.
  for(const tile of tiles)if(!tile.blocked&&tile.terrain!=='water'&&tile.terrain!=='bridge'){
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const next=at(tile.x+dx,tile.z+dz);
      if(!next.water&&Math.abs(next.height-tile.height)===1){tile.terrain='ramp';break;}
    }
  }
  const candidates=tiles.filter(tile=>!tile.blocked&&tile.terrain!=='water'&&!tile.prop&&
    (tile.x<0||tile.x>=WORLD_SIZE||tile.z<0||tile.z>=WORLD_SIZE));
  if(candidates.length){
    const pick=(salt:number)=>candidates[Math.floor(hash(cx,cz,seed+salt)*candidates.length)];
    if(hash(cx,cz,seed+181)<0.48){
      const tile=pick(183),species=BASE_SPECIES.filter(id=>SPECIES[id].biome===tile.biome);
      wild.push({id:`wild-${cx}-${cz}`,species:species[Math.floor(hash(cx,cz,seed+185)*species.length)],
        level:2+Math.min(9,Math.floor((Math.abs(cx-3)+Math.abs(cz-3))/4)),night:false,
        x:tile.x,z:tile.z,homeX:tile.x,homeZ:tile.z});
    }
    if(hash(cx,cz,seed+191)<0.17){const tile=pick(193);
      items.push({id:`item-${cx}-${cz}`,itemId:ITEM_IDS[Math.floor(hash(cx,cz,seed+197)*ITEM_IDS.length)],x:tile.x,z:tile.z});}
  }
  return {x:cx,z:cz,tiles,wild,caches,items,pointsOfInterest};
}

const coreCache=new Map<number,WorldData>();
export function generateSeededChunk(seed:number,cx:number,cz:number):WorldChunk {
  const nearCore=cx>=-3&&cx<=8&&cz>=-3&&cz<=8;
  let core=coreCache.get(seed);
  if(nearCore&&!core){core=generateWorld(seed);coreCache.set(seed,core);}
  return generateChunk(seed,cx,cz,core);
}
