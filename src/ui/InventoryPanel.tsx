import { useCallback, useState } from 'react';
import { Game } from '../game/game';
import { maxHp } from '../game/content';
import { BAG_CAPACITY, ITEMS, itemArt, type ItemId } from '../game/items';
import { InventoryHealDialog } from './InventoryHealDialog';
import './inventory.css';
import './inventoryLoadout.css';

export function InventoryPanel({game,onClose}:{game:Game;onClose:()=>void}) {
  const [selected,setSelected]=useState<string|null>(()=>game.save?.battleBag.find((uid):uid is string=>!!uid)??game.save?.inventory[0]?.uid??null);
  const [pending,setPending]=useState<string|null>(null);
  const [healingItem,setHealingItem]=useState<{uid:string;itemId:ItemId}|null>(null);
  const inventory=game.save?.inventory??[];
  const bag=game.save?.battleBag??Array<string|null>(BAG_CAPACITY).fill(null);
  const assigned=new Set([...(game.save?.party??[]),...(game.save?.collection??[])]
    .flatMap(monster=>[monster.heldItems.food,monster.heldItems.support].filter((uid):uid is string=>!!uid)));
  const stored=inventory.filter(entry=>!bag.includes(entry.uid)&&!assigned.has(entry.uid));
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
  return <div className="overlay inventory-overlay" role="presentation" onMouseDown={event=>{if(!healingItem&&event.target===event.currentTarget)onClose();}}>
    <section className="modal-panel inventory-panel" role="dialog" aria-modal={!healingItem} aria-label="Inventário e mochila" inert={!!healingItem}>
      <button className="close-button" onClick={onClose} aria-label="Fechar inventário">✕</button>
      <div className="eyebrow">EQUIPAMENTO DO HERÓI</div>
      <header className="inventory-heading"><div><h2>Inventário & mochila</h2><p>Guarde tudo o que encontrar. Escolha até seis itens para levar à batalha.</p></div>
        <img className="inventory-bag-icon" src="/art/ui/hero-satchel.png" alt=""/></header>

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

      <div className="inventory-stock"><div className="inventory-section-title"><h3>Inventário</h3><span>{stored.length} guardados · {assigned.size} com criaturas · sem limite</span></div>
      <div className="inventory-layout">
        <div className="inventory-grid" aria-label="Itens fora da mochila">{stored.map((entry,index)=>{
          const info=ITEMS[entry.itemId];
          return <button key={entry.uid} type="button" className={`inventory-slot occupied ${active?.uid===entry.uid?'selected':''}`}
            style={{'--item-accent':info.color} as React.CSSProperties}
            aria-label={`${info.name}, item ${index+1}`}
            onClick={()=>{setSelected(entry.uid);setPending(entry.uid);}}>
            <span className="slot-number">{String(index+1).padStart(2,'0')}</span>
            <img src={itemArt(entry.itemId)} alt=""/>
          </button>;
        })}{stored.length===0?<p className="inventory-none">{inventory.length?'Os itens estão na mochila ou equipados nas criaturas.':'Explore o mapa para encontrar itens.'}</p>:null}</div>
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
      <div className="inventory-footer"><span>ITENS IGUAIS OCUPAM ESPAÇOS SEPARADOS</span><button onClick={onClose}>Voltar ao jogo</button></div>
    </section>
    {healingItem?<InventoryHealDialog game={game} itemUid={healingItem.uid} itemId={healingItem.itemId}
      onClose={closeHeal} onConsumed={finishHeal}/>:null}
  </div>;
}
