import { BASE_SPECIES, type Biome, type Element, SPECIES } from './content';
import type { BiomeProp } from './biomeArt';
import { ITEM_IDS, type ItemId } from './items';

export const WORLD_SIZE = 96;
export const HEIGHT_STEP = 0.85;
export const GROUND_ITEM_LIMIT = 12;
export const GROUND_ITEM_SPACING = 12;
export const GROUND_ITEM_RESPAWN_DISTANCE = 18;

export type Terrain = 'grass' | 'water' | 'path' | 'bridge' | 'plaza' | 'stone' | 'ramp';
export type Prop = 'tree' | 'pine' | 'copper-tree' | 'marsh-willow' | 'rock' | 'moss-rock' | 'basalt-rock' | 'flower-bush' | 'reeds' | 'flowers' | 'lamp' | 'village-lamp' | 'bloom-bush' | 'bench' | 'well' | 'crates' | 'flower-planter' | 'carroca-mercador' | 'arco-pedra' | BiomeProp | null;

export interface Tile {
  x: number;
  z: number;
  height: number;
  waterDepth: number;
  biome: Biome;
  terrain: Terrain;
  prop: Prop;
  blocked: boolean;
}

export interface Point { x: number; z: number }
export interface Place extends Point { id: string; name: string; kind: 'house' | 'shrine'; element?: Element }
export interface Decoration extends Point { id: 'woodcutter-hut' | 'boathouse' | 'casa-padaria' | 'casa-vila' | 'casa-estalagem' | 'casa-pedra' | 'casa-caverna'; kind: 'decoration' }
export interface WildSpawn extends Point { id: string; species: string; level: number; night: boolean; homeX: number; homeZ: number }
export interface CardCache extends Point { id: string; element: Element }
export interface ItemSpawn extends Point { id: string; itemId: ItemId }
export type WalkingNpcRole = 'cartographer' | 'botanist' | 'baker' | 'courier';
export interface WalkingNpcSpawn extends Point { id: string; role: WalkingNpcRole; homeX: number; homeZ: number }

export interface WorldData {
  seed: number;
  size: number;
  tiles: Tile[];
  start: Point;
  places: Place[];
  decorations: Decoration[];
  wild: WildSpawn[];
  walkers: WalkingNpcSpawn[];
  caches: CardCache[];
  items: ItemSpawn[];
}

export function index(x: number, z: number): number { return z * WORLD_SIZE + x; }
export function inBounds(x: number, z: number): boolean { return x >= 0 && z >= 0 && x < WORLD_SIZE && z < WORLD_SIZE; }
export function tileAt(world: WorldData, x: number, z: number): Tile | undefined {
  return inBounds(x, z) ? world.tiles[index(x, z)] : undefined;
}

function hash(x: number, z: number, seed: number): number {
  let h = Math.imul(x ^ seed, 374761393) + Math.imul(z + seed, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number): number { return t * t * (3 - 2 * t); }
function noise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash(ix, iz, seed) * (1 - fx) + hash(ix + 1, iz, seed) * fx;
  const b = hash(ix, iz + 1, seed) * (1 - fx) + hash(ix + 1, iz + 1, seed) * fx;
  return a * (1 - fz) + b * fz;
}
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.z - b.z); }

export function canStep(world: WorldData, from: Point, to: Point): boolean {
  if (Math.abs(from.x - to.x) + Math.abs(from.z - to.z) !== 1) return false;
  const a = tileAt(world, from.x, from.z), b = tileAt(world, to.x, to.z);
  if (!a || !b || b.blocked || b.terrain === 'water') return false;
  const difference = Math.abs(a.height - b.height);
  return difference === 0 || (difference === 1 && (a.terrain === 'ramp' || b.terrain === 'ramp'));
}

export function reachable(world: WorldData, start: Point = world.start): Set<number> {
  const found = new Set<number>();
  const queue: Point[] = [start];
  found.add(index(start.x, start.z));
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = { x: current.x + dx, z: current.z + dz };
      const key = index(next.x, next.z);
      if (!found.has(key) && canStep(world, current, next)) { found.add(key); queue.push(next); }
    }
  }
  return found;
}

