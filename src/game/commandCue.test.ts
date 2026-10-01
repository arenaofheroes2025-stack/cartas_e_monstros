import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from './game';

const store=new Map<string,string>();
beforeEach(()=>{store.clear();vi.stubGlobal('localStorage',{
  getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value)
});});

function battle():Game {
  const game=new Game();game.newGame('brasito',40732);
  game.beginBattle(game.wildActors.find(wild=>!wild.night)!);
  game.battle!.intro=0;
  game.battle!.ally.attackTimer=999;
  game.battle!.foe.attackTimer=999;
  return game;
}

describe('ordens visíveis do herói',()=>{
  it('troca o grito e a pose para cada comando aceito, inclusive o ponto do mapa',()=>{
    const game=battle();
    for(const [command,label,color] of [
      ['attack','Atacar!','#ef665e'],['follow','Perseguir!','#f4d36a'],['return','Volte!','#a4db8d']
    ] as const){
      game.battleCommand(command);
      expect(game.battle!.cue).toMatchObject({label,color,poseRemaining:1.25});
    }
    const previous=game.battle!.cue!.sequence;
    game.battleCommand('dodge');
    expect(game.battle!.cue).toMatchObject({label:'Esquivar!',color:'#68c6ee'});
    expect(game.battle!.cue!.sequence).toBeGreaterThan(previous);
    const waypoint={x:game.battle!.center.x+1,z:game.battle!.center.z};
    game.orderMove(waypoint);
    expect(game.battle!.cue?.label).toBe('Ir até lá!');
  });

  it('mantém o balão e a pose congelados no menu e os encerra após a duração',()=>{
    const game=battle();game.battleCommand('attack');
    game.update(0.05);
    const remaining=game.battle!.cue!.remaining;
    game.openBattleMenu('cards');
    for(let step=0;step<20;step++)game.update(0.05);
    expect(game.battle!.cue!.remaining).toBe(remaining);
    game.closeBattleMenu();
    for(let step=0;step<33;step++)game.update(0.05);
    expect(game.battle!.cue).toBeNull();
  });

  it('usa o ícone e a cor do item no comando de arremesso',()=>{
    const game=battle();game.battle!.ally.hp=10;
    game.openBattleMenu('items');
    expect(game.useBattleItem('starter-pao')).toBe(true);
    expect(game.battle!.cue).toMatchObject({label:'Pão de viagem!',itemId:'pao',color:'#eeb975'});
    expect(game.battle!.itemUseTime).toBeGreaterThan(0);
  });
});
