import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BATTLE_INTRO_SECONDS, Game } from '../game/game';
import { generateWorld, type WorldData } from '../game/world';
import { TerrainChunks } from './TerrainChunks';
import { Props } from './Props';
import { Creatures } from './Creatures';
import { BattleArena } from './BattleArena';
import { BattleSummon } from './BattleSummon';
import { BattleFinish } from './BattleFinish';
import { BattleCapture } from './BattleCapture';
import { CardPickups } from './CardPickups';
import { ItemPickups } from './ItemPickups';
import { Lighting } from './Lighting';
import { Effects } from './Effects';
import { StatusAuras } from './StatusAuras';
import { CAMERA_OFFSET } from './camera';
import { CloudShadows } from './CloudShadows';
import { GroundShadows } from './GroundShadows';
import { WaterSurface } from './WaterSurface';
import { cameraZoom, captureCameraZoom, perspectiveFovForZoom, victoryCameraZoom } from './cameraZoom';
import { RenderResolution } from './RenderResolution';
import { preferredRenderDpr } from './resolutionBudget';
import { NearbyTextureWarmup } from './NearbyTextureWarmup';
import { AmbientBirds } from './AmbientBirds';
import { DepthOfField } from './DepthOfField';

function SimulationLoop({game,orientationPaused}:{game:Game;orientationPaused:boolean}) {
  const accumulated=useRef(0);
  const lastActiveFrame=useRef(performance.now());
  useLayoutEffect(()=>{lastActiveFrame.current=performance.now();},
    [orientationPaused,game.mode,game.battleMenu,game.shopOpen]);
  useFrame((_,delta)=>{
    const now=performance.now();
    const clockDelta=(now-lastActiveFrame.current)/1000;
    lastActiveFrame.current=now;
    if(orientationPaused){accumulated.current=0;return;}
    // Count active wall time, independent of skipped physics steps or paused menus.
    game.advanceClock(clockDelta);
    accumulated.current=Math.min(accumulated.current+delta,0.16);
    let steps=0;
    while(accumulated.current>=1/60&&steps++<8) {
      game.update(1/60,false);
      accumulated.current-=1/60;
    }
  });
  return null;
}

function CameraRig({game,cameraRef}:{game:Game;cameraRef:RefObject<THREE.Camera|null>}) {
  const {camera,size,invalidate}=useThree();
  useEffect(()=>{cameraRef.current=camera;return()=>{cameraRef.current=null;};},[camera,cameraRef]);
  useEffect(()=>{if(game.mode==='dialog')invalidate();},[game.mode,invalidate]);
  const look=useMemo(()=>new THREE.Vector3(),[]);
  const target=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((_,delta)=>{
    const player=game.player;
    const battle=game.battle;
    const h=game.getGroundHeight(player.x,player.z)+game.playerVisualLift*0.24;
    if(battle?.captureSequence?.success){
      const capture=battle.captureSequence;
      const recenter=THREE.MathUtils.smoothstep(capture.elapsed,1.45,3.15);
      target.set(
        THREE.MathUtils.lerp(capture.foe.x,capture.hero.x,recenter),
        THREE.MathUtils.lerp(game.getGroundHeight(capture.foe.x,capture.foe.z),h,recenter)+0.3*(1-recenter),
        THREE.MathUtils.lerp(capture.foe.z,capture.hero.z,recenter));
    } else if(battle?.finisher){
      const finish=battle.finisher;
      const recenter=THREE.MathUtils.smoothstep(finish.elapsed,0.72,2.22);
      target.set(
        THREE.MathUtils.lerp(finish.foe.x,finish.hero.x,recenter),
        THREE.MathUtils.lerp(game.getGroundHeight(finish.foe.x,finish.foe.z),h,recenter)+0.4*(1-recenter),
        THREE.MathUtils.lerp(finish.foe.z,finish.hero.z,recenter));
    } else if(battle){
      const mobileLandscape=size.width<1000&&size.height<=500&&size.width>size.height;
      const playerWeight=mobileLandscape?0.45:0.25;
      const monsterWeight=mobileLandscape?0.15:0.2;
      const centerWeight=1-playerWeight-monsterWeight;
      const monsterX=(battle.ally.x+battle.foe.x)*0.5;
      const monsterZ=(battle.ally.z+battle.foe.z)*0.5;
      target.set(battle.center.x*centerWeight+player.x*playerWeight+monsterX*monsterWeight,
        game.getGroundHeight(battle.center.x,battle.center.z)*centerWeight+h*playerWeight+
        (game.getGroundHeight(battle.ally.x,battle.ally.z)+game.getGroundHeight(battle.foe.x,battle.foe.z))*0.5*monsterWeight,
        battle.center.z*centerWeight+player.z*playerWeight+monsterZ*monsterWeight);
    }
    else target.set(player.x,h,player.z);
    const baseZoom=cameraZoom(size.width,size.height,!!battle);
    const introProgress=battle?1-battle.intro/BATTLE_INTRO_SECONDS:0;
    const introPush=battle&&battle.intro>0?1+0.035*Math.sin(Math.PI*introProgress):1;
    const finish=battle?.finisher;
    const capture=battle?.captureSequence;
    const finishZoom=finish?victoryCameraZoom(size.width,size.height,finish.elapsed):baseZoom;
    let interactionPush=1;
    if(!battle){
      if(game.mode==='dialog')interactionPush=1.22;
      else if(game.mode==='explore'&&game.playerPickupTime>0)interactionPush=1.18;
    }
    const zoom=capture?.success?captureCameraZoom(size.width,size.height,capture.elapsed):finish?finishZoom:baseZoom*introPush*interactionPush;
    const desiredFov=perspectiveFovForZoom(size.height,zoom,CAMERA_OFFSET.length());
    if(camera instanceof THREE.PerspectiveCamera&&Math.abs(camera.fov-desiredFov)>0.01){
      const zoomDamping=finish||capture?.success?6.5:battle?3.6:interactionPush>1?8:5.2;
      camera.fov=THREE.MathUtils.damp(camera.fov,desiredFov,zoomDamping,delta);
      camera.updateProjectionMatrix();
    }
    const desired=look.copy(target).add(CAMERA_OFFSET);
    const positionDelta=camera.position.distanceToSquared(desired);
    camera.position.lerp(desired,1-Math.exp(-(finish||capture?.success?8.5:battle?4.2:6.2)*delta));
    // Keep the projection angle fixed while the camera glides toward the arena.
    camera.lookAt(look.copy(camera.position).sub(CAMERA_OFFSET));
    if(game.mode==='dialog'&&(camera instanceof THREE.PerspectiveCamera&&Math.abs(camera.fov-desiredFov)>0.01||positionDelta>0.0004))invalidate();
  });
  return null;
}