function itemSites(world:WorldData,connected:Set<number>):Tile[] {
  return world.tiles.filter(tile=>connected.has(index(tile.x,tile.z))&&!tile.blocked&&tile.terrain!=='water'&&
    !tile.prop&&distance(tile,world.start)>11&&
    world.places.every(place=>distance(tile,place)>5)&&
    world.decorations.every(place=>distance(tile,place)>4)&&
    world.walkers.every(npc=>distance(tile,npc)>3)&&
    world.wild.every(wild=>distance(tile,wild)>2.5)&&
    world.caches.every(cache=>distance(tile,cache)>5));
}

function pickItemSite(world:WorldData,sites:Tile[],active:ItemSpawn[],serial:number,
  biome?:Biome,avoid?:Point,player?:Point):Tile|undefined {
  let chosen:Tile|undefined,score=-1;
  for(const tile of sites){
    if(biome&&tile.biome!==biome)continue;
    if(active.some(item=>distance(tile,item)<GROUND_ITEM_SPACING))continue;
    if(avoid&&distance(tile,avoid)<GROUND_ITEM_RESPAWN_DISTANCE)continue;
    if(player&&distance(tile,player)<GROUND_ITEM_RESPAWN_DISTANCE)continue;
    const rank=hash(tile.x+serial*37,tile.z-serial*19,world.seed+791);
    if(rank>score){chosen=tile;score=rank;}
  }
  return chosen;
}

export function replacementGroundItem(world:WorldData,active:ItemSpawn[],collected:Point,
  player:Point,serial:number):ItemSpawn|undefined {
  if(active.length>=GROUND_ITEM_LIMIT)return undefined;
  const sites=itemSites(world,reachable(world));
  const biomes:Biome[]=['bosque','brasa','lago'];
  const counts=new Map(biomes.map(biome=>[biome,active.filter(item=>tileAt(world,item.x,item.z)?.biome===biome).length]));
  const order=[...biomes.slice(serial%biomes.length),...biomes.slice(0,serial%biomes.length)];
  const preferred=order.reduce((best,biome)=>(counts.get(biome)??0)<(counts.get(best)??0)?biome:best);
  const chosen=pickItemSite(world,sites,active,serial+1000,preferred,collected,player)??
    pickItemSite(world,sites,active,serial+1000,undefined,collected,player);
  return chosen?{id:'item-respawn-'+serial,itemId:ITEM_IDS[serial%ITEM_IDS.length],x:chosen.x,z:chosen.z}:undefined;
}

export function findPath(world: WorldData, start: Point, goal: Point, maxNodes = 2500): Point[] {
  const startKey = index(start.x, start.z), goalKey = index(goal.x, goal.z);
  const open: number[] = [startKey];
  const came = new Map<number, number>();
  const cost = new Map<number, number>([[startKey, 0]]);
  const score = (key: number): number => {
    const x = key % WORLD_SIZE, z = Math.floor(key / WORLD_SIZE);
    return (cost.get(key) ?? Infinity) + Math.abs(x - goal.x) + Math.abs(z - goal.z);
  };
  let visited = 0;
  while (open.length && visited++ < maxNodes) {
    open.sort((a,b) => score(b) - score(a));
    const currentKey = open.pop()!;
    if (currentKey === goalKey) {
      const result: Point[] = [];
      let key = currentKey;
      while (key !== startKey) {
        result.push({ x: key % WORLD_SIZE, z: Math.floor(key / WORLD_SIZE) });
        key = came.get(key)!;
      }
      result.reverse();
      return result;
    }
    const current = { x: currentKey % WORLD_SIZE, z: Math.floor(currentKey / WORLD_SIZE) };
    for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = { x: current.x + dx, z: current.z + dz };
      if (!canStep(world, current, next)) continue;
      const key = index(next.x, next.z);
      const tile = tileAt(world, next.x, next.z)!;
      const nextCost = (cost.get(currentKey) ?? 0) + (tile.terrain === 'path' || tile.terrain === 'bridge' ? 0.8 : 1);
      if (nextCost < (cost.get(key) ?? Infinity)) {
        cost.set(key, nextCost); came.set(key, currentKey);
        if (!open.includes(key)) open.push(key);
      }
    }
  }
  return [];
}

