import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { type CardCache } from '../game/world';
import { imageTexture } from './art';
import { makeProjectedShadowGeometry, projectedShadowMaterial, writeProjectedShadow } from './ProjectedShadows';

const CARD_SIZE=0.82;
const HOVER_HEIGHT=0.9;
const HOVER_AMPLITUDE=0.18;
const HOVER_SPEED=2;

function hoverHeight(elapsed:number,phase:number):number {
  return HOVER_HEIGHT+Math.sin(elapsed*HOVER_SPEED+phase)*HOVER_AMPLITUDE;
}

function Card({game,cache}:{game:Game;cache:CardCache}) {
  const group=useRef<THREE.Group>(null);
  const shadow=useRef<THREE.Mesh>(null);
  const lastShadow=useRef({elapsed:NaN,ground:NaN});
  const texture=imageTexture(`/art/cards/${cache.element}.png`);
  const x=cache.x+0.5,z=cache.z+0.5;
  const phase=(cache.x*0.83+cache.z*1.37)%(Math.PI*2);
  const shadowGeometry=useMemo(()=>makeProjectedShadowGeometry(game.world!,[{
    x,z,y:game.getGroundHeight(x,z)+0.1
  }],CARD_SIZE,CARD_SIZE),[game.world,x,z]);
  const shadowMaterial=useMemo(()=>{
    const material=projectedShadowMaterial(texture);
    material.uniforms.uAlphaCut.value=0.18;
    material.uniforms.uOpacity={value:0.7};
    return material;
  },[texture]);
  useEffect(()=>()=>{shadowGeometry.dispose();shadowMaterial.dispose();},[shadowGeometry,shadowMaterial]);
  useFrame(()=>{
    if(!group.current||!shadow.current||!game.world)return;
    const visible=!!game.save&&!game.save.openedCaches.includes(cache.id)&&
      Math.hypot(x-game.player.x,z-game.player.z)<19;
    group.current.visible=shadow.current.visible=visible;
    if(!visible)return;
    const ground=game.getGroundHeight(x,z)+0.1;
    const elapsed=game.save?.elapsed??0;
    const lift=hoverHeight(elapsed,phase);
    group.current.position.y=ground+lift;
    const daylight=THREE.MathUtils.clamp((game.hour-5)/2.5,0,1)*
      THREE.MathUtils.clamp((20-game.hour)/2.5,0,1);
    shadowMaterial.uniforms.uOpacity.value=0.14+daylight*0.56;
    if(lastShadow.current.elapsed!==elapsed||lastShadow.current.ground!==ground){
      // Project the card's alpha onto the terrain, including lower adjacent tiles.
      writeProjectedShadow(shadowGeometry,game.world,{x,z,y:ground},
        CARD_SIZE,CARD_SIZE,0,lift-CARD_SIZE/2);
      lastShadow.current={elapsed,ground};
    }
  });
  return <>
    <mesh ref={shadow} geometry={shadowGeometry} material={shadowMaterial} renderOrder={3} frustumCulled={false}/>
    <group ref={group} position={[x,0,z]}>
      <mesh rotation={[0,Math.PI/4,0]}>
        <planeGeometry args={[CARD_SIZE,CARD_SIZE]}/>
        <meshBasicMaterial map={texture} transparent alphaTest={0.1} side={THREE.DoubleSide}/>
      </mesh>
    </group>
  </>;
}

export function CardPickups({game}:{game:Game}) {
  return <group>{game.world?.caches.map(cache=><Card key={cache.id} game={game} cache={cache}/>)}</group>;
}
