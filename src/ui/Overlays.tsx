import { useState } from 'react';
import { Game } from '../game/game';
import { attack, defense, ELEMENT_COLOR, ELEMENT_LABEL, experienceNeeded, luck, maxHp, speed, SPECIES, type Monster } from '../game/content';
import { monsterPortrait } from '../render/art';
import { attackDamage, attackRadius } from '../game/battle/rules';
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
  return <div className={chosen?'creature-card chosen':'creature-card'}><button type="button" className="creature-card-select" onClick={onClick} aria-label={`${species.name}, nível ${monster.level}. ${action}`}>
    <span className="creature-card-head"><img src={monsterPortrait(monster.species)} alt=""/><span><strong>{species.name}</strong><em style={{color:ELEMENT_COLOR[species.element]}}>{ELEMENT_LABEL[species.element]}</em><small>Nv. {monster.level} · {monster.hp}/{maxHp(monster)} PV</small></span></span>
    <span className="creature-stats"><span>ATQ <b>{attack(monster)}</b></span><span>DEF <b>{defense(monster)}</b></span><span>VEL <b>{speed(monster)}</b></span><span>SORTE <b>{luck(monster)}</b></span><span>ÁREA <b>{attackRadius(monster).toFixed(1)}</b></span></span>
    <span className="creature-health-track"><i style={{width:`${Math.min(100,monster.hp/maxHp(monster)*100)}%`}}/></span>
    <span className="creature-xp-label">EXP <b>{monster.xp}/{needed}</b></span><span className="creature-xp-track"><i style={{width:`${Math.min(100,monster.xp/needed*100)}%`}}/></span>
    <span className="creature-card-action">{action}</span>
  </button><button type="button" className="creature-card-details" onClick={onDetails} aria-label={`Ver ficha e itens de ${species.name}`}>Ver ficha e itens ↗</button></div>;
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

export function CollectionPanel({game,onClose,onDetails}:{game:Game;onClose:()=>void;onDetails:(uid:string)=>void}) {
  const [target,setTarget]=useState<number|undefined>();
  const save=game.save;
  if(!save)return null;
  return <div className="overlay"><div className="modal-panel collection-panel"><button className="close-button" onClick={onClose}>✕</button><div className="eyebrow">SUA JORNADA</div><h2>Equipe & coleção</h2><p>Leve até três monstros. Capturas extras aguardam na coleção.</p>
    <h3>Equipe ativa</h3><div className="creature-list">{save.party.map((monster,i)=><MonsterCard key={monster.uid} monster={monster} chosen={target===i} action={target===i?'Vaga selecionada':'Selecionar vaga'} onClick={()=>setTarget(i)} onDetails={()=>onDetails(monster.uid)}/>)}</div>
    <h3>Reserva <small>{save.collection.length}</small></h3>{save.collection.length?<div className="creature-list">{save.collection.map((monster,i)=><MonsterCard key={monster.uid} monster={monster} action={save.party.length<3?'Adicionar à equipe':'Trocar com vaga'} onClick={()=>{game.swapCollection(i,target);setTarget(undefined);}} onDetails={()=>onDetails(monster.uid)}/>)}</div>:<p className="empty-note">Encontre monstros pelo mapa e capture com cartas elementais.</p>}
    <div className="collection-foot">Selecione uma vaga da equipe e depois um monstro da reserva para trocar.</div>
  </div></div>;
}

export function PausePanel({game,quality,setQuality,pwa}:{game:Game;quality:'high'|'low';setQuality:(v:'high'|'low')=>void;pwa:PwaInstallState}) {
  return <div className="overlay"><div className="modal-panel pause-panel"><div className="eyebrow">PAUSA</div><h2>A aventura espera</h2><p>O mundo e o relógio param enquanto este menu está aberto.</p>
    <button className="primary" onClick={()=>game.togglePause()}>Continuar</button>
    <button className="secondary" onClick={()=>{game.persist();game.notify('Jogo salvo neste dispositivo.');game.togglePause();}}>Salvar agora</button>
    <PwaInstallButton pwa={pwa}/>
    <div className="setting-row"><span>Qualidade gráfica</span><div className="segment"><button className={quality==='high'?'selected':''} onClick={()=>setQuality('high')}>Alta</button><button className={quality==='low'?'selected':''} onClick={()=>setQuality('low')}>Leve</button></div></div>
    <div className="controls-copy">WASD/setas: andar · Espaço: pular também na batalha · Z: interagir/atacar · X: esquivar · C: perseguir · V: voltar · B: cartas · Q: mochila rápida · I: inventário fora da batalha · Esc: pausa</div>
    <button className="subtle-link" onClick={()=>{game.persist();window.location.reload();}}>Voltar ao início</button>
  </div></div>;
}