function roadTile(tile: Tile, terrain: Terrain): void {
  tile.terrain = terrain;
  tile.height = 1;
  tile.waterDepth = 0;
  tile.prop = null;
  tile.blocked = false;
}

function carveRoad(world: WorldData, start: Point, end: Point, seed: number): void {
  let x = start.x, z = start.z;
  let steps = 0;
  while ((x !== end.x || z !== end.z) && steps++ < 300) {
    const chooseX = x !== end.x && (z === end.z || hash(x + steps, z, seed + 37) > 0.43);
    if (chooseX) x += Math.sign(end.x - x);
    else z += Math.sign(end.z - z);
    for (const [dx, dz] of [[0,0],[1,0],[-1,0]]) {
      const tile = tileAt(world, x + dx, z + dz);
      if (tile) roadTile(tile, tile.terrain === 'water' ? 'bridge' : 'path');
    }
  }
}

function clearArea(world: WorldData, center: Point, radius: number, height: number, terrain: Terrain): void {
  for (let z = center.z - radius; z <= center.z + radius; z++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      const tile = tileAt(world, x, z);
      if (!tile || distance({x,z}, center) > radius + 0.25) continue;
      tile.height = height;
      tile.terrain = terrain;
      tile.waterDepth = 0;
      tile.prop = null;
      tile.blocked = false;
    }
  }
}

function raiseTerraces(world:WorldData):void {
  for(const center of [{x:19,z:46,peak:3},{x:81,z:43,peak:4},{x:61,z:80,peak:3}]) {
    for(let z=center.z-8;z<=center.z+8;z++)for(let x=center.x-8;x<=center.x+8;x++) {
      const tile=tileAt(world,x,z);
      if(!tile)continue;
      const warpedX=x+(noise(x/5,z/5,world.seed+811)-0.5)*4;
      const warpedZ=z+(noise(x/5,z/5,world.seed+812)-0.5)*4;
      const dist=Math.hypot((warpedX-center.x)*0.91,(warpedZ-center.z)*1.12);
      const rise=dist<2.5?center.peak:dist<4.8?center.peak-1:
        dist<6.8?center.peak-2:dist<7.9&&center.peak===4?1:0;
      if(!rise||tile.height>=rise)continue;
      tile.height=rise;
      tile.terrain=tile.height>=3?'stone':'grass';
      tile.waterDepth=0;
      tile.blocked=false;
      tile.prop=null;
    }
    // A narrow winding ascent connects the concentric levels without opening
    // every cliff face to walking.
    const ascent=[
      [-8,1,1],[-7,1,1],[-6,1,1],[-5,1,2],[-4,1,2],
      [-4,0,2],[-3,0,3],[-2,0,3],[-1,0,4],[0,0,4]
    ];
    for(const [dx,dz,height] of ascent){
      const tile=tileAt(world,center.x+dx,center.z+dz);
      if(!tile)continue;
      tile.height=Math.min(height,center.peak);
      tile.terrain='ramp';tile.waterDepth=0;tile.prop=null;tile.blocked=false;
    }
  }
}

