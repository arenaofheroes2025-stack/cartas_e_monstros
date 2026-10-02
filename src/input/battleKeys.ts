import type { BattleCommand } from '../game/game';

export type BattleKeyAction = BattleCommand | 'cards' | null;

export function battleKeyAction(key:string,pursuing:boolean):BattleKeyAction {
  switch(key){
    case 'z':return 'attack';
    case 'x':return 'dodge';
    case 'c':return 'special';
    case 'a':return pursuing?'return':'follow';
    case 's':return 'cards';
    default:return null;
  }
}
