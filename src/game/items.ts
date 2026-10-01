export const BAG_CAPACITY = 6;

export type ItemId = 'pao' | 'bolo' | 'tonico-brasa' | 'pocao-casca' | 'amuleto-lento' | 'amuleto-fraco';
export type BattleStat = 'attack' | 'defense' | 'speed';
export interface InventoryItem { uid: string; itemId: ItemId }
export interface TimedStatus { itemId: ItemId; targetUid: string; stat: BattleStat; amount: number; remaining: number; duration: number }
export type ItemEffect = {kind:'heal'; amount:number; target:'ally'} |
  {kind:'status'; stat:BattleStat; amount:number; duration:number; target:'ally'|'foe'};
export interface ItemDefinition { id:ItemId; name:string; description:string; category:'comida'|'pocao'|'artefato'; color:string; effect:ItemEffect }

export const ITEMS: Record<ItemId,ItemDefinition> = {
  pao: {id:'pao',name:'Pão de viagem',description:'Recupera 12 PV do monstro ativo.',category:'comida',color:'#eeb975',effect:{kind:'heal',amount:12,target:'ally'}},
  bolo: {id:'bolo',name:'Bolo de frutas',description:'Recupera 25 PV do monstro ativo.',category:'comida',color:'#f3a9bd',effect:{kind:'heal',amount:25,target:'ally'}},
  'tonico-brasa': {id:'tonico-brasa',name:'Tônico de brasa',description:'+5 ATQ por 12 segundos no monstro ativo.',category:'pocao',color:'#fa9b66',effect:{kind:'status',stat:'attack',amount:5,duration:12,target:'ally'}},
  'pocao-casca': {id:'pocao-casca',name:'Poção de casca',description:'+5 DEF por 12 segundos no monstro ativo.',category:'pocao',color:'#a9d490',effect:{kind:'status',stat:'defense',amount:5,duration:12,target:'ally'}},
  'amuleto-lento': {id:'amuleto-lento',name:'Amuleto da lentidão',description:'Reduz a VEL do inimigo em 5 por 12 segundos.',category:'artefato',color:'#c7a9e8',effect:{kind:'status',stat:'speed',amount:-5,duration:12,target:'foe'}},
  'amuleto-fraco': {id:'amuleto-fraco',name:'Amuleto da fraqueza',description:'Reduz o ATQ do inimigo em 5 por 12 segundos.',category:'artefato',color:'#9eb8ef',effect:{kind:'status',stat:'attack',amount:-5,duration:12,target:'foe'}},
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export function itemArt(id:ItemId):string {return `/art/items/${id}.png`;}
export function statusBonus(statuses:TimedStatus[],uid:string,stat:BattleStat):number {
  return statuses.reduce((sum,status)=>sum+(status.targetUid===uid&&status.stat===stat&&status.remaining>0?status.amount:0),0);
}
export function addItem(bag:InventoryItem[],item:InventoryItem):boolean {
  bag.push(item);return true;
}
