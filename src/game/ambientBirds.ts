import { HEIGHT_STEP, tileAt, type Point, type Tile, type WorldData } from './world';
import { placeSize, propAsset, PROP_SIZE } from './assets';
import { spriteSurfaceOffset } from '../render/camera';
import { spriteFootV } from '../render/spriteAnchors';

export const BIRD_SPECIES = {
  'verde-dourado': { label: 'Pássaro verde e dourado', scale: 0.91, idleSeconds: 1.55, flySeconds: 0.54 },
  azul: { label: 'Pássaro azul', scale: 0.88, idleSeconds: 1.45, flySeconds: 0.51 },
  cobre: { label: 'Pássaro cobre', scale: 0.94, idleSeconds: 1.65, flySeconds: 0.56 }
} as const;
export type BirdSpecies = keyof typeof BIRD_SPECIES;
export type BirdAnimation = 'idle' | 'flutter' | 'takeoff' | 'fly';
export const BIRD_ANIMATIONS = {
  idle: { frames: 4, loop: true }, flutter: { frames: 6, loop: false },
  takeoff: { frames: 2, loop: false }, fly: { frames: 6, loop: true }
} as const;

export interface BirdSite extends Point {
  id: string;
  species: BirdSpecies;
  perch: 'ground' | 'high' | 'tree' | 'roof';
  groundY: number;
  perchHeight: number;
  perchOffsetX: number;
  perchOffsetZ: number;
  phase: number;
  facing: 1 | -1;
}

const species = Object.keys(BIRD_SPECIES) as BirdSpecies[];
const trees = new Set(['tree', 'pine', 'copper-tree', 'marsh-willow']);
const length = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
// Feet contact pixels on the visible roof tiles of the 512px building art.
// Placing a bird at the building's world origin puts it in front of a wall.
const roofContacts: Record<string,{x:number;y:number}> = {
  'casa-vila': {x:318,y:152},
  'casa-padaria': {x:303,y:155},
  'casa-cartas': {x:302,y:160},
  'casa-cura': {x:311,y:160},
  'casa-arquivo': {x:308,y:154},
  'casa-estalagem': {x:240,y:183},
  'casa-pedra': {x:214,y:165},
  'casa-caverna': {x:245,y:134},
  'woodcutter-hut': {x:302,y:161},
  boathouse: {x:310,y:160}
};

function hash(x: number, z: number, seed: number): number {
  let value = Math.imul(x + seed, 0x9e3779b1) ^ Math.imul(z - seed, 0x85ebca6b);
  value = Math.imul(value ^ value >>> 16, 0x7feb352d);
  return ((value ^ value >>> 15) >>> 0) / 4294967296;
}

function clearGround(world: WorldData, tile: Tile): boolean {
  if (tile.blocked || tile.prop || tile.waterDepth || !['grass', 'stone'].includes(tile.terrain)) return false;
  const point = {x:tile.x + 0.5, z:tile.z + 0.5};
  if (length(point, world.start) < 12 || world.places.some(place => length(point, place) < 9) ||
      world.decorations.some(place => length(point, place) < 9)) return false;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const near = tileAt(world, tile.x + dx, tile.z + dz);
    if (!near || near.terrain === 'water' || near.terrain === 'path' || near.terrain === 'bridge' ||
        near.terrain === 'plaza') return false;
  }
  return true;
}

function pickSites(world: WorldData, candidates: Tile[], perch: BirdSite['perch'], count: number,
  spacing: number, existing: BirdSite[]): BirdSite[] {
  const selected: BirdSite[] = [];
  const ranked = candidates.map(tile => ({tile, rank:hash(tile.x, tile.z, world.seed + (perch === 'tree' ? 9049 : 3217))}))
    .sort((a,b) => b.rank - a.rank);
  for (const {tile} of ranked) {
    const point = {x:tile.x + 0.5,z:tile.z + 0.5};
    if (selected.some(other => length(point, other) < spacing) ||
        existing.some(other => length(point, other) < 7)) continue;
    const choice = Math.floor(hash(tile.x + 19, tile.z - 31, world.seed + 771) * species.length);
    const phase=hash(tile.x - 17,tile.z + 13,world.seed + 81);
    const asset=perch==='tree'?propAsset(tile):null;
    const size=asset?PROP_SIZE[asset as keyof typeof PROP_SIZE]:0;
    // These center pixels sit on the visible upper canopy in every tree sprite.
    const imageV=0.34+phase*0.04;
    const contact=asset?spriteSurfaceOffset(size,
      spriteFootV(`/art/environment/${asset}.png`),0.5,imageV):null;
    selected.push({id:`bird-${perch}-${tile.x}-${tile.z}`,x:point.x,z:point.z,
      species:species[choice],perch,groundY:tile.height * HEIGHT_STEP + 0.1,
      perchHeight:contact?.y??0,perchOffsetX:contact?.x??0,perchOffsetZ:contact?.z??0,phase,
      facing:hash(tile.x + 11,tile.z - 11,world.seed + 313) > 0.5 ? 1 : -1});
    if (selected.length >= count) break;
  }
  return selected;
}

