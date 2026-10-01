import { useEffect, useRef, useState } from 'react';
import { maxHp, SPECIES } from '../game/content';
import { Game } from '../game/game';
import { ITEMS, itemArt, type ItemId } from '../game/items';
import { monsterPortrait } from '../render/art';
import './inventoryHealDialog.css';

interface HealResult {
  targetUid:string;
  name:string;
  previousHp:number;
  amount:number;
}

export function InventoryHealDialog({game,itemUid,itemId,onClose,onConsumed}:{
  game:Game;itemUid:string;itemId:ItemId;onClose:()=>void;onConsumed:()=>void;
}) {
  const dialog=useRef<HTMLElement>(null);
  const [result,setResult]=useState<HealResult|null>(null);
  const [revealed,setRevealed]=useState(false);
  const item=ITEMS[itemId];
  const party=game.save?.party??[];
  const healingAmount=item.effect.kind==='heal'?item.effect.amount:0;

  useEffect(()=>{dialog.current?.querySelector<HTMLButtonElement>('.heal-choice:not(:disabled)')?.focus();},[]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      event.preventDefault();event.stopImmediatePropagation();
      if(!result)onClose();
    };
    window.addEventListener('keydown',onKey,true);
    return()=>window.removeEventListener('keydown',onKey,true);
  },[result,onClose]);
  useEffect(()=>{
    if(!result)return;
    const reveal=window.setTimeout(()=>setRevealed(true),120);
    const finish=window.setTimeout(onClose,2150);
    return()=>{window.clearTimeout(reveal);window.clearTimeout(finish);};
  },[result,onClose]);

  const useOn=(targetUid:string)=>{
    if(result)return;
    const monster=party.find(entry=>entry.uid===targetUid);
    if(!monster||monster.hp<=0||monster.hp>=maxHp(monster))return;
    const previousHp=monster.hp;
    if(!game.useHealingItemOutsideBattle(itemUid,targetUid))return;
    setResult({targetUid,name:SPECIES[monster.species].name,previousHp,amount:monster.hp-previousHp});
    onConsumed();
  };

  return <div className="heal-picker-backdrop" onMouseDown={event=>{
    if(!result&&event.target===event.currentTarget)onClose();
  }}>
    <section ref={dialog} className="modal-panel heal-picker" role="dialog" aria-modal="true" aria-labelledby="heal-picker-title">
      {!result?<button type="button" className="close-button" onClick={onClose} aria-label="Fechar seleção de cura">✕</button>:null}
      <div className="eyebrow">CUIDAR DOS COMPANHEIROS</div>
      <header className="heal-picker-heading">
        <img src={itemArt(itemId)} alt=""/>
        <div><h2 id="heal-picker-title">{result?'Vida recuperada':'Quem vai receber a cura?'}</h2>
          <p>{item.name} · até +{healingAmount} PV</p></div>
      </header>
      <div className="heal-picker-choices">{party.map(monster=>{
        const maximum=maxHp(monster);
        const selected=result?.targetUid===monster.uid;
        const shownHp=selected&&!revealed?result.previousHp:monster.hp;
        const eligible=monster.hp>0&&monster.hp<maximum;
        return <button key={monster.uid} type="button"
          className={`heal-choice ${selected?'healing':''} ${selected&&revealed?'revealed':''}`}
          onClick={()=>useOn(monster.uid)} disabled={!!result||!eligible}
          aria-label={`${SPECIES[monster.species].name}, ${monster.hp} de ${maximum} PV${eligible?', curar':' · indisponível'}`}>
          <span className="heal-choice-portrait"><img src={monsterPortrait(monster.species)} alt=""/></span>
          <strong>{SPECIES[monster.species].name}</strong><small>Nv. {monster.level}</small>
          <span className="heal-choice-health-label"><span>VIDA</span><b>{shownHp}/{maximum} PV</b></span>
          <span className="heal-choice-health"><i style={{width:`${Math.max(0,Math.min(100,shownHp/maximum*100))}%`}}/></span>
          <em>{selected?'Cura aplicada':monster.hp<=0?'Sem vida':eligible?'Escolher criatura':'Vida cheia'}</em>
          {selected&&revealed?<><img className="heal-choice-item-effect" src={itemArt(itemId)} alt=""/>
            <span className="heal-choice-gain">+{result.amount} PV</span></>:null}
        </button>;
      })}</div>
      <p className="heal-picker-foot" role="status" aria-live="polite">
        {result?(revealed?`${result.name} recuperou ${result.amount} PV!`:`${result.name} está recebendo a cura…`):
          'Selecione uma criatura ferida. A comida será consumida após a escolha.'}
      </p>
    </section>
  </div>;
}
