import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Camera } from 'three';
import { Game } from './game/game';
import { WorldScene } from './render/WorldScene';
import { useControls } from './input/useControls';
import { StartMenu } from './ui/StartMenu';
import { Hud } from './ui/Hud';
import { CompanionDetails } from './ui/CompanionDetails';
import { InventoryPanel } from './ui/InventoryPanel';
import { ShopPanel } from './ui/ShopPanel';
import { WorldMapPanel } from './ui/WorldMapPanel';
import { BattleHud } from './ui/BattleHud';
import { TouchControls } from './ui/TouchControls';
import { WorldInteraction } from './ui/WorldInteraction';
import { RotateDevicePrompt } from './ui/RotateDevicePrompt';
import { usePortraitLock } from './input/usePortraitLock';
import { PwaInstallHelp, usePwaInstall } from './ui/PwaInstall';
import { BattleInspection, BattleMenuPanel, CollectionPanel, PausePanel } from './ui/Overlays';
import './style.css';
import './ui/mobileLandscape.css';
import './ui/mobileMenus.css';
import './ui/inventoryReference.css';
import './ui/screenTheme.css';
import './ui/mobileActionWheel.css';
import './ui/streamlinedMenus.css';
import './ui/explorationHud.css';

function App() {
  const [game]=useState(()=>new Game());
  const cameraRef=useRef<Camera|null>(null);
  const [,setRevision]=useState(0);
  const [collection,setCollection]=useState(false);
  const [bagOpen,setBagOpen]=useState(false);
  const [mapOpen,setMapOpen]=useState(false);
  const [detailsUid,setDetailsUid]=useState<string|null>(null);
  const detailsReturnFocus=useRef<HTMLElement|null>(null);
  const [enemyDetails,setEnemyDetails]=useState(false);
  const [quality,setQualityState]=useState<'high'|'low'>(()=>{
    const stored=localStorage.getItem('cartas-quality');
    if(stored==='high'||stored==='low')return stored;
    return window.matchMedia('(pointer: coarse)').matches||window.innerWidth<700?'low':'high';
  });
  const orientationPaused=usePortraitLock();
  const pwa=usePwaInstall();
  const overlayOpen=collection||detailsUid!==null||bagOpen||mapOpen||enemyDetails||game.shopOpen||pwa.helpOpen;
  const toggleBag=useCallback(()=>setBagOpen(value=>!value),[]);
  const controls=useControls(game,orientationPaused||overlayOpen,toggleBag);
  const openDetails=useCallback((uid:string)=>{
    detailsReturnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setDetailsUid(uid);
  },[]);
  const closeDetails=useCallback(()=>{
    setDetailsUid(null);
    const target=detailsReturnFocus.current;
    detailsReturnFocus.current=null;
    requestAnimationFrame(()=>{if(target?.isConnected)target.focus({preventScroll:true});});
  },[]);
  useEffect(()=>{
    game.onChange=()=>setRevision(value=>value+1);
    if (import.meta.env.DEV || import.meta.env.MODE==='qa')
      (window as Window & {__cartasGame?:Game}).__cartasGame=game;
    return()=>{
      game.onChange=null;
      if (import.meta.env.DEV || import.meta.env.MODE==='qa')
        delete (window as Window & {__cartasGame?:Game}).__cartasGame;
    };
  },[game]);
  const setQuality=(value:'high'|'low')=>{setQualityState(value);localStorage.setItem('cartas-quality',value);};
  const inGame=game.mode!=='title';
  const detailedMonster=detailsUid?game.save?.party.find(monster=>monster.uid===detailsUid)??
    game.save?.collection.find(monster=>monster.uid===detailsUid):undefined;
  return <main className="game-app">
    <div className="scene"><WorldScene game={game} quality={quality} orientationPaused={orientationPaused||overlayOpen} cameraRef={cameraRef}/></div>
    {game.mode==='title'?<StartMenu game={game} pwa={pwa}/>:null}
    {inGame&&game.mode!=='dialog'&&!game.battle?.finisher&&!game.battle?.captureSequence&&!(game.mode==='battle'&&(game.battle?.intro??0)>0)?<Hud game={game} onCollection={()=>setCollection(true)} onBag={()=>setBagOpen(true)} onMap={()=>setMapOpen(true)} onCompanion={openDetails}/>:null}
    {game.mode==='battle'&&game.battle?.intro===0?<BattleHud game={game} cameraRef={cameraRef} onAllyDetails={openDetails} onEnemyDetails={()=>setEnemyDetails(true)}/>:null}
    {game.mode==='battle'&&game.battleMenu==='party'?<BattleMenuPanel game={game}/>:null}
    {bagOpen?<InventoryPanel game={game} covered={detailsUid!==null} onClose={()=>setBagOpen(false)} onCompanion={openDetails}/>:null}
    {mapOpen?<WorldMapPanel game={game} onClose={()=>setMapOpen(false)}/>:null}
    {game.shopOpen?<ShopPanel game={game}/>:null}
    {inGame&&!orientationPaused&&!game.shopOpen?<WorldInteraction game={game} cameraRef={cameraRef}/>:null}
    {game.mode==='pause'?<PausePanel game={game} quality={quality} setQuality={setQuality} pwa={pwa}/>:null}
    {collection?<CollectionPanel game={game} covered={detailsUid!==null} onClose={()=>setCollection(false)} onDetails={openDetails}/>:null}
    {detailedMonster?<CompanionDetails game={game} monster={detailedMonster} onClose={closeDetails}
      onSelect={setDetailsUid}
      onCollection={()=>{if(collection){closeDetails();return;}detailsReturnFocus.current=null;setDetailsUid(null);setBagOpen(false);setCollection(true);}}/>:null}
    {enemyDetails&&game.battle?<BattleInspection monster={game.battle.enemy} hp={game.battle.foe.hp} opponent={game.activeMonster??undefined} onClose={()=>setEnemyDetails(false)}/>:null}
    {!orientationPaused&&!game.shopOpen&&(game.mode==='explore'||(game.mode==='battle'&&game.battle?.intro===0&&!game.battle.finisher&&!game.battle.captureSequence&&!game.battleMenu))?<TouchControls game={game} controls={controls}/>:null}
    {orientationPaused?<RotateDevicePrompt/>:null}
    <PwaInstallHelp pwa={pwa}/>
  </main>;
}

createRoot(document.getElementById('app')!).render(<App/>);