export function assignWaterDepth(world:WorldData):void {
  const distances=new Uint8Array(world.tiles.length);
  distances.fill(255);
  const queue:number[]=[];
  for(const tile of world.tiles){
    if(tile.terrain!=='water'){tile.waterDepth=0;continue;}
    const edge=[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dz])=>
      tileAt(world,tile.x+dx,tile.z+dz)?.terrain!=='water');
    if(edge){const key=index(tile.x,tile.z);distances[key]=0;queue.push(key);}
  }
  for(let head=0;head<queue.length;head++){
    const key=queue[head],x=key%WORLD_SIZE,z=Math.floor(key/WORLD_SIZE);
    for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
      const neighbor=tileAt(world,x+dx,z+dz);
      if(!neighbor||neighbor.terrain!=='water')continue;
      const next=index(neighbor.x,neighbor.z);
      if(distances[next]<=distances[key]+1)continue;
      distances[next]=distances[key]+1;
      queue.push(next);
    }
  }
  for(const tile of world.tiles)if(tile.terrain==='water'){
    const depth=distances[index(tile.x,tile.z)];
    const variation=(noise(tile.x/8,tile.z/8,world.seed+1183)-0.5)*0.05;
    tile.height=0;
    tile.waterDepth=clamp(0.14+Math.min(depth,5)*0.172+variation,0.12,1);
  }
}

function addLakeBridge(world: WorldData, shrine: Point): void {
  const route=findPath(world,world.start,shrine);
  const middle=route.findIndex((tile,i)=>i>1&&i<route.length-2&&distance(tile,shrine)>=8&&distance(tile,shrine)<=11&&
    (route[i-1].x===route[i+1].x||route[i-1].z===route[i+1].z));
  if (middle<0) return;
  const horizontal=route[middle-1].z===route[middle+1].z;
  for (const tile of route.slice(middle-1,middle+2)) {
    const bridge=tileAt(world,tile.x,tile.z)!;
    bridge.terrain='bridge';bridge.height=1;bridge.prop=null;bridge.blocked=false;
    for (const side of [-1,1]) {
      const water=tileAt(world,tile.x+(horizontal?0:side),tile.z+(horizontal?side:0));
      if (water && !['path','bridge','plaza','ramp'].includes(water.terrain)) {
        water.terrain='water';water.height=0;water.waterDepth=0;water.prop=null;water.blocked=true;
      }
    }
  }
}

function addScenicBuildings(world: WorldData): void {
  const requests = [
    { id: 'woodcutter-hut' as const, biome: 'bosque' as const, target: { x: 37, z: 39 } },
    { id: 'boathouse' as const, biome: 'lago' as const, target: { x: 77, z: 65 } },
    { id: 'casa-estalagem' as const, biome: 'bosque' as const, target: { x: 31, z: 57 } },
    { id: 'casa-pedra' as const, biome: 'brasa' as const, target: { x: 70, z: 42 } },
    { id: 'casa-caverna' as const, biome: 'brasa' as const, target: { x: 81, z: 49 } }
  ];
  for (const request of requests) {
    const rocky=request.id==='casa-pedra'||request.id==='casa-caverna';
    const widthRadius=request.id==='casa-estalagem'?2:1;
    const options = world.tiles.filter(tile => tile.biome === request.biome &&
      (tile.terrain === 'grass' || rocky && tile.terrain === 'stone') &&
      distance(tile,request.target) < 27 && distance(tile,world.start) > 9 &&
      world.places.every(place => distance(tile,place) > (widthRadius===2?8:6)) &&
      world.decorations.every(place => distance(tile,place) > (widthRadius===2?9:7)));
    options.sort((a,b) => distance(a,request.target)-distance(b,request.target) || hash(a.x,a.z,world.seed)-hash(b.x,b.z,world.seed));
    for (const center of options) {
      const footprint: Tile[] = [];
      for (let dz=-1;dz<=1;dz++) for (let dx=-widthRadius;dx<=widthRadius;dx++) {
        const tile=tileAt(world,center.x+dx,center.z+dz);
        if (tile) footprint.push(tile);
      }
      if (footprint.length!==3*(widthRadius*2+1) || footprint.some(tile => tile.blocked || tile.prop ||
        tile.terrain!==center.terrain || tile.height!==center.height)) continue;
      const door=tileAt(world,center.x,center.z+2);
      if(request.id.startsWith('casa-')&&(!door||door.blocked||door.terrain==='water'))continue;
      for (const tile of footprint) tile.blocked=true;
      world.decorations.push({id:request.id,kind:'decoration',x:center.x,z:center.z});
      if (validateWorld(world)) {
        break;
      }
      world.decorations.pop();
      for (const tile of footprint) tile.blocked=false;
    }
  }
}

