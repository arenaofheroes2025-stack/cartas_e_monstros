import { describe,expect,it } from 'vitest';
import { BIOME_PROP_KITS } from './biomeArt';
import { chunkOf,generateChunk,generateSeededChunk } from './chunkWorld';
import { canStep,generateWorld,tileAt,type Tile } from './world';
import { WorldStore } from './worldStore';

describe('mundo procedural contínuo',()=>{
  it('gera chunks reproduzíveis independentemente da ordem e de coordenadas negativas',()=>{
    const seed=74231;
    const first=generateSeededChunk(seed,-11,8);
    generateSeededChunk(seed,21,-5);
    expect(generateSeededChunk(seed,-11,8)).toEqual(first);
    expect(generateSeededChunk(seed,21,-5)).toEqual(generateChunk(seed,21,-5));
  });
  it('preserva a região inicial e permite atravessar suas quatro margens',()=>{
    for(const seed of [40732,82557,346]){
      const core=generateWorld(seed),store=new WorldStore(core);
      for(let i=0;i<6;i++)for(const [cx,cz] of [[-1,i],[6,i],[i,-1],[i,6]])
        store.installChunk(generateChunk(core.seed,cx,cz,core));
      for(const side of ['west','east','north','south']){
        let passages=0;
        for(let n=0;n<96;n++){
          const from=side==='west'?{x:0,z:n}:side==='east'?{x:95,z:n}:
            side==='north'?{x:n,z:0}:{x:n,z:95};
          const to=side==='west'?{x:-1,z:n}:side==='east'?{x:96,z:n}:
            side==='north'?{x:n,z:-1}:{x:n,z:96};
          if(canStep(store,from,to))passages++;
          expect(tileAt(store,from.x,from.z)).toEqual(core.tiles[from.z*96+from.x]);
        }
        expect(passages,`${seed}: ${side}`).toBeGreaterThan(0);
      }
      store.dispose();
    }
  });
  it('mantém passagens entre chunks externos e libera dados distantes',()=>{
    const core=generateWorld(9913),store=new WorldStore(core);
    for(let cz=11;cz<=13;cz++)for(let cx=11;cx<=13;cx++)store.installChunk(generateChunk(core.seed,cx,cz));
    const west=store.chunks.get('12,12')!,east=store.chunks.get('13,12')!;
    expect(west.tiles).toHaveLength(256);
    expect(east.tiles).toHaveLength(256);
    let passages=0;
    for(let z=12*16;z<13*16;z++)if(canStep(store,{x:13*16-1,z},{x:13*16,z}))passages++;
    expect(passages).toBeGreaterThan(0);
    store.evictChunk(east);
    expect(tileAt(store,13*16,12*16)).toBeUndefined();
    store.installChunk(generateChunk(core.seed,13,12));
    expect(store.chunks.get('13,12')?.tiles).toEqual(east.tiles);
    store.dispose();
  });
  it('persiste a remoção de objetos como diferença do chunk',()=>{
    const core=generateWorld(1132),store=new WorldStore(core);
    const changes:Record<string,{removedItems:string[];openedCaches:string[];removedProps:string[]}>={};
    store.setChunkChanges(changes);
    let chunk=generateChunk(core.seed,20,20);
    while(!chunk.tiles.some(tile=>tile.prop))chunk=generateChunk(core.seed,chunk.x+1,chunk.z);
    store.installChunk(chunk);
    const prop=chunk.tiles.find(tile=>tile.prop)!;
    expect(store.removeProp(prop.x,prop.z)).toBe(true);
    store.evictChunk(chunk);
    store.installChunk(generateChunk(core.seed,chunk.x,chunk.z));
    expect(tileAt(store,prop.x,prop.z)?.prop).toBeNull();
    expect(changes[`${chunk.x},${chunk.z}`].removedProps).toContain(`${prop.x},${prop.z}`);
    store.dispose();
  });
  it('evita grandes áreas secas e distribui árvores nas encostas novas',()=>{
    const tiles=[];
    for(let z=9;z<13;z++)for(let x=10;x<14;x++)
      tiles.push(...generateChunk(346,x,z).tiles);
    expect(tiles.some(tile=>tile.landscape==='desert')).toBe(false);
    expect(tiles.filter(tile=>['tree','pine','copper-tree','marsh-willow'].includes(tile.prop??'')).length).toBeGreaterThan(25);
    expect(tiles.filter(tile=>tile.prop).length).toBeGreaterThan(80);
  });
  it('não coloca carroças nem jardineiras nos chunks externos',()=>{
    expect(BIOME_PROP_KITS.city).not.toContain('flower-planter');
    for(const seed of [346,40732,82557])for(const [x,z] of [[-2,3],[3,-2],[6,3],[3,6],[8,8],[-8,-8],[12,0],[0,12]]){
      const tiles=generateChunk(seed,x,z).tiles;
      expect(tiles.some(tile=>tile.prop==='flower-planter'||tile.prop==='carroca-mercador'),`${seed}:${x},${z}`).toBe(false);
    }
  });
  it('forma água e montanhas em extensões maiores que um chunk',()=>{
    const tiles=[];
    for(let z=8;z<17;z++)for(let x=8;x<17;x++)
      tiles.push(...generateChunk(346,x,z).tiles);
    const lakes=tiles.filter(tile=>tile.landscape==='lake'&&tile.terrain==='water');
    expect(lakes.length).toBeGreaterThan(30);
    const lakeSet=new Set(lakes.map(tile=>`${tile.x},${tile.z}`));
    expect(lakes.some(tile=>tile.x%16===15&&lakeSet.has(`${tile.x+1},${tile.z}`))).toBe(true);
    expect(tiles.filter(tile=>tile.height>=4).length).toBeGreaterThan(100);
  });
  it('distribui salgueiros, juncos e pedras apenas na água dos chunks externos',()=>{
    const tiles:Tile[]=[];
    for(let z=8;z<17;z++)for(let x=8;x<17;x++)
      tiles.push(...generateChunk(346,x,z).tiles);
    const willows=tiles.filter(tile=>tile.prop==='tree'&&tile.biome==='lago');
    const reeds=tiles.filter(tile=>tile.prop==='reeds');
    const stones=tiles.filter(tile=>tile.prop==='river-stones');
    expect(willows.length).toBeGreaterThan(0);
    expect(reeds.length).toBeGreaterThan(0);
    expect(stones.length).toBeGreaterThan(0);
    expect([...willows,...reeds,...stones].every(tile=>tile.terrain==='water')).toBe(true);
    const byPosition=new Map(tiles.map(tile=>[`${tile.x},${tile.z}`,tile]));
    const extra=new Map<string,ReturnType<typeof generateChunk>>();
    const at=(x:number,z:number)=>{
      const found=byPosition.get(`${x},${z}`);
      if(found)return found;
      const cx=chunkOf(x),cz=chunkOf(z),key=`${cx},${cz}`;
      let chunk=extra.get(key);
      if(!chunk){chunk=generateChunk(346,cx,cz);extra.set(key,chunk);}
      return chunk.tiles[(z-cz*16)*16+x-cx*16];
    };
    const nearLowBank=(tile:(typeof tiles)[number],radius:number)=>{
      for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
        if(Math.hypot(dx,dz)>radius)continue;
        const bank=at(tile.x+dx,tile.z+dz);
        if(bank.terrain!=='water'&&bank.terrain!=='bridge'&&bank.height<=tile.height+1)return true;
      }
      return false;
    };
    expect(willows.every(tile=>nearLowBank(tile,2.25))).toBe(true);
    expect(stones.every(tile=>nearLowBank(tile,1.5))).toBe(true);
    expect(reeds.some(tile=>!nearLowBank(tile,2.25))).toBe(true);
    expect((willows.length+reeds.length+stones.length)/
      tiles.filter(tile=>tile.terrain==='water').length).toBeLessThan(0.15);
  });
});
