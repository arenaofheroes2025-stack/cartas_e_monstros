import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { Game } from '../game/game';
import { drawWorldMap, mapLandmarks, type MapLandmark, type MapView } from './worldMapData';
import './worldMap.css';

export function MapGlyph({size=22}:{size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 5.5 9 3l6 2.5L21 3v15.5L15 21l-6-2.5L3 21zM9 3v15.5M15 5.5V21"/>
    <path d="m10.8 10.3 1.1 1.4 1.5-2.2" strokeWidth="1.5"/>
  </svg>;
}

const SYMBOL:Record<MapLandmark['kind'],string>={village:'◆',house:'⌂',shop:'◈',shrine:'✦'};
const KIND:Record<MapLandmark['kind'],string>={village:'Ponto de partida',house:'Casa',shop:'Loja',shrine:'Santuário'};

export function WorldMapPanel({game,onClose}:{game:Game;onClose:()=>void}) {
  const world=game.world,save=game.save;
  const canvas=useRef<HTMLCanvasElement>(null);
  const viewport=useRef<HTMLDivElement>(null);
  const drag=useRef<{x:number;y:number;panX:number;panY:number}|null>(null);
  const [view,setView]=useState<MapView>('terrain');
  const [selected,setSelected]=useState<string|null>(null);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const discovered=useMemo(()=>new Set(save?.discovered??[]),[save?.discovered]);
  const landmarks=useMemo(()=>world?mapLandmarks(world,discovered):[],[world,discovered]);
  const landmark=landmarks.find(item=>item.id===selected);

  useEffect(()=>{if(world&&canvas.current)drawWorldMap(canvas.current,world,discovered,view);},[world,discovered,view]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();}};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[onClose]);

  if(!world||!save)return null;
  const clampPan=(next:{x:number;y:number},scale=zoom)=>{
    const width=viewport.current?.clientWidth??0,height=viewport.current?.clientHeight??0;
    return {x:Math.max(-width*(scale-1)/2,Math.min(width*(scale-1)/2,next.x)),
      y:Math.max(-height*(scale-1)/2,Math.min(height*(scale-1)/2,next.y))};
  };
  const changeZoom=(value:number)=>{
    const next=Math.max(1,Math.min(3,Math.round(value*4)/4));
    setZoom(next);setPan(current=>clampPan(current,next));
  };
  const focusLandmark=(item:MapLandmark)=>{
    setSelected(item.id);
    if(zoom<=1)return;
    const width=viewport.current?.clientWidth??0,height=viewport.current?.clientHeight??0;
    setPan(clampPan({x:(.5-(item.x+.5)/world.size)*width*zoom,
      y:(.5-(item.z+.5)/world.size)*height*zoom}));
  };
  const pointerDown=(event:PointerEvent<HTMLDivElement>)=>{
    if(event.button!==0||event.target instanceof Element&&event.target.closest('button'))return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={x:event.clientX,y:event.clientY,panX:pan.x,panY:pan.y};
  };
  const pointerMove=(event:PointerEvent<HTMLDivElement>)=>{
    if(!drag.current)return;
    setPan(clampPan({x:drag.current.panX+event.clientX-drag.current.x,
      y:drag.current.panY+event.clientY-drag.current.y}));
  };
  const stopDrag=()=>{drag.current=null;};
  const wheel=(event:WheelEvent<HTMLDivElement>)=>{event.preventDefault();changeZoom(zoom+(event.deltaY<0?.25:-.25));};
  const explored=Math.round(discovered.size/world.tiles.length*100);

  return <div className="world-map-overlay" role="presentation" onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="world-map-panel" role="dialog" aria-modal="true" aria-label="Mapa da região">
      <header className="world-map-heading"><span className="world-map-emblem"><MapGlyph size={24}/></span><div><small>REGIÃO EXPLORADA · {explored}%</small><h2>Mapa da Região</h2></div>
        <button type="button" className="world-map-close" onClick={onClose} aria-label="Fechar mapa">✕</button></header>
      <div className="world-map-body">
        <div className="world-map-frame"><div className="world-map-viewport" ref={viewport}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} onWheel={wheel}>
          <div className="world-map-content" style={{'--pin-scale':1/zoom,transform:`translate3d(${pan.x}px,${pan.y}px,0) scale(${zoom})`} as React.CSSProperties}>
            <canvas ref={canvas} width={384} height={384} aria-label="Terreno explorado da região"/>
            {landmarks.map(item=><button key={item.id} type="button" className={`world-map-marker ${item.kind} ${selected===item.id?'selected':''}`}
              style={{left:`${(item.x+.5)/world.size*100}%`,top:`${(item.z+.5)/world.size*100}%`}}
              aria-label={`${item.name}, ${KIND[item.kind]}`} title={item.name} onClick={()=>focusLandmark(item)}>{SYMBOL[item.kind]}</button>)}
            <span className="world-map-player" style={{left:`${game.player.x/world.size*100}%`,top:`${game.player.z/world.size*100}%`}} aria-label="Sua posição"/>
          </div>
          <span className="world-map-compass" aria-hidden="true">↑ N</span>
        </div></div>
        <aside className="world-map-sidebar">
          <div className="world-map-view-switch" role="group" aria-label="Visualização do mapa">
            <button type="button" aria-pressed={view==='terrain'} className={view==='terrain'?'active':''} onClick={()=>setView('terrain')}>Terreno</button>
            <button type="button" aria-pressed={view==='height'} className={view==='height'?'active':''} onClick={()=>setView('height')}>Relevo</button>
          </div>
          <div className="world-map-landmark-info" aria-live="polite">
            {landmark?<><small>{KIND[landmark.kind].toUpperCase()}</small><strong>{landmark.name}</strong><span>Elevação {landmark.height} · região descoberta</span></>:
              <><small>EXPLORAÇÃO</small><strong>Você está aqui</strong><span>Toque em uma casa ou santuário para ver seu nome.</span></>}
          </div>
          <div className="world-map-key"><strong>{view==='height'?'Altura do terreno':'Legenda'}</strong>
            {view==='height'?<div className="world-map-height-scale">{['Baixo','1','2','3','Alto'].map((label,i)=><span key={label}><i style={{background:['#356f93','#438e98','#74a67c','#c0b572','#e1a876'][i]}}/>{label}</span>)}</div>:
              <div className="world-map-terrain-key"><span><i className="forest"/> Bosque</span><span><i className="fire"/> Brasa</span><span><i className="water"/> Água</span><span><i className="road"/> Caminho</span></div>}
          </div>
          <div className="world-map-places"><strong>Locais encontrados</strong><div>{landmarks.map(item=><button
            key={item.id} type="button" className={selected===item.id?'active':''}
            onClick={()=>focusLandmark(item)}><span>{SYMBOL[item.kind]}</span>{item.name}</button>)}</div></div>
          <div className="world-map-zoom"><span>Zoom <b>{Math.round(zoom*100)}%</b></span><div><button type="button" disabled={zoom<=1} aria-label="Diminuir zoom do mapa" onClick={()=>changeZoom(zoom-.25)}>−</button><button type="button" disabled={zoom>=3} aria-label="Aumentar zoom do mapa" onClick={()=>changeZoom(zoom+.25)}>+</button></div></div>
          <p className="world-map-help">Arraste para mover · use a roda ou os botões para ampliar.</p>
        </aside>
      </div>
    </section>
  </div>;
}
