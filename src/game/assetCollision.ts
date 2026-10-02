import { placeSize, propAsset, PROP_SIZE } from './assets';
import { ART_FOOTPRINTS, ART_FOOTPRINT_AREAS, CHARACTER_FOOTPRINTS, HERO_FOOTPRINT } from './generatedFootprints';
import { staticNpcAt } from './npcs';
import { tileAt, type Point, type WorldData } from './world';

const INV_SQRT2=Math.SQRT1_2;
const HERO_WIDTH=1.42;
const HERO_GROUND_RADIUS=0.22;
export interface NpcFootprintActor extends Point { role:string }

export function depthFor(asset:string):number {
  if(asset.startsWith('casa-'))return 0.7;
  if(asset==='woodcutter-hut'||asset==='boathouse')return 0.65;
  if(asset.startsWith('selo-'))return 0.45;
  if(asset==='lamp'||asset==='village-lamp')return 0.24;
  if(asset==='bloom-bush'||asset==='flower-planter')return 0.46;
  if(asset==='bench'||asset==='crates')return 0.52;
  if(asset==='well')return 0.7;
  if(asset==='carroca-mercador')return 0.65;
  if(asset==='arco-pedra')return 0.52;
  if(asset.includes('rock')||asset==='rock')return 0.32;
  return asset==='tree'||asset==='willow'||asset==='pine'||asset==='copper-tree'||asset==='marsh-willow'?0.27:0.35;
}

function touchesFootprints(point:Point,anchor:Point,mask:string,size:number,depthRadius:number):boolean {
  if(!mask)return false;
  const dx=point.x-anchor.x,dz=point.z-anchor.z;
  const across=(dx-dz)*INV_SQRT2;
  const depth=Math.abs((dx+dz)*INV_SQRT2);
  if(depth>depthRadius+HERO_GROUND_RADIUS||Math.abs(across)>size/2+HERO_WIDTH/2)return false;
  for(let i=0;i<HERO_FOOTPRINT.length;i++) {
    if(HERO_FOOTPRINT[i]!=='1')continue;
    const heroOffset=((i+0.5)/HERO_FOOTPRINT.length-0.5)*HERO_WIDTH;
    const pixel=Math.floor((across+heroOffset)/size*mask.length+mask.length/2);
    if(pixel>=0&&pixel<mask.length&&mask[pixel]==='1')return true;
  }
  return false;
}

function touchesArea(point:Point,anchor:Point,size:number,area:{rows:string[];depthMin:number;depthMax:number}):boolean {
  const dx=point.x-anchor.x,dz=point.z-anchor.z;
  const across=(dx-dz)*INV_SQRT2;
  const depth=(dx+dz)*INV_SQRT2;
  const rows=area.rows,columns=rows[0]?.length||0;
  if(!columns||depth<area.depthMin-HERO_GROUND_RADIUS||depth>area.depthMax+HERO_GROUND_RADIUS||Math.abs(across)>size/2+HERO_WIDTH/2)return false;
  for(let i=0;i<HERO_FOOTPRINT.length;i++){
    if(HERO_FOOTPRINT[i]!=='1')continue;
    const heroOffset=((i+0.5)/HERO_FOOTPRINT.length-0.5)*HERO_WIDTH;
    const column=Math.floor((across+heroOffset)/size*columns+columns/2);
    if(column<0||column>=columns)continue;
    for(const footDepth of [-HERO_GROUND_RADIUS,0,HERO_GROUND_RADIUS]){
      const row=Math.floor((depth+footDepth-area.depthMin)/(area.depthMax-area.depthMin)*rows.length);
      if(row>=0&&row<rows.length&&rows[row][column]==='1')return true;
    }
  }
  return false;
}

function touchesAsset(point:Point,anchor:Point,asset:string,size:number):boolean {
  const area=ART_FOOTPRINT_AREAS[asset];
  return area?touchesArea(point,anchor,size,area):touchesFootprints(point,anchor,ART_FOOTPRINTS[asset],size,depthFor(asset));
}

export function collidesWithNpcAt(player:Point,npc:NpcFootprintActor):boolean {
  return touchesFootprints(player,npc,CHARACTER_FOOTPRINTS[npc.role],HERO_WIDTH,0.25);
}

export function collidesWithNpcs(world:WorldData,point:Point,moving:NpcFootprintActor[]=[]):boolean {
  const current=tileAt(world,Math.floor(point.x),Math.floor(point.z));
  if(!current)return true;
  for(const place of world.places){
    const npc=staticNpcAt(place);
    const tile=tileAt(world,Math.floor(npc.x),Math.floor(npc.z));
    if(tile?.height===current.height&&collidesWithNpcAt(point,npc))return true;
  }
  for(const npc of moving){
    const tile=tileAt(world,Math.floor(npc.x),Math.floor(npc.z));
    if(tile?.height===current.height&&collidesWithNpcAt(point,npc))return true;
  }
  return false;
}

export function collidesWithArt(world:WorldData,point:Point,arena?:{center:Point;radius:number}):boolean {
  const current=tileAt(world,Math.floor(point.x),Math.floor(point.z));
  if(!current)return true;
  const inCutout=(x:number,z:number,size:number)=>arena&&Math.hypot(x+0.5-arena.center.x,z+0.5-arena.center.z)<arena.radius+size*0.85;
  for(let z=Math.floor(point.z)-4;z<=Math.floor(point.z)+4;z++)
    for(let x=Math.floor(point.x)-4;x<=Math.floor(point.x)+4;x++) {
      const tile=tileAt(world,x,z);
      if(!tile?.prop||Math.abs(tile.height-current.height)>1)continue;
      const asset=propAsset(tile)!;
      const size=PROP_SIZE[asset as keyof typeof PROP_SIZE];
      if(!inCutout(x,z,size)&&touchesAsset(point,{x:x+0.5,z:z+0.5},asset,size))return true;
    }
  for(const place of [...world.places,...world.decorations]) {
    const tile=tileAt(world,place.x,place.z);
    if(!tile||Math.abs(tile.height-current.height)>1)continue;
    const size=placeSize(place);
    if(!inCutout(place.x,place.z,size)&&touchesAsset(point,{x:place.x+0.5,z:place.z+0.5},place.id,size))return true;
  }
  return false;
}

export function canPlayerOccupy(world:WorldData,from:Point,to:Point,allowRise=false,arena?:{center:Point;radius:number},npcs:NpcFootprintActor[]=[]):boolean {
  const ax=Math.floor(from.x),az=Math.floor(from.z),bx=Math.floor(to.x),bz=Math.floor(to.z);
  const source=tileAt(world,ax,az),target=tileAt(world,bx,bz);
  if(!source||!target||target.terrain==='water'||Math.abs(ax-bx)+Math.abs(az-bz)>1)return false;
  const rise=target.height-source.height;
  if(rise>1||rise< -1)return false;
  if(rise===1&&!allowRise&&source.terrain!=='ramp'&&target.terrain!=='ramp')return false;
  for(const [dx,dz] of [[HERO_GROUND_RADIUS,0],[-HERO_GROUND_RADIUS,0],[0,HERO_GROUND_RADIUS],[0,-HERO_GROUND_RADIUS]]){
    const support=tileAt(world,Math.floor(to.x+dx),Math.floor(to.z+dz));
    if(!support||support.terrain==='water'||Math.abs(support.height-target.height)>1)return false;
  }
  return !collidesWithArt(world,to,arena)&&(!!arena||!collidesWithNpcs(world,to,npcs));
}