export function birdSites(world: WorldData): BirdSite[] {
  const rooftops:BirdSite[]=[];
  const buildings=[...world.places.filter(place=>place.kind==='house'),...world.decorations]
    .sort((a,b)=>hash(b.x,b.z,world.seed+902)-hash(a.x,a.z,world.seed+902));
  for(const building of buildings){
    const point={x:building.x+0.5,z:building.z+0.5};
    if(rooftops.some(bird=>length(point,bird)<10)||
      length(point,world.start)<8&&rooftops.some(bird=>length(bird,world.start)<8))continue;
    const tile=tileAt(world,building.x,building.z);
    const contact=roofContacts[building.id];
    if(!tile||!contact)continue;
    const phase=hash(building.x-17,building.z+13,world.seed+81);
    const size=placeSize(building);
    const offset=spriteSurfaceOffset(size,
      spriteFootV(`/art/environment/${building.id}.png`),contact.x/512,contact.y/512);
    rooftops.push({id:`bird-roof-${building.id}`,x:point.x,z:point.z,
      species:species[Math.floor(hash(building.x+19,building.z-31,world.seed+771)*species.length)],
      perch:'roof',groundY:tile.height*HEIGHT_STEP+0.1,
      perchHeight:offset.y,perchOffsetX:offset.x,perchOffsetZ:offset.z,
      phase,facing:hash(building.x+11,building.z-11,world.seed+313)>0.5?1:-1});
    if(rooftops.length>=3)break;
  }
  const perched=pickSites(world,world.tiles.filter(tile=>{
    if(!trees.has(tile.prop??''))return false;
    const point={x:tile.x+0.5,z:tile.z+0.5};
    return length(point,world.start)>9&&buildings.every(building=>
      length(point,{x:building.x+0.5,z:building.z+0.5})>=8);
  }),'tree',22,10,rooftops);
  const high=pickSites(world,world.tiles.filter(tile=>tile.height>=2&&clearGround(world,tile)),
    'high',8,13,[...rooftops,...perched]);
  const ground=pickSites(world,world.tiles.filter(tile=>tile.height<2&&clearGround(world,tile)),
    'ground',12,14,[...rooftops,...perched,...high]);
  return [...rooftops,...perched,...high,...ground];
}

export const BIRD_FLEE_DISTANCE = 2.5;
export const BIRD_FLUTTER_SECONDS = 0.72;
export const BIRD_NIGHT_START = 19;
export const BIRD_NIGHT_END = 6;
const BIRD_LAST_TAKEOFF = 18.5;

export function birdQuietHours(hour: number): boolean {
  return hour >= BIRD_NIGHT_START || hour < BIRD_NIGHT_END;
}

export function birdCanStartFlight(hour: number): boolean {
  return hour >= BIRD_NIGHT_END && hour < BIRD_LAST_TAKEOFF;
}

export function birdPresence(site: BirdSite, hour: number): number {
  // A few birds sleep on roofs or in the canopy; the rest settle before dark.
  if(site.perch==='roof'||site.perch==='tree'&&site.phase<0.3)return 1;
  if(birdQuietHours(hour))return 0;
  const eveningStart=18.5+site.phase*0.25;
  if(hour>=eveningStart)return Math.max(0,(BIRD_NIGHT_START-hour)/(BIRD_NIGHT_START-eveningStart));
  const morningStart=BIRD_NIGHT_END+site.phase*0.12;
  return Math.min(1,Math.max(0,(hour-morningStart)/0.12));
}

export function birdFlutterDelay(site: BirdSite, cycle: number): number {
  return 5 + hash(Math.round(site.x*2)+cycle*7,Math.round(site.z*2)-cycle*11,
    Math.floor(site.phase*1_000_000))*8;
}
export function birdLookDelay(site: BirdSite, cycle: number): number {
  return 3 + hash(Math.round(site.x*2)-cycle*13,Math.round(site.z*2)+cycle*5,
    Math.floor(site.phase*1_000_000)+171)*6;
}
export function birdShadowOpacity(height: number): number {
  return 0.23/(1+Math.max(0,height)*0.55);
}

// The game uses an orthographic camera, so airborne sprites need an explicit
// depth cue to read as closer to the viewer instead of remaining ground-sized.
export function birdAirScale(height: number, playerDistance: number): number {
  return 1 + Math.min(0.35, Math.max(0,height)*0.095) +
    Math.max(0, 1-Math.max(0,playerDistance)/14)*0.16;
}

export function birdFleePose(seconds: number): { frame: number; distance: number; lift: number; opacity: number } {
  const motion = Math.max(0, seconds - 0.22);
  return {
    frame: seconds < 0.22 ? Math.min(1, Math.floor(seconds / 0.11)) : Math.floor(motion * 10) % 6,
    distance: motion * 6.2,
    lift: Math.min(3.4, motion * 3.5),
    opacity: 1
  };
}
