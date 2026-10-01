import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from './game';
import { addItem, BAG_CAPACITY, type InventoryItem } from './items';
import { createMonster, maxHp } from './content';
import { readSave } from './save';
import { GROUND_ITEM_LIMIT, GROUND_ITEM_RESPAWN_DISTANCE, GROUND_ITEM_SPACING } from './world';

const store=new Map<string,string>();
beforeEach(()=>{store.clear();vi.stubGlobal('localStorage',{
  getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value)
});});

function readyBattle(game:Game):void {
  game.beginBattle(game.wildActors[0]);
  game.battle!.intro=0;
  game.battle!.ally.attackTimer=999;
  game.battle!.foe.attackTimer=999;
}

describe('mochila e itens de batalha',()=>{
  it('equipa uma comida e um suporte por criatura a partir da mochila ou do inventário',()=>{
    const game=new Game();game.newGame('brasito',40732);
    const monster=game.save!.party[0];
    game.save!.inventory.push({uid:'casca-reserva',itemId:'pocao-casca'});
    expect(game.equipMonsterItem(monster.uid,'food','starter-pao')).toBe(true);
    expect(game.equipMonsterItem(monster.uid,'support','casca-reserva')).toBe(true);
    expect(monster.heldItems).toEqual({food:'starter-pao',support:'casca-reserva'});
    expect(game.save!.battleBag[0]).toBeNull();
    expect(game.save!.inventory.some(item=>item.uid==='starter-pao')).toBe(true);
    expect(game.equipMonsterItem(monster.uid,'food','starter-tonico')).toBe(false);
    expect(game.equipBattleItem('starter-pao')).toBe(false);
    const teammate=createMonster('gotejo',1,'teammate');game.save!.party.push(teammate);
    expect(game.equipMonsterItem(teammate.uid,'food','starter-pao')).toBe(false);
    expect(readSave()!.party[0].heldItems).toEqual(monster.heldItems);
    game.unequipMonsterItem(monster.uid,'food');
    expect(monster.heldItems.food).toBeNull();
    expect(game.equipBattleItem('starter-pao')).toBe(true);
  });
  it('ativa o suporte automaticamente depois da invocação e identifica o efeito visual',()=>{
    const game=new Game();game.newGame('brasito',40732);
    const monster=game.save!.party[0];
    expect(game.equipMonsterItem(monster.uid,'support','starter-tonico')).toBe(true);
    readyBattle(game);
    expect(game.statusBonus(monster.uid,'attack')).toBe(0);
    expect(monster.heldItems.support).toBe('starter-tonico');
    game.update(0.05);
    expect(game.statusBonus(monster.uid,'attack')).toBe(5);
    expect(game.battle!.statuses[0].duration).toBe(12);
    expect(game.battle!.statuses[0].remaining).toBeGreaterThan(11.9);
    expect(monster.heldItems.support).toBeNull();
    expect(game.save!.inventory.some(item=>item.uid==='starter-tonico')).toBe(false);
    expect(game.battle!.ally.itemPoseTime).toBeGreaterThan(0);
    expect(game.effects.find(effect=>effect.kind==='item'&&effect.itemId==='tonico-brasa'))
      .toMatchObject({autoItem:true,itemEffect:'status',stat:'attack',targetUid:monster.uid});
    expect(readSave()!.party[0].heldItems.support).toBeNull();
  });
  it('consome a comida aos 50% de vida e preserva a cura efetiva',()=>{
    const game=new Game();game.newGame('brasito',40732);
    const monster=game.save!.party[0];
    expect(game.equipMonsterItem(monster.uid,'food','starter-pao')).toBe(true);
    readyBattle(game);
    game.update(0.05);
    expect(monster.heldItems.food).toBe('starter-pao');
    game.battle!.ally.hp=maxHp(monster)/2;
    game.update(0.05);
    expect(game.battle!.ally.hp).toBe(maxHp(monster)/2+12);
    expect(monster.hp).toBe(game.battle!.ally.hp);
    expect(monster.heldItems.food).toBeNull();
    expect(game.effects.find(effect=>effect.kind==='item'&&effect.itemId==='pao'))
      .toMatchObject({autoItem:true,itemEffect:'heal',amount:12,targetUid:monster.uid});
    expect(game.save!.inventory.some(item=>item.uid==='starter-pao')).toBe(false);
  });
  it('separa no tempo a ativação automática do suporte e da comida',()=>{
    const game=new Game();game.newGame('brasito',40732);
    const monster=game.save!.party[0];
    expect(game.equipMonsterItem(monster.uid,'food','starter-pao')).toBe(true);
    expect(game.equipMonsterItem(monster.uid,'support','starter-tonico')).toBe(true);
    monster.hp=10;
    readyBattle(game);
    game.update(0.05);
    expect(game.battle!.statuses).toHaveLength(1);
    expect(monster.heldItems.food).toBe('starter-pao');
    for(let i=0;i<17;i++)game.update(0.05);
    expect(monster.heldItems.food).toBeNull();
    expect(game.battle!.ally.hp).toBe(22);
  });
  it('ativa o item do novo companheiro quando ele entra na arena',()=>{
    const game=new Game();game.newGame('brasito',40732);
    const teammate=createMonster('gotejo',1,'teammate');game.save!.party.push(teammate);
    game.save!.inventory.push({uid:'casca-reserva',itemId:'pocao-casca'});
    expect(game.equipMonsterItem(teammate.uid,'support','casca-reserva')).toBe(true);
    readyBattle(game);game.update(0.05);
    expect(teammate.heldItems.support).toBe('casca-reserva');
    game.battleCommand('follow');
    expect(game.battle!.command).toBe('follow');
    game.switchMonster(1);game.update(0.05);
    expect(game.battle!.command).toBe('return');
    expect(game.statusBonus(teammate.uid,'defense')).toBe(5);
    expect(teammate.heldItems.support).toBeNull();
    expect(game.effects.find(effect=>effect.kind==='item'&&effect.itemId==='pocao-casca'))
      .toMatchObject({autoItem:true,targetUid:teammate.uid,stat:'defense'});
  });
  it('permite um artefato automático que enfraquece o inimigo',()=>{
    const game=new Game();game.newGame('brasito',40732);
    game.save!.inventory.push({uid:'amuleto-auto',itemId:'amuleto-fraco'});
    expect(game.equipMonsterItem('starter','support','amuleto-auto')).toBe(true);
    readyBattle(game);game.update(0.05);
    expect(game.statusBonus(game.battle!.enemy.uid,'attack')).toBe(-5);
    expect(game.effects.find(effect=>effect.kind==='item'&&effect.itemId==='amuleto-fraco'))
      .toMatchObject({autoItem:true,targetUid:game.battle!.enemy.uid,amount:-5});
  });
  it('restaura slots de salvamentos antigos e resolve itens duplicados ou do tipo errado',()=>{
    const game=new Game();game.newGame('brasito',40732);
    const legacy=structuredClone(game.save!);
    delete (legacy.party[0] as Partial<typeof legacy.party[number]>).heldItems;
    store.set('cartas-e-monstros-save-v1',JSON.stringify(legacy));
    expect(readSave()!.party[0].heldItems).toEqual({food:null,support:null});
    legacy.party[0].heldItems={food:'starter-pao',support:'starter-bolo'};
    store.set('cartas-e-monstros-save-v1',JSON.stringify(legacy));
    const restored=readSave()!;
    expect(restored.party[0].heldItems).toEqual({food:'starter-pao',support:null});
    expect(restored.battleBag[0]).toBeNull();
    expect(restored.battleBag[1]).toBe('starter-bolo');
  });
  it('cura na exploração e libera o espaço da mochila sem gastar comida com vida cheia',()=>{
    const game=new Game();game.newGame('brasito',40732);
    expect(game.useHealingItemOutsideBattle('starter-pao')).toBe(false);
    expect(game.save!.battleBag[0]).toBe('starter-pao');
    game.save!.party[0].hp=10;
    expect(game.useHealingItemOutsideBattle('starter-pao')).toBe(true);
    expect(game.save!.party[0].hp).toBe(22);
    expect(game.save!.battleBag[0]).toBeNull();
    expect(game.save!.inventory.some(item=>item.uid==='starter-pao')).toBe(false);
    expect(game.effects.some(effect=>effect.kind==='item'&&effect.itemId==='pao')).toBe(true);
    expect(readSave()!.party[0].hp).toBe(22);
  });
  it('permite curar outro companheiro com item fora da mochila',()=>{
    const game=new Game();game.newGame('brasito',40732);
    const teammate=createMonster('gotejo',1,'teammate');teammate.hp=5;
    game.save!.party.push(teammate);
    game.save!.inventory.push({uid:'pao-reserva',itemId:'pao'});
    expect(game.useHealingItemOutsideBattle('pao-reserva',teammate.uid)).toBe(true);
    expect(teammate.hp).toBe(17);
    expect(game.save!.party[0].hp).toBe(maxHp(game.save!.party[0]));
    expect(game.save!.battleBag).toEqual(['starter-pao','starter-bolo','starter-tonico',null,null,null]);
    expect(game.useHealingItemOutsideBattle('starter-tonico',teammate.uid)).toBe(false);
  });
  it('mantém inventário sem limite e seis espaços individuais na mochila',()=>{
    const inventory:InventoryItem[]=[];
    for(let i=0;i<BAG_CAPACITY+7;i++)expect(addItem(inventory,{uid:String(i),itemId:'pao'})).toBe(true);
    expect(inventory).toHaveLength(BAG_CAPACITY+7);
    const game=new Game();game.newGame('brasito',40732);
    game.save!.inventory=[...inventory];game.save!.battleBag=Array.from({length:BAG_CAPACITY},(_,slot)=>String(slot));game.walkingNpcs=[];
    const spawn=game.world!.items.find(item=>game.world!.places.every(place=>Math.hypot(place.x-item.x,place.z-item.z)>4))!;
    game.player.x=spawn.x+0.5;game.player.z=spawn.z+0.5;
    expect(game.nearbyInteraction()?.kind).toBe('item');
    game.interact();
    expect(game.save!.collectedItems).toContain(spawn.id);
    expect(readSave()!.inventory).toHaveLength(BAG_CAPACITY+8);
    expect(readSave()!.battleBag).toEqual(game.save!.battleBag);
    expect(game.save!.battleBag).toHaveLength(BAG_CAPACITY);
    const replacement=game.world!.items.find(item=>item.id==='item-respawn-0')!;
    expect(game.world!.items).toHaveLength(GROUND_ITEM_LIMIT);
    expect(game.world!.items.some(item=>item.id===spawn.id)).toBe(false);
    expect(Math.hypot(replacement.x-spawn.x,replacement.z-spawn.z)).toBeGreaterThanOrEqual(GROUND_ITEM_RESPAWN_DISTANCE);
    expect(game.world!.items.filter(item=>item!==replacement).every(item=>
      Math.hypot(item.x-replacement.x,item.z-replacement.z)>=GROUND_ITEM_SPACING)).toBe(true);
    const restored=new Game();expect(restored.continueGame()).toBe(true);
    expect(restored.world!.items).toEqual(game.world!.items);
  });
  it('mantém o limite e a distância entre itens após várias coletas',()=>{
    const game=new Game();game.newGame('brasito',82557);game.walkingNpcs=[];
    for(let serial=0;serial<10;serial++){
      game.save!.inventory=[];
      const collected=game.world!.items[serial%GROUND_ITEM_LIMIT];
      game.player.x=collected.x+0.5;game.player.z=collected.z+0.5;
      game.interact();
      expect(game.save!.collectedItems).toContain(collected.id);
      expect(game.world!.items).toHaveLength(GROUND_ITEM_LIMIT);
      expect(game.world!.items.some(item=>item.id===collected.id)).toBe(false);
      const replacement=game.world!.items.find(item=>item.id==='item-respawn-'+serial)!;
      expect(replacement).toBeDefined();
      expect(Math.hypot(replacement.x-collected.x,replacement.z-collected.z)).toBeGreaterThanOrEqual(GROUND_ITEM_RESPAWN_DISTANCE);
      for(const item of game.world!.items){
        if(item===replacement)continue;
        expect(Math.hypot(replacement.x-item.x,replacement.z-item.z)).toBeGreaterThanOrEqual(GROUND_ITEM_SPACING);
      }
    }
  });
  it('cura, consome o item e preserva a vida após a batalha',()=>{
    const game=new Game();game.newGame('brasito',40732);
    game.save!.party[0].hp=10;
    readyBattle(game);
    game.openBattleMenu('items');
    expect(game.useBattleItem('starter-pao')).toBe(true);
    expect(game.battle!.ally.hp).toBe(22);
    expect(game.save!.inventory.some(item=>item.uid==='starter-pao')).toBe(false);
    expect(game.effects.some(effect=>effect.kind==='item'&&effect.itemId==='pao')).toBe(true);
    expect(game.effects.find(effect=>effect.kind==='item'&&effect.itemId==='pao'))
      .toMatchObject({itemEffect:'heal',amount:12,targetUid:game.activeMonster!.uid});
    game.flee();
    expect(game.save!.party[0].hp).toBe(22);
    expect(readSave()!.party[0].hp).toBe(22);
  });
  it('mostra apenas a cura efetiva perto do máximo de vida',()=>{
    const game=new Game();game.newGame('brasito',40732);
    game.save!.party[0].hp=maxHp(game.save!.party[0])-4;
    readyBattle(game);game.openBattleMenu('items');
    expect(game.useBattleItem('starter-pao')).toBe(true);
    expect(game.effects.find(effect=>effect.kind==='item'&&effect.itemId==='pao'))
      .toMatchObject({itemEffect:'heal',amount:4});
  });
  it('mantém ataque e defesa ativos ao mesmo tempo por 12 segundos',()=>{
    const game=new Game();game.newGame('brasito',40732);
    game.save!.inventory.push({uid:'casca-extra',itemId:'pocao-casca'});
    expect(game.equipBattleItem('casca-extra')).toBe(true);
    readyBattle(game);
    game.openBattleMenu('items');expect(game.useBattleItem('starter-tonico')).toBe(true);
    game.openBattleMenu('items');expect(game.useBattleItem('casca-extra')).toBe(true);
    const uid=game.activeMonster!.uid;
    expect(game.battle!.statuses).toHaveLength(2);
    expect(game.statusBonus(uid,'attack')).toBe(5);
    expect(game.statusBonus(uid,'defense')).toBe(5);
    expect(game.battle!.statuses.every(status=>status.remaining===12)).toBe(true);
    expect(game.effects.filter(effect=>effect.kind==='item'&&effect.itemEffect==='status'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({amount:5,stat:'attack',targetUid:uid}),
        expect.objectContaining({amount:5,stat:'defense',targetUid:uid})
      ]));
  });
  it('aplica bônus e penalidades temporários ao alvo certo e pausa sua duração no menu',()=>{
    const game=new Game();game.newGame('brasito',40732);
    game.save!.inventory.push({uid:'test-weak',itemId:'amuleto-fraco'});
    expect(game.equipBattleItem('test-weak')).toBe(true);
    readyBattle(game);
    game.openBattleMenu('items');expect(game.useBattleItem('starter-tonico')).toBe(true);
    const allyUid=game.activeMonster!.uid;
    expect(game.statusBonus(allyUid,'attack')).toBe(5);
    expect(game.statusBonus(game.battle!.enemy.uid,'attack')).toBe(0);
    game.openBattleMenu('items');expect(game.useBattleItem('test-weak')).toBe(true);
    expect(game.statusBonus(game.battle!.enemy.uid,'attack')).toBe(-5);
    game.openBattleMenu('cards');
    for(let i=0;i<400;i++)game.update(0.05);
    expect(game.battle!.statuses[0].remaining).toBe(12);
    game.closeBattleMenu();
    for(let i=0;i<305;i++)game.update(0.05);
    expect(game.statusBonus(allyUid,'attack')).toBe(0);
    expect(game.statusBonus(game.battle!.enemy.uid,'attack')).toBe(0);
  });
  it('não desperdiça comida com vida cheia e migra um salvamento antigo',()=>{
    const game=new Game();game.newGame('brasito',40732);readyBattle(game);
    expect(game.battle!.ally.hp).toBe(maxHp(game.activeMonster!));
    game.openBattleMenu('items');expect(game.useBattleItem('starter-pao')).toBe(false);
    expect(game.save!.inventory.some(item=>item.uid==='starter-pao')).toBe(true);
    const legacy={...game.save};delete (legacy as Partial<typeof legacy>).inventory;delete (legacy as Partial<typeof legacy>).collectedItems;
    store.set('cartas-e-monstros-save-v1',JSON.stringify(legacy));
    expect(readSave()!.inventory).toEqual([]);
    expect(readSave()!.collectedItems).toEqual([]);
    const restored=new Game();expect(restored.continueGame()).toBe(true);
    expect(restored.world!.items).toHaveLength(GROUND_ITEM_LIMIT);
    expect(readSave()!.groundItems).toEqual(restored.world!.items);
  });
  it('separa três pães iguais, usa apenas o preparado e restaura as escolhas',()=>{
    const game=new Game();game.newGame('brasito',40732);
    for(const uid of ['pao-2','pao-3','pao-reserva'])game.save!.inventory.push({uid,itemId:'pao'});
    expect(game.equipBattleItem('pao-2',3)).toBe(true);
    expect(game.equipBattleItem('pao-3',4)).toBe(true);
    expect(game.equipBattleItem('pao-reserva',5)).toBe(true);
    expect(game.save!.battleBag).toHaveLength(6);
    expect(new Set(game.save!.battleBag.filter(Boolean)).size).toBe(6);
    game.unequipBattleItem(5);
    game.save!.party[0].hp=5;
    readyBattle(game);
    game.openBattleMenu('items');
    expect(game.useBattleItem('pao-reserva')).toBe(false);
    game.selectBattleBagSlot(3);
    expect(game.useSelectedBattleItem()).toBe(true);
    expect(game.save!.battleBag[3]).toBeNull();
    expect(game.save!.inventory.some(item=>item.uid==='pao-3')).toBe(true);
    expect(game.save!.inventory.some(item=>item.uid==='pao-reserva')).toBe(true);
    expect(readSave()!.battleBag).toEqual(game.save!.battleBag);
  });
  it('migra todos os itens antigos sem cortar no antigo limite',()=>{
    const game=new Game();game.newGame('brasito',40732);
    game.save!.inventory=Array.from({length:15},(_,i)=>({uid:`antigo-${i}`,itemId:'pao' as const}));
    const legacy={...game.save};delete (legacy as Partial<typeof legacy>).battleBag;
    store.set('cartas-e-monstros-save-v1',JSON.stringify(legacy));
    expect(readSave()!.inventory).toHaveLength(15);
    expect(readSave()!.battleBag).toEqual(Array.from({length:6},(_,i)=>`antigo-${i}`));
  });
});
