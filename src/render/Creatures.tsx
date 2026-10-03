import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BATTLE_COMMAND_POSE_SECONDS, BATTLE_INTRO_SECONDS, BATTLE_ITEM_THROW_SECONDS, BATTLE_RECALL_END_SECONDS, BATTLE_SUMMON_POSE_SECONDS, CAPTURE_RECALL_END_SECONDS, Game, PLAYER_PICKUP_SECONDS, type BattleActor, type WalkingNpcActor, type WildActor } from '../game/game';
import { SPECIES } from '../game/content';
import { staticNpcAt } from '../game/npcs';
import { monsterTexture, personTexture, playerTexture } from './art';
import { playerAnimationFrame, playerIntroCardPose, playerJumpLandingFrame, playerVictoryCardPose, type PlayerAnimation } from './playerAnimations';
import { SPRITE_FACING, SPRITE_UP } from './camera';
import { withCloudShadows } from './CloudShadows';
import { withSpriteDepth } from './spriteDepth';
import { facingForDirection, facingToward } from './facing';
import { makeProjectedShadowGeometry, projectedShadowMaterial, writeProjectedShadow } from './ProjectedShadows';
import { calibratedCasterHeight, shadowGroupOffset } from './shadowCalibration';
import { ASSET_POSITION_CALIBRATION, groundOnlyOverlay, groundingDepthBias, markSpriteStencil } from './assetPositionCalibration';

interface SpriteState { x:number; z:number; visible:boolean; texture:THREE.Texture; flash?:number; scale?:number; facing?:1|-1; bob?:number; lift?:number; opacity?:number }
const spriteWidth = 1.42;
const spriteHeight = spriteWidth;
const characterShadowOffset=shadowGroupOffset('personagens');

