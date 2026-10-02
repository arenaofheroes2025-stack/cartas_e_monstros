import { useState, type CSSProperties } from 'react';
import { Game } from '../game/game';
import { attack, defense, ELEMENT_COLOR, ELEMENT_LABEL, experienceNeeded, maxHp, speed, SPECIES, type Monster } from '../game/content';
import { monsterPortrait } from '../render/art';
import { attackDamage } from '../game/battle/rules';
import './combatReadability.css';
import { PwaInstallButton, type PwaInstallState } from './PwaInstall';

export function BattleMenuPanel({game}:{game:Game}) {
  const battle=game.battle,save=game.save;
  if (!battle||!save||game.battleMenu!=='party') return null;
  return <div className="overlay battle-menu-overlay"><div className="modal-panel battle-menu-panel">
    <button className="close-button" onClick={()=>game.closeBattleMenu()} aria-label="Fechar menu">✕</button>
    <div className="eyebrow">COMBATE PAUSADO</div>
    <h2>Escolher companheiro</h2>
      <p>Escolha um monstro com vida para entrar na arena.</p>
      <div className="battle-menu-grid">{save.party.map((monster,i)=><button key={monster.uid} className="battle-menu-item" disabled={monster.hp<=0||i===battle.allyIndex} onClick={()=>game.switchMonster(i)}><img src={monsterPortrait(monster.species)} alt=""/><strong>{SPECIES[monster.species].name}</strong><small>Nv. {monster.level} · {i===battle.allyIndex?battle.ally.hp:monster.hp}/{maxHp(monster)} PV</small><span className="battle-menu-health-track"><i style={{width:`${Math.max(0,Math.min(100,(i===battle.allyIndex?battle.ally.hp:monster.hp)/maxHp(monster)*100))}%`}}/></span></button>)}</div>
    <button className="subtle-link" onClick={()=>game.closeBattleMenu()}>Voltar à arena</button>
  </div></div>;
}

function MonsterCard({monster,chosen=false,action,onClick,onDetails}:{monster:Monster;chosen?:boolean;action:string;onClick:()=>void;onDetails:()=>void}) {
  const species=SPECIES[monster.species];
  const needed=experienceNeeded(monster.level);
  const health=Math.max(0,Math.min(100,monster.hp/maxHp(monster)*100));
  const experience=Math.max(0,Math.min(100,monster.xp/needed*100));
  return <div className={chosen?'creature-card chosen':'creature-card'} style={{'--creature-accent':ELEMENT_COLOR[species.element]} as CSSProperties}>
    <button type="button" className="creature-card-select" onClick={onClick} aria-pressed={chosen} aria-label={`${species.name}, nível ${monster.level}, ${monster.hp} de ${maxHp(monster)} PV, ${monster.xp} de ${needed} EXP. ${action}`}>
      <span className="creature-card-art"><img src={monsterPortrait(monster.species)} alt=""/></span>
      <strong className="creature-card-name">{species.name}</strong>
      <span className="creature-card-vitals"><span className="creature-card-level">Nv. {monster.level}</span><span className="creature-card-health"><span className="creature-health-track"><i style={{width:`${health}%`}}/></span><small>{monster.hp}/{maxHp(monster)}</small></span></span>
      <span className="creature-card-xp" title={`${monster.xp}/${needed} EXP`}><small>EXP</small><span><i style={{width:`${experience}%`}}/></span></span>
    </button>
    <button type="button" className="creature-card-details" onClick={onDetails} aria-label={`Ver ficha e itens de ${species.name}`} title={`Ficha e itens de ${species.name}`}>i</button>
  </div>;
}

export function BattleInspection({monster,hp,opponent,onClose}:{monster:Monster;hp:number;opponent?:Monster;onClose:()=>void}) {
  const species=SPECIES[monster.species];
  return <div className="overlay battle-inspection-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="modal-panel battle-inspection-panel" role="dialog" aria-modal="true" aria-label={`Atributos de ${species.name}`}>
      <button type="button" className="close-button" onClick={onClose} aria-label="Fechar atributos">✕</button>
      <div className="eyebrow">CRIATURA INIMIGA</div>
      <div className="battle-inspection-main"><img src={monsterPortrait(monster.species)} alt=""/>
        <div><h2>{species.name} <small>Nv. {monster.level}</small></h2><span>{ELEMENT_LABEL[species.element]} · {Math.ceil(hp)}/{maxHp(monster)} PV</span>
          <div className="battle-inspection-stats"><b>ATQ {attack(monster)}</b><b>DEF {defense(monster)}</b><b>VEL {speed(monster)}</b></div>
        </div></div>
      <div className="battle-inspection-skill"><strong>✦ {species.skill.name}</strong><span>Golpe {attack(monster)} ATQ · especial +{species.skill.power}</span></div>
      {opponent?<p>Contra {SPECIES[opponent.species].name}: golpe {attackDamage(monster,opponent,false)} PV · especial {attackDamage(monster,opponent,true)} PV. O elemento, a defesa e críticos podem alterar o dano.</p>:null}
    </section>
  </div>;
}

