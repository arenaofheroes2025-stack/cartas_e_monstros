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
type Point={x:number;y:number};
type ViewportSize={width:number;height:number};
type MapGesture={kind:'drag';start:Point;pan:Point}|{kind:'pinch';distance:number;zoom:number;anchor:Point};

function clampMapPan(next:Point,zoom:number,size:ViewportSize):Point {
  const mapSize=Math.max(size.width,size.height);
  return {x:Math.max(-(mapSize*zoom-size.width)/2,Math.min((mapSize*zoom-size.width)/2,next.x)),
    y:Math.max(-(mapSize*zoom-size.height)/2,Math.min((mapSize*zoom-size.height)/2,next.y))};
}

export function WorldMapPanel({game,onClose}:{game:Game;onClose:()=>void}) {
  const world=game.world,save=game.save;
  const canvas=useRef<HTMLCanvasElement>(null);
  const viewport=useRef<HTMLDivElement>(null);
  const pointers=useRef(new Map<number,Point>());
  const gesture=useRef<MapGesture|null>(null);
  const zoomRef=useRef(1);
  const panRef=useRef<Point>({x:0,y:0});
  const [view,setView]=useState<MapView>('terrain');
  const [selected,setSelected]=useState<string|null>(null);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const [viewportSize,setViewportSize]=useState<ViewportSize>({width:0,height:0});
  const discovered=useMemo(()=>new Set(save?.discovered??[]),[save?.discovered]);
  const landmarks=useMemo(()=>world?mapLandmarks(world,discovered):[],[world,discovered]);
  const landmark=landmarks.find(item=>item.id===selected);

  useEffect(()=>{if(world&&canvas.current)drawWorldMap(canvas.current,world,discovered,view);},[world,discovered,view]);
  useEffect(()=>{
    const element=viewport.current;
    if(!element)return;
    const resize=()=>{
      const size={width:element.clientWidth,height:element.clientHeight};
      if(!size.width||!size.height)return;
      setViewportSize(size);
      const next=clampMapPan(panRef.current,zoomRef.current,size);
      panRef.current=next;setPan(next);
    };
    const observer=new ResizeObserver(resize);
    observer.observe(element);resize();
    return()=>observer.disconnect();
  },[world]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();}};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[onClose]);

  if(!world||!save)return null;
  const currentSize=():ViewportSize=>({width:viewport.current?.clientWidth??0,height:viewport.current?.clientHeight??0});
  const applyView=(nextZoom:number,nextPan:Point)=>{
    const scale=Math.max(1,Math.min(3,nextZoom));
    const position=clampMapPan(nextPan,scale,currentSize());
    zoomRef.current=scale;panRef.current=position;
    setZoom(scale);setPan(position);
  };
  const changeZoom=(value:number,at?:Point)=>{
    const size=currentSize(),before=zoomRef.current;
    const next=Math.max(1,Math.min(3,value));
    const anchor=at??{x:size.width/2,y:size.height/2};
    const ratio=next/before;
    applyView(next,{x:anchor.x-size.width/2-(anchor.x-size.width/2-panRef.current.x)*ratio,
      y:anchor.y-size.height/2-(anchor.y-size.height/2-panRef.current.y)*ratio});
  };
  const focusLandmark=(item:MapLandmark)=>{
    setSelected(item.id);
    const size=currentSize(),mapSize=Math.max(size.width,size.height);
    applyView(zoomRef.current,{x:(.5-(item.x+.5)/world.size)*mapSize*zoomRef.current,
      y:(.5-(item.z+.5)/world.size)*mapSize*zoomRef.current});
  };
  const startGesture=()=>{
    const active=[...pointers.current.values()],rect=viewport.current?.getBoundingClientRect();
    if(!rect||!active.length){gesture.current=null;return;}
    if(active.length===1){gesture.current={kind:'drag',start:active[0],pan:panRef.current};return;}
    const midpoint={x:(active[0].x+active[1].x)/2-rect.left,y:(active[0].y+active[1].y)/2-rect.top};
    gesture.current={kind:'pinch',distance:Math.max(1,Math.hypot(active[0].x-active[1].x,active[0].y-active[1].y)),
      zoom:zoomRef.current,anchor:{x:(midpoint.x-rect.width/2-panRef.current.x)/zoomRef.current,
        y:(midpoint.y-rect.height/2-panRef.current.y)/zoomRef.current}};
  };
  const pointerDown=(event:PointerEvent<HTMLDivElement>)=>{
    const onMarker=event.target instanceof Element&&!!event.target.closest('button');
    if(event.button!==0||onMarker&&event.pointerType!=='touch')return;
    if(!onMarker)event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.current.size===2)for(const id of pointers.current.keys()){
      if(!event.currentTarget.hasPointerCapture(id))event.currentTarget.setPointerCapture(id);
    }
    startGesture();
  };
  const pointerMove=(event:PointerEvent<HTMLDivElement>)=>{
    if(!pointers.current.has(event.pointerId)||!gesture.current)return;
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const active=[...pointers.current.values()],state=gesture.current;
    if(state.kind==='drag'&&active.length===1){
      applyView(zoomRef.current,{x:state.pan.x+active[0].x-state.start.x,y:state.pan.y+active[0].y-state.start.y});
    }else if(state.kind==='pinch'&&active.length>=2){
      const rect=viewport.current!.getBoundingClientRect();
      const midpoint={x:(active[0].x+active[1].x)/2-rect.left,y:(active[0].y+active[1].y)/2-rect.top};
      const distance=Math.hypot(active[0].x-active[1].x,active[0].y-active[1].y);
      const nextZoom=Math.max(1,Math.min(3,state.zoom*distance/state.distance));
      applyView(nextZoom,{x:midpoint.x-rect.width/2-state.anchor.x*nextZoom,
        y:midpoint.y-rect.height/2-state.anchor.y*nextZoom});
    }
  };
  const stopPointer=(event:PointerEvent<HTMLDivElement>)=>{
    if(pointers.current.delete(event.pointerId))startGesture();
  };
  const wheel=(event:WheelEvent<HTMLDivElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    changeZoom(zoomRef.current*(event.deltaY<0?1.16:1/1.16),{x:event.clientX-rect.left,y:event.clientY-rect.top});
  };
  const explored=Math.round(discovered.size/world.tiles.length*100);
  const mapSize=viewportSize.width?Math.max(viewportSize.width,viewportSize.height):384;

  return <div className="world-map-overlay" role="presentation" onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="world-map-panel" role="dialog" aria-modal="true" aria-label="Mapa da região">
      <header className="world-map-heading"><span className="world-map-emblem"><MapGlyph size={24}/></span><div><small>REGIÃO EXPLORADA · {explored}%</small><h2>Mapa da Região</h2></div>
        <button type="button" className="world-map-close" onClick={onClose} aria-label="Fechar mapa">✕</button></header>
      <div className="world-map-body">
        <div className="world-map-frame"><div className="world-map-viewport" ref={viewport}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={stopPointer} onPointerCancel={stopPointer} onLostPointerCapture={stopPointer} onWheel={wheel}>
          <div className="world-map-content" style={{'--pin-scale':1/zoom,width:mapSize,height:mapSize,
            transform:`translate3d(calc(-50% + ${pan.x}px),calc(-50% + ${pan.y}px),0) scale(${zoom})`} as React.CSSProperties}>
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
          <p className="world-map-help"><span className="world-map-help-desktop">Arraste para mover · use a roda ou os botões para ampliar.</span>
            <span className="world-map-help-touch">Arraste para mover · aproxime ou afaste dois dedos para zoom.</span></p>
        </aside>
      </div>
    </section>
  </div>;
}