function addTownBuildings(world:WorldData):void {
  const buildings=[
    {id:'casa-padaria' as const,x:40,z:55},
    {id:'casa-vila' as const,x:57,z:55}
  ];
  for(const building of buildings){
    clearArea(world,building,2,1,'plaza');
    world.decorations.push({id:building.id,kind:'decoration',x:building.x,z:building.z});
    carveRoad(world,{x:building.x,z:building.z+2},{x:50,z:57},world.seed+700+building.x);
  }
  for(const building of buildings){
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      const tile=tileAt(world,building.x+dx,building.z+dz);
      if(tile)tile.blocked=true;
    }
    const door=tileAt(world,building.x,building.z+2);
    if(door)roadTile(door,'path');
  }
}

function addTownProps(world:WorldData):void {
  const planned:[number,number,Exclude<Prop,null>][]=[
    [48,43,'well'],[45,50,'bench'],[54,51,'bench'],[55,52,'crates'],
    [42,51,'flower-planter'],[55,58,'flower-planter'],[43,43,'bloom-bush'],
    [52,43,'bloom-bush'],[41,59,'bloom-bush'],[58,59,'bloom-bush'],
    [41,48,'village-lamp'],[57,48,'village-lamp'],[45,57,'village-lamp'],
    [53,57,'village-lamp'],[46,42,'flower-planter'],[51,42,'flower-planter'],
    [42,57,'street-sign'],[56,45,'market-barrel'],[58,53,'market-crate'],
    [58,62,'carroca-mercador'],[33,47,'arco-pedra']
  ];
  for(const [preferredX,preferredZ,prop] of planned){
    const largeProp=prop==='carroca-mercador'||prop==='arco-pedra';
    const options:Tile[]=[];
    const search=largeProp?4:2;
    for(let dz=-search;dz<=search;dz++)for(let dx=-search;dx<=search;dx++){
      const tile=tileAt(world,preferredX+dx,preferredZ+dz);
      if(tile)options.push(tile);
    }
    options.sort((a,b)=>distance(a,{x:preferredX,z:preferredZ})-distance(b,{x:preferredX,z:preferredZ}));
    for(const tile of options){
      if(tile.height!==1||tile.blocked||tile.prop||!['grass','plaza'].includes(tile.terrain)||
        distance(tile,world.start)<1.7||
        world.places.some(place=>place.kind==='house'&&distance(tile,place)<(largeProp?4.8:3.3))||
        world.decorations.some(place=>place.id.startsWith('casa-')&&distance(tile,place)<(largeProp?4.8:3.4)))continue;
      if(largeProp&&[-1,0,1].some(dz=>[-1,0,1].some(dx=>{
        const near=tileAt(world,tile.x+dx,tile.z+dz);
        return !near||near.height!==tile.height||near.terrain==='water';
      })))continue;
      const oldBlocked=tile.blocked;
      tile.prop=prop;tile.blocked=true;
      if(validateWorld(world))break;
      tile.prop=null;tile.blocked=oldBlocked;
    }
  }
}

