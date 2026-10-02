import { useEffect, useRef, useState } from 'react';
import { attack, defense, ELEMENT_COLOR, ELEMENT_ICON, ELEMENT_LABEL, experienceNeeded, luck, maxHp, SPECIES, speed, type HeldItemSlot, type Monster } from '../game/content';
import { Game } from '../game/game';
import { ITEMS, itemArt } from '../game/items';
import { attackDamage, attackRadius } from '../game/battle/rules';
import { monsterPortrait } from '../render/art';
import './companionDetails.css';

function Radar({values}:{values:number[]}) {
  const point=(index:number,scale:number)=>{
    const angle=-Math.PI/2+index*Math.PI/3;
    return `${(60+Math.cos(angle)*scale).toFixed(1)},${(60+Math.sin(angle)*scale).toFixed(1)}`;
  };
  return <svg className="companion-radar" viewBox="0 0 120 120" aria-hidden="true">
    {[12,24,36,48].map(radius=><polygon key={radius}
      points={values.map((_,index)=>point(index,radius)).join(' ')} className="companion-radar-ring"/>)}
    {values.map((_,index)=><line key={index} x1="60" y1="60"
      x2={point(index,48).split(',')[0]} y2={point(index,48).split(',')[1]} className="companion-radar-axis"/>)}
    <polygon points={values.map((value,index)=>point(index,Math.max(8,Math.min(48,value*48)))).join(' ')}
      className="companion-radar-shape"/>
    <circle cx="60" cy="60" r="3" className="companion-radar-center"/>
  </svg>;
}

