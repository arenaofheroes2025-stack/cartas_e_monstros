import { useCallback, useState } from 'react';
import { Game } from '../game/game';
import { maxHp, SPECIES } from '../game/content';
import { BAG_CAPACITY, ITEMS, itemArt, type ItemId } from '../game/items';
import { monsterPortrait } from '../render/art';
import { InventoryHealDialog } from './InventoryHealDialog';
import './inventory.css';
import './inventoryLoadout.css';

type ItemCategory = 'todos'|'comida'|'pocao'|'artefato';
const CATEGORIES: {id:ItemCategory;label:string;icon:ItemId}[] = [
  {id:'todos',label:'Todos',icon:'pao'},
  {id:'comida',label:'Comida',icon:'bolo'},
  {id:'pocao',label:'Poções',icon:'tonico-brasa'},
  {id:'artefato',label:'Artefatos',icon:'amuleto-lento'}
];

export function InventoryPanel({game,covered=false,onClose,onCompanion}:{game:Game;covered?:boolean;onClose:()=>void;onCompanion:(uid:string)=>void}) {
  const [selected,setSelected]=useState<string|null>(()=>game.save?.battleBag.find((uid):uid is string=>!!uid)??game.save?.inventory[0]?.uid??null);
  const [category,setCategory]=useState<ItemCategory>('todos');
  const [pending,setPending]=useState<string|null>(null);
  const [healingItem,setHealingItem]=useState<{uid:string;itemId:ItemId}|null>(null);
  const inventory=game.save?.inventory??[];
  const bag=game.save?.battleBag??Array<string|null>(BAG_CAPACITY).fill(null);
  const assigned=new Set([...(game.save?.party??[]),...(game.save?.collection??[])]
    .flatMap(monster=>[monster.heldItems.food,monster.heldItems.support].filter((uid):uid is string=>!!uid)));
  const stored=inventory.filter(entry=>!bag.includes(entry.uid)&&!assigned.has(entry.uid));
  const visible=stored.filter(entry=>category==='todos'||ITEMS[entry.itemId].category===category);
  const groups=Array.from(new Set(visible.map(entry=>entry.itemId))).map(itemId=>({itemId,entries:visible.filter(entry=>entry.itemId===itemId)}));
  const hasWounded=game.save?.party.some(monster=>monster.hp>0&&monster.hp<maxHp(monster))??false;
  const active=inventory.find(entry=>entry.uid===selected);
  const definition=active?ITEMS[active.itemId]:null;
  const equippedSlot=active?bag.indexOf(active.uid):-1;
  const carried=bag.filter(Boolean).length;
  const chooseSlot=(slot:number)=>{
    const uid=bag[slot];
    if(pending&&pending!==uid){
      if(game.equipBattleItem(pending,slot))setPending(null);
      return;
    }
    if(uid){setSelected(uid);setPending(null);}
  };
  const equipFirst=()=>{
    if(!active)return;
    if(game.equipBattleItem(active.uid))setPending(null);
    else game.notify('Os seis espaços estão ocupados. Escolha um espaço para trocar.');
  };
  const closeHeal=useCallback(()=>setHealingItem(null),[]);
  const finishHeal=useCallback(()=>{setSelected(null);setPending(null);},[]);
  return <div className="overlay inventory-overlay" role="presentation" inert={covered} aria-hidden={covered}
    onMouseDown={event=>{if(!healingItem&&event.target===event.currentTarget)onClose();}}>
    <section className="modal-panel inventory-panel" role="dialog" aria-modal={!healingItem&&!covered} aria-label="Inventário e mochila" inert={!!healingItem}>
      <button className="close-button" onClick={onClose} aria-label="Fechar inventário">✕</button>
      <div className="eyebrow">EQUIPAMENTO DO HERÓI</div>
      <header className="inventory-heading"><div><h2>Mochila</h2><p>Organize seis itens para a batalha. Os demais ficam guardados.</p></div>
        <img className="inventory-bag-icon" src="/art/ui/hero-satchel.png" alt=""/></header>

      <div className="inventory-workspace">
      <aside className="inventory-party" aria-label="Equipe de criaturas"><div className="inventory-party-heading"><h3>Equipe</h3><small>{game.save?.party.length??0}/3</small></div>
        <div className="inventory-party-list">{game.save?.party.map(monster=>{
          const maximum=maxHp(monster),health=Math.max(0,Math.min(100,monster.hp/maximum*100));
          return <button key={monster.uid} type="button" className="inventory-party-card" onClick={()=>onCompanion(monster.uid)} aria-label={`Ver ficha de ${SPECIES[monster.species].name}, ${monster.hp} de ${maximum} PV`}>
            <img src={monsterPortrait(monster.species)} alt=""/><span><strong>{SPECIES[monster.species].name}</strong><span className="inventory-party-health"><i style={{width:`${health}%`}}/></span><small>{monster.hp}/{maximum} PV <b>Nv. {monster.level}</b></small></span>
          </button>;
        })}</div>
      </aside>
      <div className="inventory-main">
      <div className="inventory-loadout"><div className="inventory-section-title"><h3>Mochila de batalha</h3><span>{carried}/{BAG_CAPACITY} espaços</span></div>
      <div className="loadout-grid" aria-label="Seis espaços da mochila">{Array.from({length:BAG_CAPACITY},(_,slot)=>{
        const uid=bag[slot],entry=inventory.find(item=>item.uid===uid),info=entry?ITEMS[entry.itemId]:null;
        return <button key={slot} type="button" className={`loadout-slot ${uid&&selected===uid?'selected':''} ${pending?'accepting':''}`}
          style={info?{'--item-accent':info.color} as React.CSSProperties:undefined}
          onClick={()=>chooseSlot(slot)} aria-label={info?`Espaço ${slot+1}: ${info.name}`:`Espaço ${slot+1}: vazio`}>
          <small>{slot+1}</small>{entry?<img src={itemArt(entry.itemId)} alt=""/>:<span className="loadout-empty">+</span>}
          <strong>{info?.name??'Vazio'}</strong>
        </button>;
      })}</div>
      <p className="loadout-help">{pending?'Toque em um espaço para colocar ou trocar.':'Cada unidade ocupa um espaço.'}</p></div>

      <div className="inventory-stock"><div className="inventory-section-title"><h3>Itens guardados</h3><span>{stored.length} guardados · {assigned.size} com criaturas</span></div>
      <div className="inventory-categories" role="group" aria-label="Filtrar itens">{CATEGORIES.map(option=><button key={option.id} type="button" className={category===option.id?'active':''} aria-pressed={category===option.id} onClick={()=>{
        setCategory(option.id);setPending(null);
        if(option.id!=='todos'){
          const matches=(item:{itemId:ItemId})=>ITEMS[item.itemId].category===option.id;
          setSelected((stored.find(matches)??inventory.find(item=>bag.includes(item.uid)&&matches(item)))?.uid??null);
        }
      }}><img src={itemArt(option.icon)} alt=""/><span>{option.label}</span></button>)}</div>
      <div className="inventory-layout">
        <div className="inventory-grid inventory-item-list" aria-label="Itens fora da mochila">{groups.map(({itemId,entries})=>{
          const info=ITEMS[itemId],entry=entries.find(candidate=>candidate.uid===selected)??entries[0];
          return <button key={itemId} type="button" className={`inventory-slot occupied ${active?.uid===entry.uid?'selected':''}`}
            style={{'--item-accent':info.color} as React.CSSProperties}
            aria-label={`${info.name}, ${entries.length} ${entries.length===1?'unidade':'unidades'} guardadas`}
            onClick={()=>{setSelected(entry.uid);setPending(entry.uid);}}>
            <img src={itemArt(entry.itemId)} alt=""/>
            <span className="inventory-row-name"><strong>{info.name}</strong><small>{info.effect.kind==='heal'?`+${info.effect.amount} PV`:`${info.effect.amount>0?'+':''}${info.effect.amount} ${info.effect.stat==='attack'?'ATQ':info.effect.stat==='defense'?'DEF':'VEL'} · ${info.effect.duration}s`}</small></span>
            <b className="inventory-row-count">×{entries.length}</b>
          </button>;
        })}{groups.length===0?<p className="inventory-none">{stored.length?'Nenhum item nesta categoria.':inventory.length?'Os itens estão na mochila ou equipados nas criaturas.':'Explore o mapa para encontrar itens.'}</p>:null}</div>
        <div className="inventory-detail" style={definition?{'--item-accent':definition.color} as React.CSSProperties:undefined}>
          {definition&&active?<><div className="inventory-item-summary"><div className="inventory-art"><img src={itemArt(definition.id)} alt=""/></div>
            <div><small>{definition.category} · {equippedSlot>=0?`mochila ${equippedSlot+1}`:'inventário'}</small>
              <h3>{definition.name}</h3><p>{definition.description}</p></div></div>
            <div className="inventory-actions">
              {definition.effect.kind==='heal'?<button type="button" className="inventory-heal-use" disabled={!hasWounded} onClick={()=>setHealingItem({uid:active.uid,itemId:active.itemId})}>Usar agora <span>→</span></button>:null}
              {equippedSlot>=0?<button className="inventory-use" onClick={()=>{game.unequipBattleItem(equippedSlot);setPending(null);}}>Retirar <span>↙</span></button>
                :<button className="inventory-use" onClick={equipFirst}>Colocar <span>↗</span></button>}
            </div>
          </>:<div className="inventory-empty-detail">Selecione um item para ver o efeito e organizar a mochila.</div>}
        </div>
      </div>
      </div>
      </div>
      </div>
      <div className="inventory-footer"><span>ITENS IGUAIS OCUPAM ESPAÇOS SEPARADOS</span><button onClick={onClose}>Voltar ao jogo</button></div>
    </section>
    {healingItem?<InventoryHealDialog game={game} itemUid={healingItem.uid} itemId={healingItem.itemId}
      onClose={closeHeal} onConsumed={finishHeal}/>:null}
  </div>;
}
