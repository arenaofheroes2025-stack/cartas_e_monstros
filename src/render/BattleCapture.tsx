import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CAPTURE_RECALL_END_SECONDS, Game } from '../game/game';
import { ELEMENT_COLOR, SPECIES } from '../game/content';
import { imageTexture } from './art';

function smooth(value:number,start:number,end:number):number {
  return THREE.MathUtils.smoothstep(value,start,end);
}

export function BattleCapture({game}:{game:Game}) {
  const thrown=useRef<THREE.Mesh>(null);
  const allyCard=useRef<THREE.Mesh>(null);
  const seal=useRef<THREE.Mesh>(null);
  const ring=useRef<THREE.Mesh>(null);
  const light=useRef<THREE.PointLight>(null);
  const sequence=game.battle?.captureSequence;
  const element=sequence?.element??'fogo';
  const allyElement=game.activeMonster?SPECIES[game.activeMonster.species].element:'fogo';
  const cardTexture=useMemo(()=>imageTexture(`/art/cards/${element}.png`),[element]);
  const allyTexture=useMemo(()=>imageTexture(`/art/cards/${allyElement}.png`),[allyElement]);
  const sealTexture=useMemo(()=>imageTexture('/art/effects/capture.png'),[]);
  useFrame(({camera,clock})=>{
    const capture=game.battle?.captureSequence;
    if(!capture||!thrown.current||!allyCard.current||!seal.current||!ring.current||!light.current)return;
    const t=capture.elapsed;
    const heroY=game.getGroundHeight(capture.hero.x,capture.hero.z);
    const foeY=game.getGroundHeight(capture.foe.x,capture.foe.z);
    const allyY=game.getGroundHeight(capture.ally.x,capture.ally.z);
    const toFoeX=capture.foe.x-capture.hero.x,toFoeZ=capture.foe.z-capture.hero.z;
    const foeDistance=Math.hypot(toFoeX,toFoeZ)||1;
    const hand={x:capture.hero.x+toFoeX/foeDistance*0.5,z:capture.hero.z+toFoeZ/foeDistance*0.5,y:heroY+1.3};
    const outward=smooth(t,0.05,0.68);
    const returning=smooth(t,1.22,1.86);
    const inFlight=t<0.68||(capture.success&&t>=1.18&&t<1.92);
    thrown.current.visible=t<1.92&&(capture.success||t<1.25);
    if(thrown.current.visible){
      const goingBack=capture.success&&t>=1.18;
      const amount=goingBack?returning:outward;
      const from=goingBack?capture.foe:hand;
      const to=goingBack?hand:capture.foe;
      const fromY=goingBack?foeY+1.08:hand.y;
      const toY=goingBack?hand.y:foeY+1.08;
      thrown.current.position.set(
        THREE.MathUtils.lerp(from.x,to.x,amount),
        THREE.MathUtils.lerp(fromY,toY,amount)+(inFlight?Math.sin(Math.PI*amount)*0.65:0),
        THREE.MathUtils.lerp(from.z,to.z,amount));
      thrown.current.quaternion.copy(camera.quaternion);
      thrown.current.rotateZ(Math.sin(t*17)*0.12);
      const fade=goingBack?1-smooth(t,1.75,1.92):capture.success?1:1-smooth(t,1.06,1.27);
      thrown.current.scale.setScalar((t<0.68?1:1.05+0.1*Math.sin(t*22))*Math.max(0.02,fade));
      (thrown.current.material as THREE.MeshBasicMaterial).opacity=fade;
    }
    const capturePulse=t>=0.62&&t<1.45;
    const recallPulse=capture.success&&t>=2.35&&t<2.98;
    const pulse=recallPulse?smooth(t,2.35,2.8):smooth(t,0.62,1.18);
    const point=recallPulse?capture.ally:capture.foe;
    const ground=recallPulse?allyY:foeY;
    const color=ELEMENT_COLOR[recallPulse?allyElement:element];
    seal.current.visible=capturePulse||recallPulse;
    ring.current.visible=capturePulse||recallPulse;
    if(seal.current.visible){
      seal.current.position.set(point.x,ground+1.05,point.z);
      seal.current.quaternion.copy(camera.quaternion);
      seal.current.scale.setScalar(0.45+pulse*1.75);
      const material=seal.current.material as THREE.MeshBasicMaterial;
      material.color.set(color);
      material.opacity=(1-pulse)*0.85;
    }
    if(ring.current.visible){
      ring.current.position.set(point.x,ground+0.16,point.z);
      ring.current.scale.setScalar(0.5+pulse*1.65);
      const material=ring.current.material as THREE.MeshBasicMaterial;
      material.color.set(color);
      material.opacity=(1-pulse)*0.78;
    }
    const allyMorph=smooth(t,2.48,2.84);
    const allyFlight=smooth(t,2.78,3.1);
    const allyFade=1-smooth(t,3.05,CAPTURE_RECALL_END_SECONDS);
    allyCard.current.visible=capture.success&&t>=2.6&&t<CAPTURE_RECALL_END_SECONDS;
    if(allyCard.current.visible){
      const allyDx=capture.ally.x-capture.hero.x,allyDz=capture.ally.z-capture.hero.z;
      const allyDistance=Math.hypot(allyDx,allyDz)||1;
      const allyHandX=capture.hero.x+allyDx/allyDistance*0.5;
      const allyHandZ=capture.hero.z+allyDz/allyDistance*0.5;
      allyCard.current.position.set(
        THREE.MathUtils.lerp(capture.ally.x,allyHandX,allyFlight),
        THREE.MathUtils.lerp(allyY+1.05,heroY+1.35,allyFlight)+Math.sin(Math.PI*allyFlight)*0.7,
        THREE.MathUtils.lerp(capture.ally.z,allyHandZ,allyFlight));
      allyCard.current.quaternion.copy(camera.quaternion);
      allyCard.current.rotateZ(Math.sin(t*14)*0.1*(1-allyFlight));
      allyCard.current.scale.setScalar((0.2+0.8*allyMorph)*Math.max(0.02,allyFade));
      (allyCard.current.material as THREE.MeshBasicMaterial).opacity=allyFade;
    }
    light.current.position.copy(allyCard.current.visible?allyCard.current.position:thrown.current.position);
    light.current.color.set(allyCard.current.visible?ELEMENT_COLOR[allyElement]:ELEMENT_COLOR[element]);
    light.current.intensity=allyCard.current.visible?1.35*allyFade:thrown.current.visible?1.2*(t<0.68?1:1-smooth(t,1.2,1.95)):0;
    ring.current.rotation.z=clock.elapsedTime*0.08;
  });
  if(!sequence)return null;
  return <group>
    <mesh ref={seal} visible={false} renderOrder={12}><planeGeometry args={[1.7,1.7]}/><meshBasicMaterial map={sealTexture} color={ELEMENT_COLOR[element]} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/></mesh>
    <mesh ref={ring} rotation={[-Math.PI/2,0,0]} visible={false} renderOrder={11}><ringGeometry args={[0.72,1,48]}/><meshBasicMaterial color={ELEMENT_COLOR[element]} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/></mesh>
    <mesh ref={thrown} visible={false} renderOrder={14}><planeGeometry args={[0.65,0.92]}/><meshBasicMaterial map={cardTexture} transparent alphaTest={0.06} depthTest={false} depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/></mesh>
    <mesh ref={allyCard} visible={false} renderOrder={14}><planeGeometry args={[0.65,0.92]}/><meshBasicMaterial map={allyTexture} transparent alphaTest={0.06} depthTest={false} depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/></mesh>
    <pointLight ref={light} color={ELEMENT_COLOR[element]} intensity={0} distance={4} decay={2}/>
  </group>;
}
