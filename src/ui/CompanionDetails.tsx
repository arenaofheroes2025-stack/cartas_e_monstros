import { useEffect, useRef, useState } from 'react';
import { attack, defense, ELEMENT_COLOR, ELEMENT_ICON, ELEMENT_LABEL, experienceNeeded, luck, maxHp, SPECIES, speed, type HeldItemSlot, type Monster } from '../game/content';
import { Game } from '../game/game';
import { ITEMS, itemArt } from '../game/items';
import { attackRadius } from '../game/battle/rules';
import { monsterPortrait } from '../render/art';
import './companionDetails.css';

export function CompanionDetails({game,monster,onClose,onCollection}:{game:Game;monster:Monster;onClose:()=>void;onCollection:()=>void}) {
  const closeButton=useRef<HTMLButtonElement>(null);
  const picker=useRef<HTMLDivElement>(null);
  const [choosing,setChoosing]=useState<HeldItemSlot|null>(null);
  const species=SPECIES[monster.species];
  const maximum=maxHp(monster),required=experienceNeeded(monster.level);
  const health=Math.max(0,Math.min(100,monster.hp/maximum*100));
  const experience=Math.max(0,Math.min(100,monster.xp/required*100));
  const inventory=game.save?.inventory??[];
  const battleBag=game.save?.battleBag??[];
  const reserved=new Set([...(game.save?.party??[]),...(game.save?.collection??[])]
    .flatMap(entry=>[entry.heldItems.food,entry.heldItems.support].filter((uid):uid is string=>!!uid)));
  const options=choosing?inventory.filter(entry=>
    ITEMS[entry.itemId].effect.kind===(choosing==='food'?'heal':'status')&&
    (!reserved.has(entry.uid)||monster.heldItems[choosing]===entry.uid))
    .sort((a,b)=>Number(battleBag.includes(b.uid))-Number(battleBag.includes(a.uid))):[];
  useEffect(()=>{closeButton.current?.focus();},[]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      event.preventDefault();event.stopImmediatePropagation();
      if(choosing)setChoosing(null);else onClose();
    };
    window.addEventListener('keydown',onKey,true);
    return()=>window.removeEventListener('keydown',onKey,true);
  },[onClose,choosing]);
  useEffect(()=>{
    if(!choosing)return;
    const frame=requestAnimationFrame(()=>picker.current?.scrollIntoView({block:'center'}));
    return()=>cancelAnimationFrame(frame);
  },[choosing]);
  return <div className="overlay companion-details-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="modal-panel companion-details-panel" role="dialog" aria-modal="true" aria-labelledby="companion-details-title">
      <button ref={closeButton} className="close-button" onClick={onClose} aria-label="Fechar detalhes">✕</button>
      <div className="eyebrow">FICHA DO COMPANHEIRO</div>
      <div className="companion-details-intro">
        <img src={monsterPortrait(species.id)} alt={`Retrato de ${species.name}`}/>
        <div><h2 id="companion-details-title">{species.name} <span>Nv. {monster.level}</span></h2>
          <span className="companion-element" style={{color:ELEMENT_COLOR[species.element]}}>{ELEMENT_ICON[species.element]} {ELEMENT_LABEL[species.element]}</span>
          <p>{species.description}</p>
        </div>
      </div>
      <div className="companion-details-meters">
        <div><span><strong>Vida atual</strong><b>{monster.hp} / {maximum} PV</b></span><i className="companion-details-track"><i style={{width:`${health}%`,background:health<=30?'#ef9a73':'#91d4a2'}}/></i></div>
        <div><span><strong>Experiência para o próximo nível</strong><b>{monster.xp} / {required} XP</b></span><i className="companion-details-track"><i style={{width:`${experience}%`,background:'#efc37e'}}/></i></div>
      </div>
      <section className="companion-held" aria-label="Itens automáticos da criatura">
        <div className="companion-held-heading"><h3>Itens automáticos</h3><span>1 comida · 1 poção ou artefato</span></div>
        <div className="companion-held-grid">{(['food','support'] as const).map(slot=>{
          const uid=monster.heldItems[slot];
          const entry=inventory.find(item=>item.uid===uid);
          const info=entry?ITEMS[entry.itemId]:null;
          const label=slot==='food'?'Comida':'Poção / artefato';
          return <button key={slot} type="button" className={`companion-held-slot ${info?'filled':''} ${choosing===slot?'choosing':''}`}
            style={info?{'--held-color':info.color} as React.CSSProperties:undefined}
            disabled={!!game.battle} onClick={()=>setChoosing(choosing===slot?null:slot)}
            aria-label={`${label}: ${info?.name??'vazio'}. ${info?'Trocar item':'Escolher item'}`}>
            <span className="companion-held-art">{info?<img src={itemArt(info.id)} alt=""/>:<b>+</b>}</span>
            <span><small>{label.toUpperCase()}</small><strong>{info?.name??'Escolher item'}</strong>
              <em>{slot==='food'?'Usa ao chegar a 50% de vida':'Ativa ao entrar na arena'}</em></span>
          </button>;
        })}</div>
        {game.battle?<p className="companion-held-note">Organize estes itens fora da batalha.</p>:null}
        {choosing&&!game.battle?<div className="companion-item-picker" ref={picker}>
          <div className="companion-item-picker-heading"><strong>{choosing==='food'?'Escolher comida':'Escolher poção ou artefato'}</strong>
            <button type="button" onClick={()=>setChoosing(null)} aria-label="Fechar escolha de item">✕</button></div>
          <p>Itens da mochila de batalha e do inventário. Cada unidade só pode ocupar um lugar.</p>
          <div className="companion-item-options">{options.map(entry=>{
            const info=ITEMS[entry.itemId],bagSlot=battleBag.indexOf(entry.uid);
            return <button key={entry.uid} type="button" style={{'--held-color':info.color} as React.CSSProperties}
              onClick={()=>{if(game.equipMonsterItem(monster.uid,choosing,entry.uid))setChoosing(null);}}
              aria-label={`Equipar ${info.name} em ${species.name}, ${bagSlot>=0?`da mochila, espaço ${bagSlot+1}`:'do inventário'}`}>
              <img src={itemArt(info.id)} alt=""/><span><strong>{info.name}</strong><small>{bagSlot>=0?`Mochila de batalha · espaço ${bagSlot+1}`:'Inventário'} · {info.description}</small></span>
            </button>;
          })}{!options.length?<span className="companion-item-empty">Nenhum item deste tipo disponível.</span>:null}</div>
          {monster.heldItems[choosing]?<button type="button" className="companion-item-remove" onClick={()=>{
            game.unequipMonsterItem(monster.uid,choosing);setChoosing(null);
          }}>Retirar item da criatura</button>:null}
        </div>:null}
      </section>
      <div className="companion-details-stats">
        <span>ATQ <b>{attack(monster)}</b></span><span>DEF <b>{defense(monster)}</b></span>
        <span>VEL <b>{speed(monster)}</b></span><span>SORTE <b>{luck(monster)}</b></span>
        <span>ÁREA <b>{attackRadius(monster).toFixed(1)}</b></span>
      </div>
      <div className="companion-details-skill"><small>HABILIDADE ESPECIAL</small><strong>{species.skill.name}</strong>
        <span>Dispara automaticamente quando a carga chega a 100%.</span></div>
      {species.evolvesTo?<p className="companion-details-evolution">Evolui para {SPECIES[species.evolvesTo].name} no nível 6.</p>:null}
      <button className="secondary companion-details-collection" onClick={onCollection}>Ver equipe e coleção</button>
    </section>
  </div>;
}
