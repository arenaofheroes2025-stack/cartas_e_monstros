import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { ELEMENT_COLOR } from '../game/content';
import { imageTexture, monsterTexture } from './art';
import { ITEMS, itemArt, type BattleStat } from '../game/items';

interface Particle { mesh:THREE.Mesh; vx:number; vy:number; vz:number; life:number; maxLife:number }
interface Burst { mesh:THREE.Mesh; life:number; maxLife:number }
interface Strike { group:THREE.Group; materials:THREE.MeshBasicMaterial[]; life:number; maxLife:number }
interface Evolution { mesh:THREE.Mesh; species:string; life:number }
interface DamagePopup { sprite:THREE.Sprite; life:number; maxLife:number; rise:number }
interface ItemFlight { mesh:THREE.Mesh; from:THREE.Vector3; to:THREE.Vector3; elapsed:number; duration:number; color:string; targetUid?:string; itemEffect?:'heal'|'status'; amount?:number; stat?:BattleStat; autoItem?:boolean }
const spriteFacing=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/4);

function damageSprite(amount:number,critical:boolean):THREE.Sprite {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const context=canvas.getContext('2d')!;
  context.textAlign='center';context.textBaseline='middle';context.lineJoin='round';
  if(critical){
    context.font='bold 25px Trebuchet MS, sans-serif';
    context.lineWidth=6;context.strokeStyle='#642b22';context.strokeText('CRÍTICO!',128,24);
    context.fillStyle='#ffe78c';context.fillText('CRÍTICO!',128,24);
  }
  context.font=amount===0?'900 42px Trebuchet MS, sans-serif':'900 72px Trebuchet MS, sans-serif';
  const label=amount===0?'ERROU':`-${amount}`;
  context.lineWidth=13;context.strokeStyle='#183143';context.strokeText(label,128,critical?83:66);
  context.fillStyle=amount===0?'#b7d9df':critical?'#ffdf79':'#ffffff';context.fillText(label,128,critical?83:66);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false});
  const sprite=new THREE.Sprite(material);sprite.renderOrder=12;
  sprite.scale.set(critical?2.15:1.75,critical?1.08:0.88,1);
  return sprite;
}

function xpSprite(amount:number):THREE.Sprite {
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=120;
  const context=canvas.getContext('2d')!;
  context.textAlign='center';context.textBaseline='middle';context.lineJoin='round';
  context.font='900 63px Trebuchet MS, sans-serif';
  context.lineWidth=12;context.strokeStyle='#254044';context.strokeText(`+${amount} XP`,160,60);
  context.fillStyle='#ffe29a';context.fillText(`+${amount} XP`,160,60);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
  sprite.renderOrder=15;
  sprite.scale.set(2.05,0.77,1);
  return sprite;
}

function itemResultSprite(amount:number,effect:'heal'|'status',color:string,stat?:BattleStat,automatic=false):THREE.Sprite {
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=128;
  const context=canvas.getContext('2d')!;
  const statLabel=stat==='attack'?'ATQ':stat==='defense'?'DEF':'VEL';
  const label=effect==='heal'?`+${amount} PV`:`${amount>0?'+':''}${amount} ${statLabel}`;
  context.textAlign='center';context.textBaseline='middle';context.lineJoin='round';
  if(automatic){
    context.font='900 24px Trebuchet MS, sans-serif';
    context.lineWidth=6;context.strokeStyle='#18313b';context.strokeText('AUTO',160,23);
    context.fillStyle='#ffe4a9';context.fillText('AUTO',160,23);
  }
  context.font='900 62px Trebuchet MS, sans-serif';
  context.lineWidth=12;context.strokeStyle='#18313b';context.strokeText(label,160,automatic?78:65);
  context.fillStyle=effect==='heal'?'#78eea8':color;context.fillText(label,160,automatic?78:65);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
  sprite.renderOrder=15;sprite.scale.set(2.05,0.82,1);
  return sprite;
}

