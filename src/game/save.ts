import type { Element, Monster } from './content';
import { BAG_CAPACITY, ITEMS, type InventoryItem } from './items';
import { GROUND_ITEM_LIMIT, WORLD_SIZE, type ItemSpawn } from './world';

const SAVE_KEY = 'cartas-e-monstros-save-v1';

export interface SaveData {
  version: 1;
  seed: number;
  player: { x: number; z: number };
  elapsed: number;
  party: Monster[];
  collection: Monster[];
  cards: Record<Element, number>;
  seals: Element[];
  openedCaches: string[];
  collectedItems: string[];
  groundItems?: ItemSpawn[];
  nextItemSerial?: number;
  inventory: InventoryItem[];
  battleBag: (string|null)[];
  wildCooldown: Record<string, number>;
  wins: number;
  claimedWins: Record<Element, number>;
  discovered: number[];
  completed: boolean;
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as SaveData;
    if (value.version !== 1 || !Number.isInteger(value.seed) || !Array.isArray(value.party)) return null;
    // Existing journeys predate the backpack. Keep them playable.
    value.collectedItems=Array.isArray(value.collectedItems)?value.collectedItems:[];
    value.groundItems=Array.isArray(value.groundItems)?value.groundItems.filter((item):item is ItemSpawn=>
      !!item&&typeof item.id==='string'&&item.itemId in ITEMS&&Number.isInteger(item.x)&&
      Number.isInteger(item.z)&&item.x>=0&&item.z>=0&&item.x<WORLD_SIZE&&item.z<WORLD_SIZE)
      .slice(0,GROUND_ITEM_LIMIT):undefined;
    value.nextItemSerial=typeof value.nextItemSerial==='number'&&Number.isSafeInteger(value.nextItemSerial)&&
      value.nextItemSerial>=0?value.nextItemSerial:0;
    value.inventory=(Array.isArray(value.inventory)?value.inventory:[])
      .filter((entry):entry is InventoryItem=>!!entry&&typeof entry.uid==='string'&&entry.itemId in ITEMS);
    const owned=new Map(value.inventory.map(item=>[item.uid,item]));
    const equipped=new Set<string>();
    value.collection=Array.isArray(value.collection)?value.collection:[];
    for(const monster of [...value.party,...value.collection]){
      const previous=monster.heldItems;
      const held={food:null as string|null,support:null as string|null};
      for(const slot of ['food','support'] as const){
        const uid=previous?.[slot];
        if(typeof uid!=='string'||equipped.has(uid))continue;
        const entry=owned.get(uid);
        if(!entry||ITEMS[entry.itemId].effect.kind!==(slot==='food'?'heal':'status'))continue;
        held[slot]=uid;equipped.add(uid);
      }
      monster.heldItems=held;
    }
    const oldBag=Array.isArray(value.battleBag)?value.battleBag:value.inventory.slice(0,BAG_CAPACITY).map(item=>item.uid);
    value.battleBag=Array.from({length:BAG_CAPACITY},(_,slot)=>{
      const uid=oldBag[slot];
      if(typeof uid!=='string'||!owned.has(uid)||equipped.has(uid))return null;
      equipped.add(uid);return uid;
    });
    return value;
  } catch { return null; }
}

export function writeSave(save: SaveData): boolean {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); return true; }
  catch { return false; }
}
