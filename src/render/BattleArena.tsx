import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BATTLE_INTRO_SECONDS, BATTLE_RECALL_END_SECONDS, BATTLE_ZOOM_OUT_END_SECONDS, CAPTURE_RECALL_END_SECONDS, CAPTURE_ZOOM_OUT_END_SECONDS, Game, type BattleActor } from '../game/game';

function StrikeZone({game,actor,color}:{game:Game;actor:BattleActor;color:string}) {
  const fill=useRef<THREE.Mesh>(null);
  const edge=useRef<THREE.LineLoop>(null);
  const outline=useMemo(()=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(64*3),3));
    return geometry;
  },[]);
  useFrame(({clock})=>{
    if(!fill.current||!edge.current||!game.battle)return;
    const active=game.mode==='battle'&&game.battle.intro===0&&!game.battle.finisher&&actor.windup>0&&!!actor.strikeOrigin;
    fill.current.visible=edge.current.visible=active;
    if(!active)return;
    const origin=actor.strikeOrigin!;
    const radius=actor.strikeRadius;
    fill.current.position.set(origin.x,game.getGroundHeight(origin.x,origin.z)+0.145,origin.z);
    fill.current.scale.setScalar(radius);
    (fill.current.material as THREE.MeshBasicMaterial).opacity=0.27+0.09*Math.sin(clock.elapsedTime*15);
    const positions=outline.attributes.position as THREE.BufferAttribute;
    for(let i=0;i<64;i++){
      const angle=i/64*Math.PI*2;
      const x=origin.x+Math.cos(angle)*radius,z=origin.z+Math.sin(angle)*radius;
      positions.setXYZ(i,x,game.getGroundHeight(x,z)+0.19,z);
    }
    positions.needsUpdate=true;
    edge.current.geometry.computeBoundingSphere();
  });
  return <>
    <mesh ref={fill} rotation={[-Math.PI/2,0,0]} visible={false}>
      <circleGeometry args={[1,48]}/><meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
    <lineLoop ref={edge} geometry={outline} visible={false} frustumCulled={false}>
      <lineBasicMaterial color={color} transparent opacity={0.92} depthWrite={false}/>
    </lineLoop>
  </>;
}

export function BattleArena({game}:{game:Game}) {
  const battle=game.battle;
  const ring=useMemo(()=>{
    if(!battle)return null;
    const positions:number[]=[];
    for(let i=0;i<97;i++) {
      const theta=i/96*Math.PI*2;
      const x=battle.center.x+Math.cos(theta)*battle.radius;
      const z=battle.center.z+Math.sin(theta)*battle.radius;
      positions.push(x-battle.center.x,game.getGroundHeight(x,z)+0.22,z-battle.center.z);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#f3d498',transparent:true,opacity:0.9}));
    line.position.set(battle.center.x,0,battle.center.z);
    return line;
  },[battle,game]);
  const sparks=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    if(!sparks.current||!battle||!ring)return;
    const growth=battle.intro>0?Math.max(0.03,1-battle.intro/BATTLE_INTRO_SECONDS):1;
    ring.scale.set(growth,1,growth);
    const fade=battle.captureSequence?.success?1-THREE.MathUtils.smoothstep(battle.captureSequence.elapsed,CAPTURE_RECALL_END_SECONDS,CAPTURE_ZOOM_OUT_END_SECONDS):
      battle.finisher?1-THREE.MathUtils.smoothstep(battle.finisher.elapsed,BATTLE_RECALL_END_SECONDS,BATTLE_ZOOM_OUT_END_SECONDS):1;
    ring.visible=fade>0.01;
    (ring.material as THREE.LineBasicMaterial).opacity=0.9*fade;
    sparks.current.children.forEach((child,i)=>{
      child.visible=fade>0.01;
      ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=fade;
      const a=i/16*Math.PI*2+clock.elapsedTime*0.28;
      const x=battle.center.x+Math.cos(a)*battle.radius*growth;
      const z=battle.center.z+Math.sin(a)*battle.radius*growth;
      child.position.set(x,game.getGroundHeight(x,z)+0.37+Math.sin(clock.elapsedTime*3+i)*0.12,z);
    });
  });
  if(!battle||!ring)return null;
  return <group>
    <primitive object={ring}/>
    <group ref={sparks}>{Array.from({length:16},(_,i)=><mesh key={i}><octahedronGeometry args={[0.09,0]}/><meshBasicMaterial color="#f5c783" transparent/></mesh>)}</group>
    <StrikeZone game={game} actor={battle.foe} color="#ff776b"/>
    <StrikeZone game={game} actor={battle.ally} color="#8cdef2"/>
  </group>;
}