function PixelActor({game,get,canFlash=false}:{game:Game;get:(time:number)=>SpriteState;canFlash?:boolean}) {
  const body=useRef<THREE.Mesh>(null);
  const overlay=useRef<THREE.Mesh>(null);
  const silhouette=useRef<THREE.Mesh>(null);
  const flash=useRef<THREE.Mesh>(null);
  const lastFacing=useRef<1|-1>(1);
  const material=useMemo(()=>{const art=personTexture('player');return markSpriteStencil(withSpriteDepth(withCloudShadows(new THREE.MeshLambertMaterial({map:art,emissiveMap:art,emissive:'#ffffff',emissiveIntensity:0.28,transparent:true,alphaTest:0.45,side:THREE.DoubleSide,depthWrite:true})),0,-spriteHeight*0.5));},[]);
  const overlayMaterial=useMemo(()=>{
    if(!ASSET_POSITION_CALIBRATION.frontOfTerrain.personagens)return null;
    const art=personTexture('player');
    return groundOnlyOverlay(withSpriteDepth(withCloudShadows(new THREE.MeshLambertMaterial({
      map:art,emissiveMap:art,emissive:'#ffffff',emissiveIntensity:0.28,
      transparent:true,alphaTest:0.45,side:THREE.DoubleSide
    })),groundingDepthBias(ASSET_POSITION_CALIBRATION.heightY.personagens),-spriteHeight*0.5));
  },[]);
  useEffect(()=>()=>{material.dispose();overlayMaterial?.dispose();},[material,overlayMaterial]);
  const shadowGeometry=useMemo(()=>makeProjectedShadowGeometry(game.world!,
    [{x:characterShadowOffset.x,z:characterShadowOffset.z,y:0.1}],spriteWidth,
    calibratedCasterHeight(spriteHeight,'personagens')),[game.world]);
  const shadowMaterial=useMemo(()=>projectedShadowMaterial(personTexture('player')),[]);
  shadowMaterial.uniforms.uAlphaCut.value=0.45;
  useEffect(()=>()=>{shadowGeometry.dispose();shadowMaterial.dispose();},[shadowGeometry,shadowMaterial]);
  const flashMaterial=useMemo(()=>canFlash?new THREE.ShaderMaterial({
    uniforms:{uTexture:{value:personTexture('player')},uRepeat:{value:new THREE.Vector2(1,1)},uOffset:{value:new THREE.Vector2()},uOpacity:{value:0}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv;uniform sampler2D uTexture;uniform vec2 uRepeat;uniform vec2 uOffset;uniform float uOpacity;void main(){float a=texture2D(uTexture,vUv*uRepeat+uOffset).a;if(a<0.4)discard;gl_FragColor=vec4(1.0,1.0,1.0,a*uOpacity);}',
    transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide
  }):null,[canFlash]);
  useFrame(({clock})=>{
    if(!body.current||!silhouette.current||!game.world)return;
    const state=get(clock.elapsedTime);
    body.current.visible=silhouette.current.visible=state.visible;
    if(overlay.current)overlay.current.visible=state.visible;
    if(!state.visible){if(flash.current)flash.current.visible=false;return;}
    const h=game.getGroundHeight(state.x,state.z)+0.1;
    const scale=state.scale||1;
    const footV=(state.texture.userData.footV as number|undefined)??0;
    body.current.position.set(state.x,h+ASSET_POSITION_CALIBRATION.heightY.personagens+(state.bob||0)+(state.lift||0),state.z)
      .addScaledVector(SPRITE_UP,spriteHeight*scale*(0.5-footV));
    lastFacing.current=state.facing||lastFacing.current;
    body.current.scale.set(lastFacing.current*scale,scale,scale);
    body.current.quaternion.copy(SPRITE_FACING);
    if(overlay.current){
      overlay.current.position.copy(body.current.position);
      overlay.current.scale.copy(body.current.scale);
      overlay.current.quaternion.copy(body.current.quaternion);
    }
    writeProjectedShadow(shadowGeometry,game.world,
      {x:state.x+characterShadowOffset.x,z:state.z+characterShadowOffset.z,y:h},
      spriteWidth*scale,calibratedCasterHeight(spriteHeight*scale,'personagens'),
      0,(state.bob||0)+(state.lift||0),footV);
    shadowMaterial.uniforms.uTexture.value=state.texture;
    shadowMaterial.uniforms.uRepeat.value.copy(state.texture.repeat);
    shadowMaterial.uniforms.uOffset.value.copy(state.texture.offset);
    shadowMaterial.uniforms.uFlip.value=lastFacing.current<0?1:0;
    if(material.map!==state.texture){material.map=state.texture;material.emissiveMap=state.texture;material.needsUpdate=true;}
    material.opacity=state.opacity??1;
    if(overlayMaterial){
      if(overlayMaterial.map!==state.texture){
        overlayMaterial.map=state.texture;
        overlayMaterial.emissiveMap=state.texture;
        overlayMaterial.needsUpdate=true;
      }
      overlayMaterial.opacity=state.opacity??1;
    }
    if(flash.current&&flashMaterial){
      flash.current.visible=!!state.flash&&state.flash>0;
      if(flash.current.visible){
        flash.current.position.copy(body.current.position);
        flash.current.position.x+=0.018;flash.current.position.z+=0.018;
        flash.current.scale.copy(body.current.scale);
        flash.current.quaternion.copy(body.current.quaternion);
        flashMaterial.uniforms.uTexture.value=state.texture;
        flashMaterial.uniforms.uRepeat.value.copy(state.texture.repeat);
        flashMaterial.uniforms.uOffset.value.copy(state.texture.offset);
        flashMaterial.uniforms.uOpacity.value=0.45+0.55*Math.abs(Math.sin(state.flash!*30));
      }
    }
  });
  return <group>
    <mesh ref={silhouette} geometry={shadowGeometry} material={shadowMaterial} renderOrder={1} frustumCulled={false}/>
    <mesh ref={body} material={material} renderOrder={2}>
      <planeGeometry args={[spriteWidth,spriteHeight]} />
    </mesh>
    {overlayMaterial&&<mesh ref={overlay} material={overlayMaterial} renderOrder={7}>
      <planeGeometry args={[spriteWidth,spriteHeight]}/>
    </mesh>}
    {canFlash?<mesh ref={flash} material={flashMaterial!} visible={false} renderOrder={9}>
      <planeGeometry args={[spriteWidth,spriteHeight]}/>
    </mesh>:null}
  </group>;
}

function Player({game}:{game:Game}) {
  const playback=useRef<{animation:PlayerAnimation;start:number;cueSequence:number}>({animation:'idle',start:0,cueSequence:-1});
  return <PixelActor game={game} get={time=>{
    const jump=game.jump;
    const landing=game.jumpLandingTime>0;
    const moving=Math.hypot(game.move.x,game.move.z)>0.1 && (game.mode==='explore'||game.mode==='battle')&&game.playerPickupTime===0&&!landing;
    const target=game.battle?.foe;
    const capture=game.battle?.captureSequence;
    const battle=game.battle;
    const returningCard=(!!game.battle?.finisher&&game.battle.finisher.elapsed>=1.38&&game.battle.finisher.elapsed<BATTLE_RECALL_END_SECONDS)||
      (!!capture?.success&&capture.elapsed>=2.48&&capture.elapsed<CAPTURE_RECALL_END_SECONDS);
    const throwingCard=!!capture&&capture.elapsed<0.7;
    const commanding=(battle?.cue?.poseRemaining??0)>0;
    let animation:PlayerAnimation='idle';
    let elapsed:number|undefined;
    let frameOverride:number|undefined;
    if(battle?.defeat){animation='defeat';elapsed=battle.defeat.elapsed;}
    else if(battle?.finisher){
      const pose=playerVictoryCardPose(battle.finisher.elapsed);
      animation=pose.animation;frameOverride=pose.frame;
    }else if(jump){animation='jump';elapsed=jump.elapsed;}
    else if(landing){animation='jump';}
    else if(battle?.intro&&battle.intro>0){
      const pose=playerIntroCardPose(BATTLE_INTRO_SECONDS-battle.intro);
      animation=pose.animation;frameOverride=pose.frame;
    }else if((battle?.itemUseTime??0)>0){
      animation='itemThrow';elapsed=BATTLE_ITEM_THROW_SECONDS-battle!.itemUseTime;
    }else if((battle?.summonPoseTime??0)>0){
      animation='summon';elapsed=BATTLE_SUMMON_POSE_SECONDS-battle!.summonPoseTime;
    }else if(throwingCard){animation='command';elapsed=capture!.elapsed;}
    else if(game.mode==='explore'&&game.playerPickupTime>0){
      animation='pickup';elapsed=PLAYER_PICKUP_SECONDS-game.playerPickupTime;
    }
    else if(commanding){
      animation='command';elapsed=BATTLE_COMMAND_POSE_SECONDS-battle!.cue!.poseRemaining;
    }else if(game.mode==='dialog')animation='talk';
    else if(moving)animation='walk';
    const cueSequence=battle?.cue?.sequence??-1;
    if(playback.current.animation!==animation||animation==='command'&&playback.current.cueSequence!==cueSequence){
      playback.current={animation,start:time,cueSequence};
    }
    const frame=landing&&animation==='jump'&&!jump
      ?playerJumpLandingFrame(game.jumpLandingTime)
      :frameOverride??playerAnimationFrame(animation,elapsed??time-playback.current.start);
    return {
      x:game.player.x,z:game.player.z,visible:!!game.world&&game.mode!=='title',
      texture:playerTexture(animation,frame),
      facing:jump?facingToward(jump.from,jump.to):landing?undefined:animation==='itemThrow'&&battle?.itemThrowTarget?facingToward(game.player,battle.itemThrowTarget):battle?.finisher||battle?.intro&&battle.intro>0?facingToward(game.player,battle.ally):throwingCard&&capture?facingToward(game.player,capture.foe):returningCard&&game.battle?facingToward(game.player,game.battle.ally):commanding&&game.battle?facingToward(game.player,game.battle.ally):moving?facingForDirection(game.move.x,game.move.z):target?facingToward(game.player,target):undefined,
      lift:game.playerVisualLift
    };
  }}/>;
}

function Wild({game,wild}:{game:Game;wild:WildActor}) {
  return <PixelActor game={game} get={time=>{
    const visible=game.mode==='explore'&&game.isWildVisible(wild)&&Math.hypot(wild.x-game.player.x,wild.z-game.player.z)<19;
    const species=game.wildSpecies(wild);
    const walking=!!wild.target&&Math.hypot(wild.target.x-wild.x,wild.target.z-wild.z)>0.08;
    return {x:wild.x,z:wild.z,visible,texture:monsterTexture(species,walking?Math.floor(time*5)%2:0),scale:SPECIES[species].evolved?1.2:0.93,
      facing:walking?facingToward(wild,wild.target!):undefined};
  }}/>;
}

function BattleCreature({game,side}:{game:Game;side:'ally'|'foe'}) {
  return <PixelActor game={game} canFlash get={time=>{
    const battle=game.battle;
    if(!battle)return {x:0,z:0,visible:false,texture:monsterTexture('brasito')};
    const actor:BattleActor=side==='ally'?battle.ally:battle.foe;
    const species=side==='ally'?game.activeMonster!.species:battle.enemy.species;
    const finishing=side==='foe'?battle.finisher:undefined;
    const recalling=side==='ally'?battle.finisher:undefined;
    const capture=battle.captureSequence;
    const capturedFoe=side==='foe'?capture:undefined;
    const captureRecall=side==='ally'&&capture?.success?capture:undefined;
    const cheering=!!recalling&&recalling.elapsed>=1.05&&recalling.elapsed<1.36;
    const recallPose=!!recalling&&recalling.elapsed>=1.36;
    const frame=finishing||capturedFoe&&capturedFoe.elapsed>=0.68?4:cheering||recallPose||captureRecall&&captureRecall.elapsed>=2.35?5:actor.flash>0?4:actor.dodgeTime>0?3:
      (actor.itemPoseTime??0)>0||actor.windup>0?2:Math.floor(time*3)%2;
    const target=side==='ally'?battle.foe:battle.ally;
    const summon=side==='ally'&&battle.intro>0;
    const growth=summon?Math.max(0.08,Math.min(1,(1.05-battle.intro)/0.7)):1;
    const vanish=finishing?1-THREE.MathUtils.smoothstep(finishing.elapsed,0.22,0.68):recalling?1-THREE.MathUtils.smoothstep(recalling.elapsed,1.32,1.72):
      capturedFoe?(capturedFoe.success?1-THREE.MathUtils.smoothstep(capturedFoe.elapsed,0.74,1.18):
        1-THREE.MathUtils.smoothstep(capturedFoe.elapsed,0.74,1.16)+THREE.MathUtils.smoothstep(capturedFoe.elapsed,1.23,1.59)):
      captureRecall?1-THREE.MathUtils.smoothstep(captureRecall.elapsed,2.48,2.86):1;
    const cheerHop=cheering?Math.abs(Math.sin((recalling!.elapsed-1.05)*Math.PI*3))*0.16:0;
    const recoil=actor.flash>0&&actor.flash<=0.32?Math.sin((1-actor.flash/0.32)*Math.PI)*0.13:0;
    const awayX=actor.x-target.x,awayZ=actor.z-target.z,awayLength=Math.hypot(awayX,awayZ)||1;
    return {x:actor.x+awayX/awayLength*recoil,z:actor.z+awayZ/awayLength*recoil,visible:(game.mode==='battle'||game.mode==='pause')&&(!summon||battle.intro<=1.05)&&(!finishing||finishing.elapsed<0.68)&&(!recalling||recalling.elapsed<1.72)&&(!capturedFoe||vanish>0.02)&&(!captureRecall||captureRecall.elapsed<2.86),
      texture:monsterTexture(species,frame),flash:finishing&&finishing.elapsed<0.61?1:recalling&&recalling.elapsed>=1.32&&recalling.elapsed<1.67?0.8:capturedFoe&&capturedFoe.elapsed>=0.7&&capturedFoe.elapsed<1.2?0.9:captureRecall&&captureRecall.elapsed>=2.48&&captureRecall.elapsed<2.82?0.8:actor.flash,
      scale:(SPECIES[species].evolved?1.2:0.93)*growth*Math.max(0.06,vanish),facing:facingToward(actor,target,side==='ally'?1:-1),
      lift:summon?(1-growth)*0.75:finishing?THREE.MathUtils.smoothstep(finishing.elapsed,0.22,0.68)*0.35:recalling?THREE.MathUtils.smoothstep(recalling.elapsed,1.32,1.72)*0.28+cheerHop:
        capturedFoe?THREE.MathUtils.smoothstep(capturedFoe.elapsed,0.74,1.18)*0.32*(capturedFoe.success?1:1-THREE.MathUtils.smoothstep(capturedFoe.elapsed,1.23,1.59)):
        captureRecall?THREE.MathUtils.smoothstep(captureRecall.elapsed,2.48,2.86)*0.28:0};
  }}/>;
}

function Npc({game,x,z,role}:{game:Game;x:number;z:number;role:'artisan'|'healer'|'keeper'|'guardian'}) {
  return <PixelActor game={game} get={()=>({x,z,visible:game.mode!=='title'&&Math.hypot(x-game.player.x,z-game.player.z)<20,texture:personTexture(role),scale:0.98})}/>;
}

function WalkingNpc({game,npc}:{game:Game;npc:WalkingNpcActor}) {
  return <PixelActor game={game} get={()=>{
    const moving=!!npc.target&&Math.hypot(npc.target.x-npc.x,npc.target.z-npc.z)>0.06;
    const phase=Math.floor((game.save?.elapsed||0)*5)%4;
    return {x:npc.x,z:npc.z,visible:game.mode!=='title'&&Math.hypot(npc.x-game.player.x,npc.z-game.player.z)<20,
      texture:personTexture(npc.role,moving?[0,1,0,2][phase]:0),scale:0.98,
      facing:moving?facingToward(npc,npc.target!):undefined,
      bob:moving?Math.abs(Math.sin((game.save?.elapsed||0)*Math.PI*5))*0.045:0};
  }}/>;
}

export function Creatures({game}:{game:Game}) {
  const world=game.world;
  if(!world)return null;
  return <group>
    <Player game={game}/>
    {game.wildActors.map(wild=><Wild key={wild.id} game={game} wild={wild}/>)}
    {world.places.map(place=><Npc key={place.id} game={game} {...staticNpcAt(place)}/>)}
    {game.walkingNpcs.map(npc=><WalkingNpc key={npc.id} game={game} npc={npc}/>)}
    {game.battle?<><BattleCreature game={game} side="ally"/><BattleCreature game={game} side="foe"/></>:null}
  </group>;
}