function SceneContent({game,world,quality,orientationPaused,cameraRef,revision}:{game:Game;world:WorldData;quality:'high'|'low';orientationPaused:boolean;cameraRef:RefObject<THREE.Camera|null>;revision:number}) {
  const {scene,gl}=useThree();
  useEffect(()=>{
    scene.fog=new THREE.Fog('#9cccd4',23,60);
    gl.shadowMap.enabled=true;
    gl.shadowMap.type=THREE.PCFSoftShadowMap;
    gl.shadowMap.autoUpdate=false;
    gl.shadowMap.needsUpdate=true;
    return()=>{scene.fog=null;gl.shadowMap.autoUpdate=true;};
  },[scene,gl]);
  return <>
    <RenderResolution quality={quality}/>
    <DepthOfField game={game} quality={quality}/>
    <SimulationLoop game={game} orientationPaused={orientationPaused}/>
    <CameraRig game={game} cameraRef={cameraRef}/>
    <CloudShadows game={game} world={world}/>
    <Lighting game={game} quality={quality}/>
    <NearbyTextureWarmup game={game} world={world} revision={revision}/>
    <group onPointerDown={event=>{
      if(game.mode==='battle') {
        event.stopPropagation();
        game.orderMove({x:event.point.x,z:event.point.z});
      }
    }}>
      <TerrainChunks world={world} revision={revision}/>
      <WaterSurface world={world} game={game} revision={revision}/>
      <GroundShadows game={game} world={world} revision={revision}/>
      <Props world={world} game={game} revision={revision}/>
      {game.world?<><AmbientBirds game={game} world={world}/><CardPickups game={game}/><ItemPickups game={game}/><Creatures game={game}/><BattleArena game={game}/><BattleSummon game={game}/><BattleFinish game={game}/><BattleCapture game={game}/><StatusAuras game={game}/><Effects game={game}/></>:null}
    </group>
  </>;
}

export function WorldScene({game,quality,orientationPaused=false,cameraRef}:{game:Game;quality:'high'|'low';orientationPaused?:boolean;cameraRef:RefObject<THREE.Camera|null>}) {
  const preview=useMemo(()=>generateWorld(40732),[]);
  const world=game.world||preview;
  useEffect(()=>{game.streamQuality=quality;game.world?.updateStreaming(game.player,game.move,quality,true);},[game,quality,game.world]);
  const framePaused=orientationPaused||game.mode==='pause'||game.mode==='dialog';
  return <Canvas shadows="soft" frameloop={framePaused?'demand':'always'} gl={{antialias:false,powerPreference:'high-performance'}}
    dpr={preferredRenderDpr(window.innerWidth,window.innerHeight,window.devicePixelRatio,quality)}
    camera={{position:[61,22,61],fov:perspectiveFovForZoom(window.innerHeight,cameraZoom(window.innerWidth,window.innerHeight,false),CAMERA_OFFSET.length()),near:0.1,far:150}} fallback={<div className="webgl-fallback">Este dispositivo não oferece WebGL. Tente outro navegador.</div>}>
    <SceneContent game={game} world={world} quality={quality} orientationPaused={orientationPaused} cameraRef={cameraRef} revision={game.world?.revision??0}/>
  </Canvas>;
}