export function CollectionPanel({game,covered=false,onClose,onDetails}:{game:Game;covered?:boolean;onClose:()=>void;onDetails:(uid:string)=>void}) {
  const [selected,setSelected]=useState<{side:'party'|'reserve';index:number}|null>(null);
  const save=game.save;
  if(!save)return null;
  const chooseParty=(index:number)=>{
    if(selected?.side==='reserve') {game.swapCollection(selected.index,index);setSelected(null);return;}
    setSelected(selected?.side==='party'&&selected.index===index?null:{side:'party',index});
  };
  const chooseReserve=(index:number)=>{
    if(save.party.length<3||selected?.side==='party') {game.swapCollection(index,selected?.side==='party'?selected.index:undefined);setSelected(null);return;}
    setSelected(selected?.side==='reserve'&&selected.index===index?null:{side:'reserve',index});
  };
  const hint=save.party.length<3?'Toque em uma criatura da reserva para entrar na equipe.':selected?.side==='party'?'Agora escolha uma criatura da reserva.':selected?.side==='reserve'?'Agora escolha uma vaga da equipe.':'Escolha uma criatura em cada coluna para trocar.';
  return <div className="overlay" inert={covered} aria-hidden={covered}><div className={`modal-panel collection-panel${save.collection.length?'':` is-empty-reserve team-size-${save.party.length}`}`} role="dialog" aria-modal={!covered} aria-labelledby="team-title">
    <button type="button" className="close-button" onClick={onClose} aria-label="Fechar equipe">✕</button>
    <header className="team-panel-header"><div><div className="eyebrow">SUAS CRIATURAS</div><h2 id="team-title">Equipe</h2></div></header>
    <div className="team-panel-layout">
      <section className="team-panel-section"><h3>Equipe ativa <small>{save.party.length}/3</small></h3><div className="creature-list team">{save.party.map((monster,i)=><MonsterCard key={monster.uid} monster={monster} chosen={selected?.side==='party'&&selected.index===i} action={selected?.side==='reserve'?'Trocar por esta vaga':'Selecionar vaga para trocar'} onClick={()=>chooseParty(i)} onDetails={()=>onDetails(monster.uid)}/>)}</div></section>
      <section className="team-panel-section"><h3>Reserva <small>{save.collection.length}</small></h3>{save.collection.length?<div className="creature-list reserve">{save.collection.map((monster,i)=><MonsterCard key={monster.uid} monster={monster} chosen={selected?.side==='reserve'&&selected.index===i} action={save.party.length<3?'Adicionar à equipe':selected?.side==='party'?'Trocar com a vaga escolhida':'Selecionar para troca'} onClick={()=>chooseReserve(i)} onDetails={()=>onDetails(monster.uid)}/>)}</div>:<p className="empty-note">Criaturas capturadas ficam aqui.</p>}</section>
    </div>
    {save.collection.length>0?<p className="collection-foot" aria-live="polite">{hint}</p>:null}
  </div></div>;
}

export function PausePanel({game,quality,setQuality,pwa}:{game:Game;quality:'high'|'low';setQuality:(v:'high'|'low')=>void;pwa:PwaInstallState}) {
  return <div className="overlay"><div className="modal-panel pause-panel"><div className="eyebrow">PAUSA</div><h2>A aventura espera</h2><p>O mundo e o relógio param enquanto este menu está aberto.</p>
    <button className="primary" onClick={()=>game.togglePause()}>Continuar</button>
    <button className="secondary" onClick={()=>{game.persist();game.notify('Jogo salvo neste dispositivo.');game.togglePause();}}>Salvar agora</button>
    <PwaInstallButton pwa={pwa}/>
    <div className="setting-row"><span>Qualidade gráfica</span><div className="segment"><button className={quality==='high'?'selected':''} onClick={()=>setQuality('high')}>Alta</button><button className={quality==='low'?'selected':''} onClick={()=>setQuality('low')}>Leve</button></div></div>
    <div className="controls-copy">Exploração: WASD ou setas para andar, Z para interagir. Batalha: setas para andar · Z atacar · X esquivar · C especial · A perseguir/voltar · S cartas · Q mochila. Espaço pula · Esc pausa.</div>
    <button className="subtle-link" onClick={()=>{game.persist();window.location.reload();}}>Voltar ao início</button>
  </div></div>;
}
