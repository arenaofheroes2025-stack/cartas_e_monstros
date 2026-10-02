import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BATTLE_INTRO_SECONDS, Game } from '../game/game';
import { ELEMENT_COLOR, SPECIES } from '../game/content';
import { imageTexture } from './art';
import { summonCardFlightProgress } from './playerAnimations';

export function BattleSummon({game}:{game:Game}) {
  const halo=useRef<THREE.Mesh>(null);
  const card=useRef<THREE.Mesh>(null);
  const element=game.activeMonster?SPECIES[game.activeMonster.species].element:'fogo';
  const color=ELEMENT_COLOR[element];
  const cardTexture=useMemo(()=>imageTexture(`/art/cards/${element}.png`),[element]);
  useFrame(({camera,clock})=>{
    const battle=game.battle;
    if(!halo.current||!card.current)return;
    if(!battle){halo.current.visible=false;card.current.visible=false;return;}
    halo.current.visible=game.mode==='battle'&&battle.intro>0&&battle.intro<1.28;
    if(halo.current.visible){
      const burst=1-battle.intro/1.28;
      halo.current.position.set(battle.ally.x,game.getGroundHeight(battle.ally.x,battle.ally.z)+0.2,battle.ally.z);
      halo.current.scale.setScalar(0.45+burst*2.1);
      (halo.current.material as THREE.MeshBasicMaterial).opacity=(1-burst)*0.5*(0.85+0.15*Math.sin(clock.elapsedTime*19));
    }
    const progress=game.mode==='battle'&&battle.intro>0
      ?summonCardFlightProgress(BATTLE_INTRO_SECONDS-battle.intro):null;
    card.current.visible=progress!==null;
    if(progress!==null){
      const hero=game.player,ally=battle.ally;
      const dx=ally.x-hero.x,dz=ally.z-hero.z;
      const length=Math.hypot(dx,dz)||1;
      const fromX=hero.x+dx/length*0.47,fromZ=hero.z+dz/length*0.47;
      const flight=THREE.MathUtils.smoothstep(progress,0,1);
      card.current.position.set(
        THREE.MathUtils.lerp(fromX,ally.x,flight),
        THREE.MathUtils.lerp(game.getGroundHeight(hero.x,hero.z)+1.72,
          game.getGroundHeight(ally.x,ally.z)+1.08,flight)+Math.sin(Math.PI*flight)*0.68,
        THREE.MathUtils.lerp(fromZ,ally.z,flight));
      card.current.quaternion.copy(camera.quaternion);
      card.current.rotateZ((1-flight)*Math.sin(clock.elapsedTime*18)*0.12);
      const fade=1-THREE.MathUtils.smoothstep(progress,0.88,1);
      card.current.scale.setScalar(Math.max(0.02,fade));
      (card.current.material as THREE.MeshBasicMaterial).opacity=fade;
    }
  });
  return <>
    <mesh ref={card} visible={false} renderOrder={14}>
      <planeGeometry args={[0.58,0.82]}/>
      <meshBasicMaterial map={cardTexture} transparent alphaTest={0.06} depthTest={false} depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/>
    </mesh>
    <mesh ref={halo} rotation={[-Math.PI/2,0,0]} visible={false}>
      <ringGeometry args={[0.74,1,48]}/>
      <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/>
    </mesh>
  </>;
}
