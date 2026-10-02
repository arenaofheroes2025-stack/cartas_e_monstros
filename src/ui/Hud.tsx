import { Game } from '../game/game';
import { ELEMENT_COLOR, ELEMENT_ICON, ELEMENT_LABEL, experienceNeeded, maxHp, SPECIES } from '../game/content';
import { CompanionPortrait } from './CompanionPortrait';
import { MapGlyph } from './WorldMapPanel';
import './companionHud.css';

export function Hud({game,onCollection,onBag,onMap,onCompanion}:{game:Game;onCollection:()=>void;onBag:()=>void;onMap:()=>void;onCompanion:(uid:string)=>void}) {
  const save=game.save;
  if(!save)return null;
  const hour=Math.floor(game.hour),minute=Math.floor((game.hour-hour)*60);
  const current=save.party.find(monster=>monster.hp>0)??save.party[0];
  if(!current)return null;
  const healthMax=maxHp(current),xpMax=experienceNeeded(current.level);
  const hpPercent=Math.max(0,Math.min(100,current.hp/healthMax*100));
  const xpPercent=Math.max(0,Math.min(100,current.xp/xpMax*100));
  return <>
    <div className="hud-top-left">
      <div className="brand-chip"><span className="brand-mark">✦</span><span>Cartas <em>&</em> Monstros</span></div>
      {game.mode!=='battle'?<div className="objective-chip"><span>◉</span>{save.completed?'Região concluída · continue explorando':'Reúna os três selos elementais'}</div>:null}
    </div>
    <div className="hud-top-right">
      <div className="time-chip"><span>{game.isNight?'☾':'☀'}</span>{String(hour).padStart(2,'0')}:{String(minute).padStart(2,'0')} <small>{game.isNight?'Noite':'Dia'}</small></div>
      <div className="seals-chip">{(['fogo','agua','natureza'] as const).map(element=><span key={element} className={save.seals.includes(element)?'lit':''} style={{'--seal-color':ELEMENT_COLOR[element]} as React.CSSProperties} title={'Selo de '+ELEMENT_LABEL[element]}>{ELEMENT_ICON[element]}</span>)}</div>
      <button className="icon-button" aria-label="Pausar" onClick={()=>game.togglePause()}>☰</button>
    </div>
    {game.mode==='explore'?<>
      <div className="hud-bottom-left"><button type="button" className="companion-chip" onClick={()=>onCompanion(current.uid)}
        aria-label={`Ver detalhes de ${SPECIES[current.species].name}, nível ${current.level}, ${current.hp} de ${healthMax} pontos de vida, ${current.xp} de ${xpMax} de experiência`}>
        <CompanionPortrait game={game} species={current.species}/>
        <span className="companion-info">
          <span className="companion-heading"><small>COMPANHEIRO</small><i aria-hidden="true">↗</i></span>
          <strong>{SPECIES[current.species].name} <span>Nv. {current.level}</span></strong>
          <span className="companion-stat"><span>PV</span><span className={`companion-track companion-health ${hpPercent<=30?'low':''}`}><i style={{width:`${hpPercent}%`}}/></span><b>{current.hp}/{healthMax}</b></span>
          <span className="companion-stat"><span>XP</span><span className="companion-track companion-xp"><i style={{width:`${xpPercent}%`}}/></span><b>{current.xp}/{xpMax}</b></span>
        </span>
      </button><div className="desktop-hint">WASD para andar · Espaço para pular · Z para interagir</div></div>
      <div className="hud-bottom-right"><button type="button" className="map-open-button" onClick={onMap} aria-label="Abrir mapa da região" title="Abrir mapa da região"><MapGlyph/></button><button onClick={onBag} className="collection-button" aria-label="Abrir inventário e mochila"><img src="/art/ui/hero-satchel.png" alt="" style={{width:20,height:20,objectFit:'contain',verticalAlign:'middle',imageRendering:'pixelated'}}/> Mochila <span>{save.battleBag.filter(Boolean).length}/6</span></button><button onClick={onCollection} className="collection-button">Coleção <span>{save.party.length+save.collection.length}</span></button></div>
    </>:null}
    {game.mode!=='battle'&&game.message&&game.messageTime>0?<div className="toast" key={game.message}>{game.message}</div>:null}
  </>;
}