export function Effects({game}:{game:Game}) {
  const group=useRef<THREE.Group>(null);
  const light=useRef<THREE.PointLight>(null);
  const particles=useRef<Particle[]>([]);
  const bursts=useRef<Burst[]>([]);
  const strikes=useRef<Strike[]>([]);
  const evolutions=useRef<Evolution[]>([]);
  const damagePopups=useRef<DamagePopup[]>([]);
  const itemFlights=useRef<ItemFlight[]>([]);
  const geo=useMemo(()=>new THREE.BoxGeometry(0.1,0.1,0.1),[]);
  const burstGeo=useMemo(()=>new THREE.PlaneGeometry(1,1),[]);
  useFrame(({camera},dt)=>{
    if(!group.current)return;
    while(game.effects.length) {
      const event=game.effects.shift()!;
      if(event.kind==='damage'){
        const sprite=damageSprite(event.amount||0,!!event.critical);
        sprite.position.set(event.x,game.getGroundHeight(event.x,event.z)+1.8,event.z);
        group.current.add(sprite);
        damagePopups.current.push({sprite,life:1.45,maxLife:1.45,rise:event.critical?0.9:0.7});
        continue;
      }
      if(event.kind==='xp'){
        const sprite=xpSprite(event.amount||0);
        sprite.position.set(event.x,game.getGroundHeight(event.x,event.z)+1.95,event.z);
        group.current.add(sprite);
        damagePopups.current.push({sprite,life:1.55,maxLife:1.55,rise:0.55});
        continue;
      }
      if(event.kind==='item'&&event.itemId&&event.target){
        const material=new THREE.MeshBasicMaterial({map:imageTexture(itemArt(event.itemId)),transparent:true,alphaTest:0.12,
          side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false});
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.68,0.68),material);
        mesh.renderOrder=13;
        group.current.add(mesh);
        const handOffset=event.autoItem?0:0.32;
        const dx=event.target.x-event.x,dz=event.target.z-event.z;
        const distance=Math.hypot(dx,dz)||1;
        itemFlights.current.push({mesh,from:new THREE.Vector3(event.x+dx/distance*handOffset,game.getGroundHeight(event.x,event.z)+(event.autoItem?0.84:1.25),event.z+dz/distance*handOffset),
          to:new THREE.Vector3(event.target.x,game.getGroundHeight(event.target.x,event.target.z)+1.1,event.target.z),
          elapsed:0,duration:event.autoItem?0.62:0.38,color:ITEMS[event.itemId].color,targetUid:event.targetUid,
          itemEffect:event.itemEffect,amount:event.amount,stat:event.stat,autoItem:event.autoItem});
        continue;
      }
      const color=event.element?ELEMENT_COLOR[event.element]:'#fff2c7';
      if(event.kind==='hit'){
        const slash=new THREE.Group();
        const materials:THREE.MeshBasicMaterial[]=[];
        for(const angle of [-0.63,0.63]){
          const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.92,depthTest:false,depthWrite:false,toneMapped:false});
          const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.78,0.09),material);
          mesh.rotation.z=angle;
          mesh.renderOrder=14;
          slash.add(mesh);materials.push(material);
        }
        slash.position.set(event.x,game.getGroundHeight(event.x,event.z)+1.05,event.z);
        slash.quaternion.copy(camera.quaternion);
        group.current.add(slash);
        strikes.current.push({group:slash,materials,life:0.3,maxLife:0.3});
      }
      const art=event.kind==='capture'||event.kind==='summon'?'capture':event.kind==='evolve'?'evolve':event.kind==='seal'?'seal':event.kind==='dodge'?null:event.element==='fogo'?'fire-hit':event.element==='agua'?'water-hit':'nature-hit';
      if(art){
        const material=new THREE.MeshBasicMaterial({map:imageTexture(`/art/effects/${art}.png`),transparent:true,depthWrite:false,side:THREE.DoubleSide});
        const mesh=new THREE.Mesh(burstGeo,material);
        const size=event.kind==='summon'?2.8:event.kind==='skill'||event.kind==='evolve'||event.kind==='seal'?2.1:1.5;
        mesh.scale.setScalar(size);
        mesh.position.set(event.x,game.getGroundHeight(event.x,event.z)+0.87,event.z);
        mesh.quaternion.copy(camera.quaternion);
        group.current.add(mesh);
        bursts.current.push({mesh,life:0.7,maxLife:0.7});
      }
      if(event.kind==='evolve'&&event.species){
        const material=new THREE.MeshLambertMaterial({map:monsterTexture(event.species,5),emissiveMap:monsterTexture(event.species,5),emissive:'#ffffff',emissiveIntensity:0.42,transparent:true,alphaTest:0.4,side:THREE.DoubleSide});
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.8),material);
        mesh.position.set(event.x,game.getGroundHeight(event.x,event.z)+1.05,event.z);
        mesh.quaternion.copy(spriteFacing);
        group.current.add(mesh);
        evolutions.current.push({mesh,species:event.species,life:2.1});
      }
      const count=event.kind==='evolve'||event.kind==='seal'||event.kind==='summon'?28:event.kind==='skill'?18:10;
      for(let i=0;i<count;i++) {
        const angle=Math.random()*Math.PI*2,radius=Math.random()*0.35;
        const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false}));
        mesh.position.set(event.x+Math.cos(angle)*radius,game.getGroundHeight(event.x,event.z)+0.65,event.z+Math.sin(angle)*radius);
        group.current.add(mesh);
        particles.current.push({mesh,vx:Math.cos(angle)*(0.5+Math.random()*2),vy:0.8+Math.random()*2,vz:Math.sin(angle)*(0.5+Math.random()*2),life:0.65+Math.random()*0.55,maxLife:1.2});
      }
      if(light.current){light.current.position.set(event.x,game.getGroundHeight(event.x,event.z)+1.3,event.z);light.current.color.set(color);light.current.intensity=2;}
    }
    if(light.current)light.current.intensity=Math.max(0,light.current.intensity-dt*3.4);
    itemFlights.current=itemFlights.current.filter(flight=>{
      flight.elapsed=Math.min(flight.duration,flight.elapsed+dt);
      if(flight.targetUid&&game.battle){
        const actor=flight.targetUid===game.battle.enemy.uid?game.battle.foe:
          flight.targetUid===game.activeMonster?.uid?game.battle.ally:null;
        if(actor)flight.to.set(actor.x,game.getGroundHeight(actor.x,actor.z)+1.1,actor.z);
      }
      const t=flight.elapsed/flight.duration;
      flight.mesh.position.copy(flight.from).lerp(flight.to,t);
      flight.mesh.position.y+=Math.sin(Math.PI*t)*0.95;
      flight.mesh.quaternion.copy(camera.quaternion);
      flight.mesh.rotation.z=t*1.2;
      flight.mesh.scale.setScalar(1+Math.sin(Math.PI*t)*0.35);
      if(t<1)return true;
      group.current?.remove(flight.mesh);flight.mesh.geometry.dispose();(flight.mesh.material as THREE.Material).dispose();
      if(flight.itemEffect&&flight.amount!==undefined){
        const sprite=itemResultSprite(flight.amount,flight.itemEffect,flight.color,flight.stat,flight.autoItem);
        sprite.position.copy(flight.to);sprite.position.y+=0.68;
        group.current?.add(sprite);
        damagePopups.current.push({sprite,life:1.45,maxLife:1.45,rise:0.68});
      }
      for(let i=0;i<14;i++){
        const angle=i*Math.PI/7;
        const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:flight.color,transparent:true,opacity:1,depthWrite:false}));
        mesh.position.copy(flight.to);group.current?.add(mesh);
        particles.current.push({mesh,vx:Math.cos(angle)*1.7,vy:1.2+Math.random(),vz:Math.sin(angle)*1.7,life:0.7,maxLife:0.7});
      }
      if(light.current){light.current.position.copy(flight.to);light.current.color.set(flight.color);light.current.intensity=2.2;}
      return false;
    });
    particles.current=particles.current.filter(p=>{
      p.life-=dt;
      p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;
      p.vy-=dt*2.8;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,p.life/p.maxLife);
      p.mesh.rotation.y+=dt*3;
      if(p.life<=0){group.current?.remove(p.mesh);(p.mesh.material as THREE.Material).dispose();return false;}
      return true;
    });
    bursts.current=bursts.current.filter(b=>{
      b.life-=dt;
      b.mesh.scale.multiplyScalar(1+dt*0.45);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,b.life/b.maxLife);
      if(b.life<=0){group.current?.remove(b.mesh);(b.mesh.material as THREE.Material).dispose();return false;}
      return true;
    });
    strikes.current=strikes.current.filter(strike=>{
      strike.life-=dt;
      const progress=1-Math.max(0,strike.life)/strike.maxLife;
      strike.group.scale.setScalar(0.72+progress*0.54);
      for(const material of strike.materials)material.opacity=Math.max(0,1-progress);
      if(strike.life<=0){
        group.current?.remove(strike.group);
        for(const child of strike.group.children){const mesh=child as THREE.Mesh;mesh.geometry.dispose();}
        for(const material of strike.materials)material.dispose();
        return false;
      }
      return true;
    });
    evolutions.current=evolutions.current.filter(e=>{
      e.life-=dt;
      const material=e.mesh.material as THREE.MeshLambertMaterial;
      const frame=e.life>1.05?5:0;
      const texture=monsterTexture(e.species,frame);
      if(material.map!==texture){material.map=texture;material.emissiveMap=texture;material.needsUpdate=true;}
      material.emissiveIntensity=e.life>1.05?0.42:0.2;
      if(e.life<=0){group.current?.remove(e.mesh);e.mesh.geometry.dispose();material.dispose();return false;}
      return true;
    });
    damagePopups.current=damagePopups.current.filter(popup=>{
      popup.life-=dt;
      popup.sprite.position.y+=popup.rise*dt;
      (popup.sprite.material as THREE.SpriteMaterial).opacity=Math.min(1,Math.max(0,popup.life/0.35));
      if(popup.life<=0){
        group.current?.remove(popup.sprite);
        const material=popup.sprite.material as THREE.SpriteMaterial;
        material.map?.dispose();material.dispose();
        return false;
      }
      return true;
    });
  });
  return <group ref={group}><pointLight ref={light} intensity={0} distance={6} decay={2}/></group>;
}
