import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BATTLE_RECALL_END_SECONDS, Game } from '../game/game';
import { ELEMENT_COLOR } from '../game/content';
import { imageTexture } from './art';

const XP_MOTES = 9;

export function BattleFinish({game}:{game:Game}) {
  const enemyCard=useRef<THREE.Mesh>(null);
  const allyCard=useRef<THREE.Mesh>(null);
  const seal=useRef<THREE.Mesh>(null);
  const ring=useRef<THREE.Mesh>(null);
  const light=useRef<THREE.PointLight>(null);
  const motes=useRef<Array<THREE.Mesh|null>>([]);
  const finish=game.battle?.finisher;
  const enemyElement=finish?.enemyElement??'fogo';
  const allyElement=finish?.allyElement??'fogo';
  const enemyTexture=useMemo(()=>imageTexture(`/art/cards/${enemyElement}.png`),[enemyElement]);
  const allyTexture=useMemo(()=>imageTexture(`/art/cards/${allyElement}.png`),[allyElement]);
  const sealTexture=useMemo(()=>imageTexture('/art/effects/capture.png'),[]);
  const enemyColor=ELEMENT_COLOR[enemyElement];
  const allyColor=ELEMENT_COLOR[allyElement];

  useFrame(({camera,clock})=>{
    const state=game.battle?.finisher;
    if(!state||!enemyCard.current||!allyCard.current||!seal.current||!ring.current||!light.current)return;
    const t=state.elapsed;
    const foeY=game.getGroundHeight(state.foe.x,state.foe.z);
    const allyY=game.getGroundHeight(state.ally.x,state.ally.z);
    const heroY=game.getGroundHeight(state.hero.x,state.hero.z);
    const enemyMorph=THREE.MathUtils.smoothstep(t,0.22,0.68);
    const enemyFade=1-THREE.MathUtils.smoothstep(t,0.72,1.05);
    const allyMorph=THREE.MathUtils.smoothstep(t,1.32,1.72);
    const returnFlight=THREE.MathUtils.smoothstep(t,1.62,2.34);
    const allyFade=1-THREE.MathUtils.smoothstep(t,2.3,BATTLE_RECALL_END_SECONDS);
    const towardAllyX=state.ally.x-state.hero.x;
    const towardAllyZ=state.ally.z-state.hero.z;
    const towardAllyLength=Math.hypot(towardAllyX,towardAllyZ)||1;
    const handX=state.hero.x+towardAllyX/towardAllyLength*0.57;
    const handZ=state.hero.z+towardAllyZ/towardAllyLength*0.57;

    // The defeated enemy's card disappears at the defeat point. It is not collected.
    enemyCard.current.visible=t>=0.29&&t<1.05;
    if(enemyCard.current.visible){
      enemyCard.current.position.set(state.foe.x,foeY+1.05+enemyMorph*0.12,state.foe.z);
      enemyCard.current.quaternion.copy(camera.quaternion);
      enemyCard.current.rotateZ(Math.sin(t*17)*0.1);
      enemyCard.current.scale.setScalar((0.18+0.82*enemyMorph)*Math.max(0.02,enemyFade));
      (enemyCard.current.material as THREE.MeshBasicMaterial).opacity=enemyFade;
    }

    // Only the player's companion becomes the card that flies back to the hero.
    allyCard.current.visible=t>=1.48&&t<BATTLE_RECALL_END_SECONDS;
    if(allyCard.current.visible){
      allyCard.current.position.set(
        THREE.MathUtils.lerp(state.ally.x,handX,returnFlight),
        THREE.MathUtils.lerp(allyY+1.05,heroY+1.36,returnFlight)+Math.sin(Math.PI*returnFlight)*0.95,
        THREE.MathUtils.lerp(state.ally.z,handZ,returnFlight));
      allyCard.current.quaternion.copy(camera.quaternion);
      allyCard.current.rotateZ((1-returnFlight)*Math.sin(t*16)*0.13);
      allyCard.current.scale.setScalar((0.18+0.82*allyMorph)*Math.max(0.02,allyFade));
      (allyCard.current.material as THREE.MeshBasicMaterial).opacity=allyFade;
    }

    const recalling=t>=1.32;
    const phaseMorph=recalling?allyMorph:enemyMorph;
    const phasePoint=recalling?state.ally:state.foe;
    const phaseY=recalling?allyY:foeY;
    const phaseColor=recalling?allyColor:enemyColor;
    seal.current.visible=t<0.75||(t>=1.32&&t<1.8);
    if(seal.current.visible){
      seal.current.position.set(phasePoint.x,phaseY+1.05,phasePoint.z);
      seal.current.quaternion.copy(camera.quaternion);
      seal.current.scale.setScalar(0.7+1.65*phaseMorph);
      const material=seal.current.material as THREE.MeshBasicMaterial;
      material.color.set(phaseColor);
      material.opacity=(1-phaseMorph)*0.9;
    }
    ring.current.visible=t<0.82||(t>=1.32&&t<1.86);
    if(ring.current.visible){
      ring.current.position.set(phasePoint.x,phaseY+0.17,phasePoint.z);
      ring.current.scale.setScalar(0.55+phaseMorph*1.55);
      const material=ring.current.material as THREE.MeshBasicMaterial;
      material.color.set(phaseColor);
      material.opacity=(1-phaseMorph)*0.78;
    }
    const activeCard=recalling?allyCard.current:enemyCard.current;
    light.current.position.set(activeCard.visible?activeCard.position.x:phasePoint.x,
      activeCard.visible?activeCard.position.y:phaseY+1.05,
      activeCard.visible?activeCard.position.z:phasePoint.z);
    light.current.color.set(phaseColor);
    light.current.intensity=t<1.05?1.4*enemyFade:t>=1.32?1.45*allyFade:0;

    motes.current.forEach((mesh,i)=>{
      if(!mesh)return;
      const start=0.74+i*0.05;
      const progress=THREE.MathUtils.smoothstep(t,start,start+0.7);
      mesh.visible=t>=start&&t<start+0.85;
      if(!mesh.visible)return;
      const sideways=Math.sin(i*2.4)*0.23*Math.sin(Math.PI*progress);
      mesh.position.set(
        THREE.MathUtils.lerp(state.foe.x,state.ally.x,progress)+sideways,
        THREE.MathUtils.lerp(foeY+1.18,allyY+1.22,progress)+Math.sin(Math.PI*progress)*(0.65+i%3*0.12),
        THREE.MathUtils.lerp(state.foe.z,state.ally.z,progress)-sideways);
      mesh.quaternion.copy(camera.quaternion);
      mesh.rotation.z=clock.elapsedTime*2+i;
      mesh.scale.setScalar((0.8+0.25*Math.sin(t*15+i))*Math.max(0.08,1-THREE.MathUtils.smoothstep(progress,0.82,1)));
      (mesh.material as THREE.MeshBasicMaterial).opacity=Math.min(1,(t-start)*7)*(1-THREE.MathUtils.smoothstep(progress,0.8,1));
    });
  });

  if(!finish)return null;
  return <group>
    <mesh ref={seal} visible={false} renderOrder={11}>
      <planeGeometry args={[1.7,1.7]}/>
      <meshBasicMaterial map={sealTexture} color={enemyColor} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/>
    </mesh>
    <mesh ref={ring} rotation={[-Math.PI/2,0,0]} visible={false} renderOrder={10}>
      <ringGeometry args={[0.72,1,48]}/>
      <meshBasicMaterial color={enemyColor} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/>
    </mesh>
    <mesh ref={enemyCard} visible={false} renderOrder={13}>
      <planeGeometry args={[0.65,0.92]}/>
      <meshBasicMaterial map={enemyTexture} transparent alphaTest={0.06} depthTest={false} depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/>
    </mesh>
    <mesh ref={allyCard} visible={false} renderOrder={13}>
      <planeGeometry args={[0.65,0.92]}/>
      <meshBasicMaterial map={allyTexture} transparent alphaTest={0.06} depthTest={false} depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/>
    </mesh>
    {Array.from({length:XP_MOTES},(_,i)=><mesh key={i} ref={mesh=>{motes.current[i]=mesh;}} visible={false} renderOrder={12}>
      <octahedronGeometry args={[0.09,0]}/>
      <meshBasicMaterial color="#eeb653" transparent depthWrite={false} depthTest={false} toneMapped={false}/>
    </mesh>)}
    <pointLight ref={light} color={enemyColor} intensity={0} distance={4.5} decay={2}/>
  </group>;
}
