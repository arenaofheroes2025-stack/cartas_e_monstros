import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BATTLE_INTRO_SECONDS, Game } from '../game/game';
import { ELEMENT_COLOR, SPECIES } from '../game/content';
import { imageTexture } from './art';

export function BattleSummon({game}:{game:Game}) {
  const card=useRef<THREE.Mesh>(null);
  const halo=useRef<THREE.Mesh>(null);
  const color=game.activeMonster?ELEMENT_COLOR[SPECIES[game.activeMonster.species].element]:'#f4c680';
  const texture=useMemo(()=>game.activeMonster
    ?imageTexture(`/art/cards/${SPECIES[game.activeMonster.species].element}.png`):null,
    [game.activeMonster?.species]);
  useFrame(({camera,clock})=>{
    const battle=game.battle;
    if(!card.current||!halo.current||!battle)return;
    const time=BATTLE_INTRO_SECONDS-battle.intro;
    const flying=game.mode==='battle'&&battle.intro>1.05&&time>0.32;
    card.current.visible=flying;
    halo.current.visible=game.mode==='battle'&&battle.intro>0&&battle.intro<1.28;
    if(flying){
      const t=THREE.MathUtils.smoothstep(time,0.32,1.65);
      card.current.position.set(
        THREE.MathUtils.lerp(game.player.x,battle.ally.x,t),
        THREE.MathUtils.lerp(game.getGroundHeight(game.player.x,game.player.z),game.getGroundHeight(battle.ally.x,battle.ally.z),t)+1.1+Math.sin(Math.PI*t)*1.05,
        THREE.MathUtils.lerp(game.player.z,battle.ally.z,t));
      card.current.quaternion.copy(camera.quaternion);
      card.current.rotateZ(Math.sin(time*8)*0.13);
      card.current.scale.setScalar(1-0.22*t);
    }
    if(halo.current.visible){
      const burst=1-battle.intro/1.28;
      halo.current.position.set(battle.ally.x,game.getGroundHeight(battle.ally.x,battle.ally.z)+0.2,battle.ally.z);
      halo.current.scale.setScalar(0.45+burst*2.1);
      (halo.current.material as THREE.MeshBasicMaterial).opacity=(1-burst)*0.5*(0.85+0.15*Math.sin(clock.elapsedTime*19));
    }
  });
  if(!texture)return null;
  return <>
    <mesh ref={card} visible={false} renderOrder={12}>
      <planeGeometry args={[0.65,0.92]}/>
      <meshBasicMaterial map={texture} transparent alphaTest={0.08} side={THREE.DoubleSide} depthWrite={false} toneMapped={false}/>
    </mesh>
    <mesh ref={halo} rotation={[-Math.PI/2,0,0]} visible={false}>
      <ringGeometry args={[0.74,1,48]}/>
      <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/>
    </mesh>
  </>;
}
