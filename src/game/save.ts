import type { Element, Monster } from './content';
import { BAG_CAPACITY, ITEMS, type InventoryItem } from './items';
import { GROUND_ITEM_LIMIT, WORLD_SIZE, type ItemSpawn } from './world';

const SAVE_KEY = 'cartas-e-monstros-save-v1';
const DATABASE_NAME='cartas-e-monstros-world-v2';
let databasePromise:Promise<IDBDatabase>|null=null;
let writeChain:Promise<void>=Promise.resolve();
let saveErrorHandler:((message:string)=>void)|null=null;

export function setSaveErrorHandler(handler:((message:string)=>void)|null):void{saveErrorHandler=handler;}
function openDatabase():Promise<IDBDatabase>{
  if(databasePromise)return databasePromise;
  databasePromise=new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB indisponível'));return;}
    const request=indexedDB.open(DATABASE_NAME,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('saves'))request.result.createObjectStore('saves');};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error('Falha ao abrir armazenamento'));
  });
  return databasePromise;
}
async function readDatabase():Promise<unknown>{
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const request=db.transaction('saves','readonly').objectStore('saves').get('current');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function writeDatabase(save:SaveData):Promise<void>{
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction('saves','readwrite');
    transaction.objectStore('saves').put(save,'current');
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error);
  });
}

export interface SaveData {
  version: 2;
  seed: number;
  player: { x: number; z: number };
  elapsed: number;
  party: Monster[];
  collection: Monster[];
  cards: Record<Element, number>;
  coins: number;
  nextShopSerial?: number;
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
  discoveredChunks: Record<string,string>;
  chunkChanges: Record<string,{removedItems:string[];openedCaches:string[];removedProps:string[]}>;
  completed: boolean;
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}
export async function hasSaveAsync():Promise<boolean>{
  try{if(await readDatabase())return true;}catch{/* local fallback */}
  return hasSave();
}

function normalizeSave(input:unknown):SaveData|null{
  try {
    const value=input as SaveData;
    if(!value||typeof value!=='object')return null;
    if (![1,2].includes(value.version as number) || !Number.isInteger(value.seed) || !Array.isArray(value.party)) return null;
    value.version=2;
    value.discoveredChunks=typeof value.discoveredChunks==='object'&&value.discoveredChunks?value.discoveredChunks:{};
    value.chunkChanges=typeof value.chunkChanges==='object'&&value.chunkChanges?value.chunkChanges:{};
    // Existing journeys predate the backpack. Keep them playable.
    value.collectedItems=Array.isArray(value.collectedItems)?value.collectedItems:[];
    value.groundItems=Array.isArray(value.groundItems)?value.groundItems.filter((item):item is ItemSpawn=>
      !!item&&typeof item.id==='string'&&item.itemId in ITEMS&&Number.isInteger(item.x)&&
      Number.isInteger(item.z)&&item.x>=0&&item.z>=0&&item.x<WORLD_SIZE&&item.z<WORLD_SIZE)
      .slice(0,GROUND_ITEM_LIMIT):undefined;
    value.nextItemSerial=typeof value.nextItemSerial==='number'&&Number.isSafeInteger(value.nextItemSerial)&&
      value.nextItemSerial>=0?value.nextItemSerial:0;
    value.coins=Number.isSafeInteger(value.coins)&&value.coins>=0?value.coins:120;
    value.nextShopSerial=Number.isSafeInteger(value.nextShopSerial)&&(value.nextShopSerial??-1)>=0?value.nextShopSerial:0;
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
export function readSave():SaveData|null{
  try{const raw=localStorage.getItem(SAVE_KEY);return raw?normalizeSave(JSON.parse(raw)):null;}
  catch{return null;}
}
export async function readSaveAsync():Promise<SaveData|null>{
  try{const value=normalizeSave(await readDatabase());if(value)return value;}
  catch{/* local fallback */}
  return readSave();
}

export function writeSave(save: SaveData): boolean {
  let local=false;
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));local=true;}
  catch{
    try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:2,seed:save.seed,external:true}));}
    catch{/* IndexedDB remains the primary store. */}
  }
  if(typeof indexedDB!=='undefined'){
    const snapshot=JSON.parse(JSON.stringify(save)) as SaveData;
    writeChain=writeChain.then(()=>writeDatabase(snapshot)).catch(error=>{
      saveErrorHandler?.(local?'O armazenamento principal falhou; a cópia local pode ter limite de espaço.':
        `Não foi possível salvar o mundo: ${String(error)}`);
    });
  }
  return local||typeof indexedDB!=='undefined';
}
