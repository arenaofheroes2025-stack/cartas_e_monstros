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

function App() {
  const [game]=useState(()=>new Game());
  const cameraRef=useRef<Camera|null>(null);
  const [revision,setRevision]=useState(0);
  const [collection,setCollection]=useState(false);
  const [bagOpen,setBagOpen]=useState(false);
  const [detailsUid,setDetailsUid]=useState<string|null>(null);
  const [enemyDetails,setEnemyDetails]=useState(false);
  const [quality,setQualityState]=useState<'high'|'low'>(()=>{
    const stored=localStorage.getItem('cartas-quality');
    if(stored==='high'||stored==='low')return stored;
    return window.matchMedia('(pointer: coarse)').matches||window.innerWidth<700?'low':'high';
  });
  const orientationPaused=usePortraitLock();
  const pwa=usePwaInstall();
  const overlayOpen=collection||detailsUid!==null||bagOpen||enemyDetails;
  const toggleBag=useCallback(()=>setBagOpen(value=>!value),[]);
  const controls=useControls(game,orientationPaused||overlayOpen,toggleBag);
  const closeDetails=useCallback(()=>setDetailsUid(null),[]);
  useEffect(()=>{
    game.onChange=()=>setRevision(value=>value+1);
    if (import.meta.env.DEV) (window as Window & {__cartasGame?:Game}).__cartasGame=game;
    return()=>{game.onChange=null;if (import.meta.env.DEV) delete (window as Window & {__cartasGame?:Game}).__cartasGame;};
  },[game]);
  const setQuality=(value:'high'|'low')=>{setQualityState(value);localStorage.setItem('cartas-quality',value);};
  const inGame=game.mode!=='title';
  const detailedMonster=detailsUid?game.save?.party.find(monster=>monster.uid===detailsUid)??
    game.save?.collection.find(monster=>monster.uid===detailsUid):undefined;
  return <main className="game-app">
    <div className="scene"><WorldScene game={game} quality={quality} orientationPaused={orientationPaused||overlayOpen} cameraRef={cameraRef}/></div>
    {game.mode==='title'?<StartMenu game={game} pwa={pwa}/>:null}
    {inGame&&game.mode!=='dialog'&&!game.battle?.finisher&&!game.battle?.captureSequence&&!(game.mode==='battle'&&(game.battle?.intro??0)>0)?<Hud game={game} revision={revision} onCollection={()=>setCollection(true)} onBag={()=>setBagOpen(true)} onCompanion={setDetailsUid}/>:null}
    {game.mode==='battle'&&game.battle?.intro===0?<BattleHud game={game} cameraRef={cameraRef} onAllyDetails={setDetailsUid} onEnemyDetails={()=>setEnemyDetails(true)}/>:null}
    {game.mode==='battle'&&game.battleMenu==='party'?<BattleMenuPanel game={game}/>:null}
    {bagOpen?<InventoryPanel game={game} onClose={()=>setBagOpen(false)} onCompanion={setDetailsUid}/>:null}
    {inGame&&!orientationPaused?<WorldInteraction game={game} cameraRef={cameraRef}/>:null}
    {game.mode==='pause'?<PausePanel game={game} quality={quality} setQuality={setQuality} pwa={pwa}/>:null}
    {collection?<CollectionPanel game={game} onClose={()=>setCollection(false)} onDetails={uid=>{setCollection(false);setDetailsUid(uid);}}/>:null}
    {detailedMonster?<CompanionDetails game={game} monster={detailedMonster} onClose={closeDetails}
      onCollection={()=>{setDetailsUid(null);setCollection(true);}}/>:null}
    {enemyDetails&&game.battle?<BattleInspection monster={game.battle.enemy} hp={game.battle.foe.hp} opponent={game.activeMonster??undefined} onClose={()=>setEnemyDetails(false)}/>:null}
    {!orientationPaused&&(game.mode==='explore'||(game.mode==='battle'&&game.battle?.intro===0&&!game.battle.finisher&&!game.battle.captureSequence&&!game.battleMenu))?<TouchControls game={game} controls={controls}/>:null}
    {orientationPaused?<RotateDevicePrompt/>:null}
    <PwaInstallHelp pwa={pwa}/>
  </main>;
}

createRoot(document.getElementById('app')!).render(<App/>);
