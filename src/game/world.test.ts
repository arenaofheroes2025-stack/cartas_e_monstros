import { describe, expect, it } from 'vitest';
import { canStep, findPath, generateWorld, GROUND_ITEM_LIMIT, GROUND_ITEM_RESPAWN_DISTANCE, GROUND_ITEM_SPACING, reachable, replacementGroundItem, tileAt, validateWorld, WORLD_SIZE, index } from './world';
import { canPlayerOccupy } from './assetCollision';

describe('geração da região',()=>{
  it('reproduz o mesmo mundo para a mesma semente',()=>{
    const a=generateWorld(43127),b=generateWorld(43127);
    expect(a.tiles).toEqual(b.tiles);
    expect(a.places).toEqual(b.places);
    expect(a.decorations).toEqual(b.decorations);
    expect(a.walkers).toEqual(b.walkers);
    expect(a.caches).toEqual(b.caches);
    expect(a.items).toEqual(b.items);
  });
  it('mantém casas, santuários e cartas alcançáveis em várias sementes',()=>{
    for(let seed=1;seed<=30;seed++) {
      const world=generateWorld(seed*9173);
      expect(world.tiles).toHaveLength(WORLD_SIZE*WORLD_SIZE);
      expect(world.places.filter(place=>place.kind==='shrine')).toHaveLength(3);
      expect(world.decorations.map(place=>place.id).sort(),'seed '+seed).toEqual([
        'boathouse','casa-caverna','casa-estalagem','casa-padaria','casa-pedra','casa-vila','woodcutter-hut'
      ]);
      expect(world.walkers.map(npc=>npc.id).sort(),'seed '+seed).toEqual(['lina','nara','olmo','tavio']);
      expect(validateWorld(world),'seed '+seed).toBe(true);
      expect(world.items,'seed '+seed).toHaveLength(GROUND_ITEM_LIMIT);
      for(const item of world.items){
        expect(Math.hypot(item.x-world.start.x,item.z-world.start.z)).toBeGreaterThan(11);
        for(const other of world.items){
          if(other===item)continue;
          expect(Math.hypot(item.x-other.x,item.z-other.z),`seed ${seed}: ${item.id}/${other.id}`)
            .toBeGreaterThanOrEqual(GROUND_ITEM_SPACING);
        }
      }
      const replacement=replacementGroundItem(world,world.items.slice(1),world.items[0],
        {x:world.items[0].x+0.5,z:world.items[0].z+0.5},0);
      expect(replacement,`seed ${seed}: sem reposição possível`).toBeDefined();
    }
  },15000);
  it('substitui uma coleta por um ponto alcançável e distante',()=>{
    const world=generateWorld(40732);
    const collected=world.items[0];
    const active=world.items.slice(1);
    const player={x:collected.x+0.5,z:collected.z+0.5};
    const next=replacementGroundItem(world,active,collected,player,0)!;
    expect(next).toEqual(replacementGroundItem(world,active,collected,player,0));
    expect(Math.hypot(next.x-collected.x,next.z-collected.z)).toBeGreaterThanOrEqual(GROUND_ITEM_RESPAWN_DISTANCE);
    expect(Math.hypot(next.x-player.x,next.z-player.z)).toBeGreaterThanOrEqual(GROUND_ITEM_RESPAWN_DISTANCE);
    expect(active.every(item=>Math.hypot(next.x-item.x,next.z-item.z)>=GROUND_ITEM_SPACING)).toBe(true);
    expect(reachable(world).has(index(next.x,next.z))).toBe(true);
  });
  it('bloqueia água e penhascos e permite rampas',()=>{
    const world=generateWorld(1898);
    const water=world.tiles.find(tile=>tile.terrain==='water'&&tile.x>0);
    expect(water).toBeDefined();
    const from={x:water!.x-1,z:water!.z};
    expect(canStep(world,from,water!)).toBe(false);
    const shrine=world.places.find(place=>place.kind==='shrine')!;
    const inner=tileAt(world,shrine.x,shrine.z+2)!;
    const outer=tileAt(world,shrine.x,shrine.z+3)!;
    expect(inner.height).toBe(2);
    expect(outer.height).toBe(1);
    expect(canStep(world,outer,inner)).toBe(true);
  });
  it('mantém pontes, cinco alturas e portas das casas transitáveis',()=>{
    const world=generateWorld(74123);
    expect(new Set(world.tiles.map(tile=>tile.height))).toEqual(new Set([0,1,2,3,4]));
    expect(world.tiles.some(tile=>tile.terrain==='bridge')).toBe(true);
    const connected=reachable(world);
    for(const house of world.places.filter(place=>place.kind==='house')){
      expect(tileAt(world,house.x,house.z)?.blocked).toBe(true);
      expect(tileAt(world,house.x,house.z+1)?.blocked).toBe(false);
      expect(connected.has(index(house.x,house.z+1))).toBe(true);
    }
  });
  it('forma fundos submersos progressivos e elevações com subida',()=>{
    const world=generateWorld(74123);
    const water=world.tiles.filter(tile=>tile.terrain==='water');
    expect(water.some(tile=>tile.waterDepth<0.22)).toBe(true);
    expect(water.some(tile=>tile.waterDepth>0.8)).toBe(true);
    expect(water.every(tile=>tile.height===0&&tile.waterDepth>0)).toBe(true);
    for(const tile of water)for(const [dx,dz] of [[1,0],[0,1]]){
      const next=tileAt(world,tile.x+dx,tile.z+dz);
      if(next?.terrain==='water')
        expect(Math.abs(next.waterDepth-tile.waterDepth)).toBeLessThan(0.23);
    }
    for(const center of [{x:19,z:46,peak:3},{x:81,z:43,peak:4},{x:61,z:80,peak:3}]){
      expect(tileAt(world,center.x,center.z)?.height).toBe(center.peak);
      expect(world.tiles.some(tile=>tile.terrain==='ramp'&&
        Math.hypot(tile.x-center.x,tile.z-center.z)<8)).toBe(true);
      expect(findPath(world,{x:center.x-8,z:center.z+1},center,800).length).toBeGreaterThan(0);
    }
  });
  it('distribui as novas árvores e pedras sem bloquear recursos',()=>{
    const world=generateWorld(40732);
    for(const prop of ['pine','copper-tree','marsh-willow','moss-rock','basalt-rock','flower-bush']) {
      expect(world.tiles.some(tile=>tile.prop===prop),prop).toBe(true);
    }
    expect(validateWorld(world)).toBe(true);
  });
  it('mantém salgueiros azuis, juncos e pedras arredondadas dentro da água',()=>{
    for(const seed of [40732,82557,346]){
      const world=generateWorld(seed);
      const willows=world.tiles.filter(tile=>tile.prop==='tree'&&tile.biome==='lago');
      const reeds=world.tiles.filter(tile=>tile.prop==='reeds');
      const stones=world.tiles.filter(tile=>tile.prop==='river-stones');
      expect(willows.length,`salgueiros na seed ${seed}`).toBeGreaterThan(0);
      expect(reeds.length,`juncos na seed ${seed}`).toBeGreaterThan(0);
      expect(stones.length,`pedras na seed ${seed}`).toBeGreaterThan(0);
      expect([...willows,...reeds,...stones].every(tile=>tile.terrain==='water')).toBe(true);
      expect(willows.every(tile=>tile.waterDepth<=0.5)).toBe(true);
      expect(stones.every(tile=>tile.waterDepth<=0.38)).toBe(true);
      expect(reeds.some(tile=>tile.waterDepth>0.5)).toBe(true);
      const water=world.tiles.filter(tile=>tile.terrain==='water');
      expect((willows.length+reeds.length+stones.length)/water.length).toBeLessThan(0.15);
    }
  });
  it('coloca os novos objetos da vila sem fechar caminhos principais',()=>{
    const world=generateWorld(40732);
    for(const prop of ['village-lamp','bloom-bush','bench','well','crates','arco-pedra'])
      expect(world.tiles.some(tile=>tile.prop===prop),prop).toBe(true);
    expect(world.tiles.some(tile=>tile.prop==='flower-planter'||tile.prop==='carroca-mercador')).toBe(false);
    expect(validateWorld(world)).toBe(true);
  });
  it('mantém as portas da vila alcançáveis usando a colisão real dos PNGs',()=>{
    for(const seed of [40732,82557]){
      const world=generateWorld(seed),seen=new Set([index(world.start.x,world.start.z)]);
      const queue=[world.start];
      for(let head=0;head<queue.length;head++){
        const current=queue[head];
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const next={x:current.x+dx,z:current.z+dz},key=index(next.x,next.z);
          if(seen.has(key)||!canPlayerOccupy(world,{x:current.x+0.5,z:current.z+0.5},{x:next.x+0.5,z:next.z+0.5}))continue;
          seen.add(key);queue.push(next);
        }
      }
      for(const house of [...world.places.filter(place=>place.kind==='house'),...world.decorations.filter(place=>place.id.startsWith('casa-'))]){
        const door=house.kind==='house'?house.z+1:house.z+2;
        expect(seen.has(index(house.x,door)),`${seed}: ${house.id}`).toBe(true);
      }
    }
  });
  it('mantém as árvores espaçadas para deixar corredores de caminhada',()=>{
    const world=generateWorld(40732);
    const trees=world.tiles.filter(tile=>['tree','pine','copper-tree','marsh-willow'].includes(tile.prop||''));
    expect(trees.length).toBeLessThan(180);
    for(const tree of trees){
      const nearest=trees.filter(other=>other!==tree).reduce((distance,other)=>Math.min(distance,Math.hypot(other.x-tree.x,other.z-tree.z)),Infinity);
      expect(nearest).toBeGreaterThanOrEqual(2.4);
    }
  });
});