export function generateWorld(seed: number): WorldData {
  const start = { x: 48, z: 48 };
  const shrinePoints: Point[] = [
    { x: 23 + Math.floor(hash(1, 2, seed) * 6), z: 23 + Math.floor(hash(3, 4, seed) * 6) },
    { x: 69 + Math.floor(hash(5, 6, seed) * 6), z: 21 + Math.floor(hash(7, 8, seed) * 7) },
    { x: 68 + Math.floor(hash(9, 10, seed) * 7), z: 69 + Math.floor(hash(11, 12, seed) * 7) }
  ];
  const anchors = [shrinePoints[0], shrinePoints[1], shrinePoints[2]];
  const biomes: Biome[] = ['bosque', 'brasa', 'lago'];
  const tiles: Tile[] = [];
  for (let z = 0; z < WORLD_SIZE; z++) for (let x = 0; x < WORLD_SIZE; x++) {
    const warpX = (noise(x / 19, z / 19, seed + 91) - 0.5) * 14;
    const warpZ = (noise(x / 19, z / 19, seed + 92) - 0.5) * 14;
    let nearest = 0, best = Infinity;
    for (let i = 0; i < anchors.length; i++) {
      const d = distance({x: x + warpX, z: z + warpZ}, anchors[i]);
      if (d < best) { best = d; nearest = i; }
    }
    let biome = biomes[nearest];
    if (distance({x,z}, start) < 10) biome = 'bosque';
    const elevation = 0.6 * noise(x / 22, z / 22, seed + 2) +
      0.29 * noise(x / 10, z / 10, seed + 3) +
      0.11 * noise(x / 4.5, z / 4.5, seed + 4);
    const bias = biome === 'brasa' ? 0.2 : biome === 'lago' ? -0.13 : 0;
    const height = clamp(Math.floor((elevation + bias) * 3.35), 0, 3);
    const moisture = noise(x / 9, z / 9, seed + 17);
    const lake = biome === 'lago' && ((distance({x,z}, {x:81,z:82}) < 12 + moisture * 4) || (height === 0 && moisture > 0.54));
    const terrain: Terrain = lake ? 'water' : biome === 'brasa' && height >= 2 ? 'stone' : 'grass';
    tiles.push({ x, z, height:lake?0:height, waterDepth:0, biome, terrain, prop: null, blocked: terrain === 'water' });
  }
  const world: WorldData = { seed, size: WORLD_SIZE, tiles, start, places: [], decorations: [], wild: [], walkers: [], caches: [], items: [] };
  raiseTerraces(world);
  for (const point of shrinePoints) carveRoad(world, start, point, seed);
  clearArea(world, start, 7, 1, 'plaza');
  for (const point of shrinePoints) {
    clearArea(world, point, 4, 1, 'path');
    clearArea(world, point, 2, 2, 'plaza');
    for (const [dx,dz] of [[0,3],[0,-3],[3,0],[-3,0]]) {
      const ramp = tileAt(world, point.x + dx, point.z + dz);
      const inner = tileAt(world, point.x + Math.sign(dx) * 2, point.z + Math.sign(dz) * 2);
      if (ramp) { ramp.terrain = 'ramp'; ramp.height = 1; }
      if (inner) inner.terrain = 'ramp';
    }
  }
  addLakeBridge(world,shrinePoints[2]);
  world.places = [
    { id: 'casa-cartas', name: 'Ateliê de Cartas', kind: 'house', x: 44, z: 46 },
    { id: 'casa-cura', name: 'Casa de Repouso', kind: 'house', x: 53, z: 46 },
    { id: 'casa-arquivo', name: 'Arquivo do Éter', kind: 'house', x: 47, z: 54 },
    { id: 'selo-natureza', name: 'Santuário do Bosque', kind: 'shrine', element: 'natureza', ...shrinePoints[0] },
    { id: 'selo-fogo', name: 'Santuário das Brasas', kind: 'shrine', element: 'fogo', ...shrinePoints[1] },
    { id: 'selo-agua', name: 'Santuário da Maré', kind: 'shrine', element: 'agua', ...shrinePoints[2] }
  ];
  for (const place of world.places.filter(item=>item.kind==='house')) {
    for (let dz=-1;dz<=1;dz++) for (let dx=-1;dx<=1;dx++) {
      const tile=tileAt(world,place.x+dx,place.z+dz);
      if (tile && !(dx===0&&dz===1)) tile.blocked=true;
    }
  }
  for (let x=40;x<=58;x++) roadTile(tileAt(world,x,49)!,'path');
  for (let z=49;z<=58;z++) roadTile(tileAt(world,50,z)!,'path');
  carveRoad(world,{x:40,z:49},{x:shrinePoints[0].x+3,z:shrinePoints[0].z+3},seed+501);
  carveRoad(world,{x:58,z:49},{x:shrinePoints[1].x-3,z:shrinePoints[1].z+3},seed+502);
  carveRoad(world,{x:50,z:58},{x:shrinePoints[2].x-3,z:shrinePoints[2].z-3},seed+503);
  for (let z=52;z<=56;z++) roadTile(tileAt(world,49,z)!,'path');
  for (let x=47;x<=49;x++) roadTile(tileAt(world,x,56)!,'path');
  addTownBuildings(world);
  for (let z = 2; z < WORLD_SIZE - 2; z++) for (let x = 2; x < WORLD_SIZE - 2; x++) {
    const tile = tileAt(world, x, z)!;
    if (tile.terrain !== 'grass' && tile.terrain !== 'stone') continue;
    if (distance({x,z}, start) < 10 || world.places.some(place => distance({x,z}, place) < 5) ||
      world.decorations.some(place=>place.id.startsWith('casa-')&&distance({x,z},place)<5)) continue;
    const nearbyRoad = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz]) => ['path','bridge','plaza','ramp'].includes(tileAt(world,x+dx,z+dz)?.terrain || ''));
    if (nearbyRoad) continue;
    const roll = hash(x,z,seed + 201);
    const patch = noise(x/8,z/8,seed+205);
    const ridge = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz]) => {
      const next=tileAt(world,x+dx,z+dz);
      return next&&next.height<tile.height;
    });
    const shoreline = [[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]]
      .some(([dx,dz])=>tileAt(world,x+dx,z+dz)?.terrain==='water');
    // Low-frequency patches leave useful open space between natural clusters.
    if(patch<0.43&&!ridge&&!shoreline)continue;
    if(tile.height>=3) {
      if(ridge&&roll<0.045)tile.prop='mountain-boulder';
      else if(ridge&&roll<0.11)tile.prop='shale-fragments';
      else if(patch>0.7&&roll>0.97)tile.prop='mineral-cluster';
      else if(roll<0.012)tile.prop='rock';
      tile.blocked=['mountain-boulder','rock'].includes(tile.prop||'');
      continue;
    }
    if (tile.biome === 'bosque') {
      if (roll < 0.017) tile.prop='tree';
      else if (roll < 0.03) tile.prop='pine';
      else if (roll < 0.043) tile.prop='copper-tree';
      else if (roll < 0.054) tile.prop='moss-rock';
      else if (patch>0.63&&roll<0.067) tile.prop='forest-shrub';
      else if (patch>0.7&&roll<0.074) tile.prop='fallen-log';
      else if (patch>0.66&&roll<0.083) tile.prop='root-cluster';
      else if (patch>0.56&&roll>0.986) tile.prop='field-flowers';
      else if (patch>0.6&&roll>0.976) tile.prop='flower-bush';
      else if (patch>0.64&&roll>0.964) tile.prop='grass-tuft';
    } else if (tile.biome === 'brasa') {
      if (ridge&&roll<0.034) tile.prop='mountain-boulder';
      else if (roll < 0.025) tile.prop='rock';
      else if (roll < 0.048) tile.prop='basalt-rock';
      else if (patch>0.66&&roll<0.064) tile.prop='basalt-shard';
      else if (patch>0.72&&roll<0.078) tile.prop='ash-heap';
      else if (patch>0.75&&roll>0.984) tile.prop='obsidian-spire';
    } else {
      if (roll < 0.011) tile.prop='tree';
      else if (roll < 0.023) tile.prop='marsh-willow';
      else if (shoreline&&roll<0.055) tile.prop='swamp-reeds';
      else if (shoreline&&roll<0.082) tile.prop='river-stones';
      else if (shoreline&&roll>0.979) tile.prop='driftwood';
      else if (patch>0.61&&roll<0.057) tile.prop='reeds';
      else if (patch>0.64&&roll>0.979) tile.prop='wet-rock';
    }
    if(['tree','pine','copper-tree','marsh-willow'].includes(tile.prop||'')){
      const tooClose=[-2,-1,0].some(dz=>[-2,-1,0,1,2].some(dx=>{
        if(dz===0&&dx>=0)return false;
        const neighbor=tileAt(world,x+dx,z+dz);
        return neighbor&&['tree','pine','copper-tree','marsh-willow'].includes(neighbor.prop||'')&&Math.hypot(dx,dz)<2.4;
      }));
      if(tooClose)tile.prop=null;
    }
    tile.blocked = ['tree','pine','copper-tree','marsh-willow','rock','moss-rock','basalt-rock',
      'fallen-log','fieldstone','mountain-boulder','basalt-shard','obsidian-spire','wet-rock'].includes(tile.prop||'');
  }
  for (const [x,z] of [[43,50],[53,50],[51,53]]) {
    const tile=tileAt(world,x,z);
    if (tile) {tile.prop='lamp';tile.blocked=true;}
  }
  addTownProps(world);
  addScenicBuildings(world);
  const connected = reachable(world);
  for (const [id,role,x,z] of [
    ['nara','cartographer',41,49],
    ['olmo','botanist',56,49],
    ['tavio','baker',41,58],
    ['lina','courier',56,58]
  ] as const) {
    const options=world.tiles.filter(tile=>distance(tile,{x,z})<=3&&!tile.blocked&&tile.terrain!=='water'&&
      connected.has(index(tile.x,tile.z))&&world.walkers.every(npc=>distance(tile,npc)>2));
    options.sort((a,b)=>distance(a,{x,z})-distance(b,{x,z}));
    const spawn=options[0];
    if (spawn) {
      world.walkers.push({id,role,x:spawn.x+0.5,z:spawn.z+0.5,homeX:spawn.x,homeZ:spawn.z});
    }
  }
  const candidates = world.tiles.filter(tile => connected.has(index(tile.x,tile.z)) && !tile.blocked && tile.terrain !== 'water' && distance(tile,start) > 11 && world.places.every(place => distance(tile,place) > 5));
  const ids = [...BASE_SPECIES];
  for (let i = 0; i < 44; i++) {
    const tile = candidates[Math.floor(hash(i, 31, seed + 311) * candidates.length)];
    if (!tile) break;
    const matching = ids.filter(id => SPECIES[id].biome === tile.biome);
    const species = matching[i % matching.length];
    world.wild.push({ id: 'wild-' + i, species, level: 2 + Math.floor(hash(i,43,seed) * 4), night: species === 'cinzuri' || species === 'musgato', x: tile.x, z: tile.z, homeX: tile.x, homeZ: tile.z });
  }
  for (let i = 0; i < 18; i++) {
    const tile = candidates[Math.floor(hash(i,71,seed + 411) * candidates.length)];
    if (!tile) break;
    const element: Element = tile.biome === 'brasa' ? 'fogo' : tile.biome === 'lago' ? 'agua' : 'natureza';
    world.caches.push({ id: 'cache-' + i, element, x: tile.x, z: tile.z });
  }
  const sites=itemSites(world,connected);
  const itemBiomes:Biome[]=['bosque','brasa','lago'];
  for(let i=0;i<GROUND_ITEM_LIMIT;i++){
    const chosen=pickItemSite(world,sites,world.items,i,itemBiomes[i%itemBiomes.length])??
      pickItemSite(world,sites,world.items,i);
    if(!chosen)break;
    world.items.push({id:'item-'+i,itemId:ITEM_IDS[i%ITEM_IDS.length],x:chosen.x,z:chosen.z});
  }
  assignWaterDepth(world);
  return world;
}

export function validateWorld(world: WorldData): boolean {
  const connected = reachable(world);
  return world.places.every(place => {
    if (place.kind === 'house') return connected.has(index(place.x, place.z+1));
    return [[0,2],[0,-2],[2,0],[-2,0]].some(([dx,dz]) => connected.has(index(place.x + dx,place.z + dz)));
  }) && world.decorations.filter(place=>place.id.startsWith('casa-'))
    .every(place=>connected.has(index(place.x,place.z+2)))
    && world.caches.every(cache => connected.has(index(cache.x,cache.z)))
    && world.items.every(item => connected.has(index(item.x,item.z)))
    && world.walkers.every(npc => connected.has(index(Math.floor(npc.x),Math.floor(npc.z))));
}