export function CompanionDetails({game,monster,onClose,onCollection,onSelect}:{game:Game;monster:Monster;onClose:()=>void;onCollection:()=>void;onSelect:(uid:string)=>void}) {
  const closeButton=useRef<HTMLButtonElement>(null);
  const pickerClose=useRef<HTMLButtonElement>(null);
  const [choosing,setChoosing]=useState<HeldItemSlot|null>(null);
  const species=SPECIES[monster.species];
  const maximum=maxHp(monster),required=experienceNeeded(monster.level);
  const health=Math.max(0,Math.min(100,monster.hp/maximum*100));
  const experience=Math.max(0,Math.min(100,monster.xp/required*100));
  const inventory=game.save?.inventory??[];
  const battleBag=game.save?.battleBag??[];
  const roster=[...(game.save?.party??[]),...(game.save?.collection??[])];
  const reserved=new Set(roster.flatMap(entry=>
    [entry.heldItems.food,entry.heldItems.support].filter((uid):uid is string=>!!uid)));
  const options=choosing?inventory.filter(entry=>
    ITEMS[entry.itemId].effect.kind===(choosing==='food'?'heal':'status')&&
    (!reserved.has(entry.uid)||monster.heldItems[choosing]===entry.uid))
    .sort((a,b)=>Number(battleBag.includes(b.uid))-Number(battleBag.includes(a.uid))):[];
  const metrics=[
    {label:'PV',value:maximum,max:90},
    {label:'ATQ',value:attack(monster),max:28},
    {label:'DEF',value:defense(monster),max:28},
    {label:'VEL',value:speed(monster),max:28},
    {label:'SORTE',value:luck(monster),max:28},
    {label:'ÁREA',value:attackRadius(monster),max:2.4}
  ];
  useEffect(()=>{closeButton.current?.focus();},[]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();event.stopImmediatePropagation();
        if(choosing)setChoosing(null);else onClose();
      } else if(!choosing&&roster.length>1&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){
        event.preventDefault();
        const current=roster.findIndex(entry=>entry.uid===monster.uid);
        const direction=event.key==='ArrowRight'?1:-1;
        onSelect(roster[(current+direction+roster.length)%roster.length].uid);
      }
    };
    window.addEventListener('keydown',onKey,true);
    return()=>window.removeEventListener('keydown',onKey,true);
  },[onClose,onSelect,choosing,monster.uid,roster]);
  useEffect(()=>{if(!choosing)return;const frame=requestAnimationFrame(()=>pickerClose.current?.focus());return()=>cancelAnimationFrame(frame);},[choosing]);
  const opponent=game.battle?.enemy;
  return <><div className="overlay companion-details-overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!choosing)onClose();}}>
    <section className="modal-panel companion-details-panel" role="dialog" aria-modal={!choosing} inert={!!choosing}
      aria-labelledby="companion-details-title" style={{'--creature-color':ELEMENT_COLOR[species.element]} as React.CSSProperties}>
      <button ref={closeButton} className="close-button" onClick={onClose} aria-label="Fechar detalhes">✕</button>
      <header className="companion-summary-header">
        <div className="companion-summary-heading">
          <span className="eyebrow">FICHA DO COMPANHEIRO</span>
          <div className="companion-summary-title">
            <h2 id="companion-details-title">{species.name}</h2>
            <span className="companion-summary-level">Nv. {monster.level}</span>
            <span className="companion-element" style={{color:ELEMENT_COLOR[species.element]}}>
              {ELEMENT_ICON[species.element]} {ELEMENT_LABEL[species.element]}</span>
          </div>
        </div>
        {roster.length>1?<nav className="companion-roster" aria-label="Trocar criatura">
          {roster.map(entry=><button key={entry.uid} type="button" className={entry.uid===monster.uid?'active':''}
            aria-label={`Ver ficha de ${SPECIES[entry.species].name}`}
            aria-current={entry.uid===monster.uid?'true':undefined} onClick={()=>onSelect(entry.uid)}>
            <img src={monsterPortrait(entry.species)} alt=""/>
          </button>)}
        </nav>:null}
      </header>
      <div className="companion-summary-layout">
        <div className="companion-summary-portrait-column">
          <div className="companion-summary-portrait">
            <img src={monsterPortrait(species.id)} alt={`Retrato de ${species.name}`}/>
            <span>{ELEMENT_ICON[species.element]}</span>
          </div>
          <p className="companion-summary-description">{species.description}</p>
          <div className="companion-details-meters">
            <div><span><strong>PV</strong><b>{monster.hp} / {maximum}</b></span>
              <i className="companion-details-track"><i style={{width:`${health}%`,background:health<=30?'#ef9a73':'#91d4a2'}}/></i></div>
            <div><span><strong>XP</strong><b>{monster.xp} / {required}</b></span>
              <i className="companion-details-track"><i style={{width:`${experience}%`,background:'#efc37e'}}/></i></div>
          </div>
          {species.evolvesTo?<p className="companion-details-evolution">Evolui para {SPECIES[species.evolvesTo].name} no nível 6.</p>:null}
          <button className="secondary companion-details-collection" onClick={onCollection}>Ver equipe</button>
        </div>
        <div className="companion-summary-detail-column">
          <section className="companion-summary-stats" aria-labelledby="companion-stats-heading">
            <h3 id="companion-stats-heading">Atributos <span/></h3>
            <div className="companion-summary-stat-content">
              <Radar values={metrics.map(metric=>metric.value/metric.max)}/>
              <dl className="companion-details-stats">{metrics.map(metric=>
                <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.label==='ÁREA'?metric.value.toFixed(1):metric.value}</dd></div>)}</dl>
            </div>
          </section>
          <section className="companion-held" aria-label="Itens automáticos da criatura">
            <div className="companion-held-heading"><h3>Itens preparados</h3><span>1 comida · 1 poção ou artefato</span></div>
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
                  <em>{slot==='food'?'Usa com 50% de vida':'Ativa ao entrar na arena'}</em></span>
              </button>;
            })}</div>
            {game.battle?<p className="companion-held-note">Organize estes itens fora da batalha.</p>:null}
          </section>
          <div className="companion-details-skill"><small>HABILIDADE ESPECIAL</small><strong>{species.skill.name}</strong>
            <span>Golpe {attack(monster)} ATQ · especial +{species.skill.power} poder</span>
            {opponent?<span>Contra {SPECIES[opponent.species].name}: golpe {attackDamage(monster,opponent,false)} PV · especial {attackDamage(monster,opponent,true)} PV</span>
              :<span>O elemento e a defesa do alvo alteram o dano. Mínimo: 1 PV.</span>}</div>
        </div>
      </div>
    </section>
  </div>
  {choosing&&!game.battle?<div className="overlay companion-picker-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setChoosing(null);}}>
    <section className="modal-panel companion-item-picker" role="dialog" aria-modal="true" aria-label={choosing==='food'?'Escolher comida':'Escolher poção ou artefato'}>
      <div className="companion-item-picker-heading"><strong>{choosing==='food'?'Escolher comida':'Escolher poção ou artefato'}</strong>
        <button ref={pickerClose} type="button" onClick={()=>setChoosing(null)} aria-label="Fechar escolha de item">✕</button></div>
      <p>Escolha uma unidade disponível.</p>
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
    </section></div>:null}</>;
}
