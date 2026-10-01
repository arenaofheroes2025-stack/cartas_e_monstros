import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { ITEMS } from '../game/items';

interface Aura {
  group: THREE.Group;
  ring: THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;
  motes: THREE.Sprite[];
  time: number;
  radius: number;
}

function glowTexture():THREE.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
  const context=canvas.getContext('2d')!;
  const gradient=context.createRadialGradient(16,16,1,16,16,16);
  gradient.addColorStop(0,'rgba(255,255,255,1)');
  gradient.addColorStop(0.35,'rgba(255,255,255,.75)');
  gradient.addColorStop(1,'rgba(255,255,255,0)');
  context.fillStyle=gradient;context.fillRect(0,0,32,32);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

function makeAura(glow:THREE.Texture,color:string,radius:number):Aura {
  const group=new THREE.Group();
  const ring=new THREE.Mesh(
    new THREE.RingGeometry(radius-0.045,radius+0.045,40),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.48,side:THREE.DoubleSide,
      depthWrite:false,toneMapped:false})
  );
  ring.rotation.x=-Math.PI/2;
  ring.position.y=0.04;
  ring.renderOrder=5;
  group.add(ring);
  const motes=Array.from({length:6},()=>{
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color,transparent:true,opacity:0.55,
      blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
    sprite.scale.set(0.4,0.4,1);
    sprite.renderOrder=8;
    group.add(sprite);
    return sprite;
  });
  return {group,ring,motes,time:0,radius};
}

function disposeAura(aura:Aura):void {
  aura.group.removeFromParent();
  aura.ring.geometry.dispose();aura.ring.material.dispose();
  for(const mote of aura.motes)(mote.material as THREE.SpriteMaterial).dispose();
}

export function StatusAuras({game}:{game:Game}) {
  const group=useRef<THREE.Group>(null);
  const auras=useRef(new Map<string,Aura>());
  const glow=useMemo(glowTexture,[]);
  useEffect(()=>()=>{
    for(const aura of auras.current.values())disposeAura(aura);
    auras.current.clear();glow.dispose();
  },[glow]);
  useFrame((_,dt)=>{
    const root=group.current;
    if(!root)return;
    const battle=game.battle,active=game.activeMonster;
    const visible=new Set<string>();
    const groups=new Map<string,number>();
    if(battle&&!battle.finisher&&!battle.captureSequence){
      for(const status of battle.statuses){
        if(status.remaining<=0)continue;
        const actor=status.targetUid===battle.enemy.uid?battle.foe:
          status.targetUid===active?.uid?battle.ally:null;
        if(!actor)continue;
        const key=`${status.targetUid}:${status.stat}:${status.itemId}`;
        visible.add(key);
        const ordinal=groups.get(status.targetUid)??0;
        groups.set(status.targetUid,ordinal+1);
        const radius=0.56+ordinal*0.15;
        let aura=auras.current.get(key);
        if(!aura){
          aura=makeAura(glow,ITEMS[status.itemId].color,radius);
          root.add(aura.group);auras.current.set(key,aura);
        }
        aura.group.position.set(actor.x,game.getGroundHeight(actor.x,actor.z)+0.04,actor.z);
        if(game.mode==='battle'&&!game.battleMenu&&!game.battle?.captureSequence)aura.time+=Math.min(dt,0.05);
        const fade=Math.min(1,status.remaining/0.45);
        aura.ring.material.opacity=(0.38+0.1*Math.sin(aura.time*3.2+ordinal))*fade;
        const pulse=1+0.035*Math.sin(aura.time*3+ordinal);
        aura.ring.scale.set(pulse,pulse,1);
        aura.motes.forEach((mote,index)=>{
          const rise=(aura.time*0.55+index/aura.motes.length)%1;
          const angle=aura.time*(0.75+ordinal*0.1)+index*Math.PI*2/aura.motes.length+ordinal*0.75;
          mote.position.set(Math.cos(angle)*aura.radius*0.94,0.16+rise*1.4,
            Math.sin(angle)*aura.radius*0.82);
          (mote.material as THREE.SpriteMaterial).opacity=(0.18+0.43*Math.sin(Math.PI*rise))*fade;
        });
      }
    }
    for(const [key,aura] of auras.current){
      if(visible.has(key))continue;
      disposeAura(aura);auras.current.delete(key);
    }
  });
  return <group ref={group}/>;
}
