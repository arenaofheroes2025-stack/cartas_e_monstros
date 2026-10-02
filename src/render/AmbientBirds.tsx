import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { BIRD_FLEE_DISTANCE, BIRD_FLUTTER_SECONDS, BIRD_SPECIES, birdAirScale,
  birdCanStartFlight, birdFleePose, birdFlutterDelay, birdLookDelay, birdPresence,
  birdQuietHours, birdShadowOpacity, birdSites,
  type BirdSite, type BirdSpecies } from '../game/ambientBirds';
import { type WorldData } from '../game/world';
import { birdTexture } from './art';
import { SPRITE_FACING, SPRITE_UP } from './camera';
import { facingForDirection } from './facing';
import { birdShadowPoint, writeBirdShadowSurface } from './birdShadows';

const FLYING_RENDER_ORDER = 16;

function SceneBird({game,world,site,time}:{game:Game;world:WorldData;site:BirdSite;time:React.RefObject<number>}) {
  const body=useRef<THREE.Mesh>(null);
  const shadow=useRef<THREE.Mesh>(null);
  const motion=useRef<{start:number;awayX:number;awayZ:number;hiddenUntil:number}|null>(null);
  const flutter=useRef({start:-1,next:1.5+site.phase*8,cycle:0});
  const look=useRef({direction:site.facing,next:2+site.phase*7,cycle:0});
  const wasQuiet=useRef(false);
  const projected=useRef(new THREE.Vector3());
  const art=useMemo(()=>new THREE.MeshBasicMaterial({map:birdTexture(site.species,'idle'),transparent:true,
    alphaTest:0.45,side:THREE.DoubleSide,depthWrite:true}),[site.species]);
  const shade=useMemo(()=>new THREE.MeshBasicMaterial({color:'#17232c',transparent:true,
    opacity:0.23,depthWrite:false}),[]);
  const shadowGeometry=useMemo(()=>new THREE.CircleGeometry(1,16).rotateX(-Math.PI/2),[]);
  const width=BIRD_SPECIES[site.species].scale;
  const height=width;
  useEffect(()=>()=>{art.dispose();shade.dispose();shadowGeometry.dispose();},[art,shade,shadowGeometry]);
  useFrame(({camera})=>{
    const mesh=body.current,spot=shadow.current;
    if(!mesh||!spot)return;
    const hour=game.hour;
    const quiet=birdQuietHours(hour);
    if(!quiet&&wasQuiet.current){
      flutter.current.next=time.current+birdFlutterDelay(site,++flutter.current.cycle);
      look.current.next=time.current+birdLookDelay(site,++look.current.cycle);
    }
    wasQuiet.current=quiet;
    if(quiet&&site.perch==='ground')motion.current=null;
    const presence=birdPresence(site,hour);
    const visibleMode=game.mode==='explore'||game.mode==='dialog'||game.mode==='pause'&&!game.battle;
    const distance=Math.hypot(site.x-game.player.x,site.z-game.player.z);
    if(!visibleMode||presence<=0||distance>23&&!motion.current){mesh.visible=false;spot.visible=false;return;}
    let x=site.x,z=site.z,lift=0,opacity=1,animation:'idle'|'flutter'|'takeoff'|'fly'='idle';
    let frame=Math.floor((time.current/BIRD_SPECIES[site.species].idleSeconds+site.phase)*4)%4;
    if(!motion.current&&game.mode==='explore'&&!quiet&&time.current>=look.current.next){
      look.current.direction=look.current.direction===1?-1:1;
      look.current.next=time.current+birdLookDelay(site,++look.current.cycle);
    }
    let face=look.current.direction;
    if(site.perch==='ground'){
      let flight=motion.current;
      if(!flight&&game.mode==='explore'&&birdCanStartFlight(hour)&&distance<BIRD_FLEE_DISTANCE){
        const dx=site.x-game.player.x,dz=site.z-game.player.z,unit=Math.hypot(dx,dz)||1;
        flight={start:time.current,awayX:dx/unit,awayZ:dz/unit,hiddenUntil:0};
        motion.current=flight;
        flutter.current.start=-1;
        flutter.current.next=time.current+birdFlutterDelay(site,++flutter.current.cycle);
      }
      if(flight){
        const elapsed=time.current-flight.start;
        if(flight.hiddenUntil){
          if(time.current>=flight.hiddenUntil&&distance>7.5){
            motion.current=null;
            flutter.current.next=time.current+birdFlutterDelay(site,++flutter.current.cycle);
          }
          else {mesh.visible=false;spot.visible=false;return;}
        }else{
          const pose=birdFleePose(elapsed);
          x+=flight.awayX*pose.distance;z+=flight.awayZ*pose.distance;
          lift=pose.lift;opacity=pose.opacity;frame=pose.frame;
          animation=elapsed<0.22?'takeoff':'fly';
          face=facingForDirection(flight.awayX,flight.awayZ,face);
          const screen=projected.current.set(x,site.groundY+lift+height*0.5,z).project(camera);
          if(elapsed>0.8&&(Math.abs(screen.x)>1.2||Math.abs(screen.y)>1.2)){
            flight.hiddenUntil=time.current+8+site.phase*5;
            mesh.visible=false;spot.visible=false;return;
          }
        }
      }
    }
    if(!motion.current){
      const gesture=flutter.current;
      if(quiet)gesture.start=-1;
      if(gesture.start<0&&game.mode==='explore'&&!quiet&&time.current>=gesture.next)
        gesture.start=time.current;
      if(gesture.start>=0){
        const elapsed=time.current-gesture.start;
        if(elapsed<BIRD_FLUTTER_SECONDS){
          animation='flutter';
          frame=Math.min(5,Math.floor(elapsed/BIRD_FLUTTER_SECONDS*6));
        }else{
          gesture.start=-1;
          gesture.next=time.current+birdFlutterDelay(site,++gesture.cycle);
        }
      }
    }
    opacity*=motion.current?1:presence;
    mesh.visible=opacity>0.02;
    if(!mesh.visible){spot.visible=false;return;}
    const texture=birdTexture(site.species,animation,frame);
    if(art.map!==texture){art.map=texture;art.needsUpdate=true;}
    art.opacity=opacity;
    const airborne=animation==='fly';
    if(art.depthTest===airborne){art.depthTest=!airborne;art.depthWrite=!airborne;}
    mesh.renderOrder=airborne?FLYING_RENDER_ORDER:0;
    const footV=(texture.userData.footV as number|undefined)??0;
    const perched=site.perch==='tree'||site.perch==='roof';
    const altitude=site.perchHeight+lift;
    const sourceY=site.groundY+altitude;
    mesh.position.set(x+(perched?0.1:0),sourceY,z+(perched?0.1:0))
      .addScaledVector(SPRITE_UP,height*(animation==='fly'?0.5:0.5-footV));
    mesh.quaternion.copy(SPRITE_FACING);
    const cast=birdShadowPoint(world,x,sourceY,z);
    const size=airborne?birdAirScale(cast.height,Math.hypot(x-game.player.x,z-game.player.z)):1;
    mesh.scale.set(face*size,size,1);
    spot.visible=true;
    spot.position.set(cast.x,cast.y,cast.z);
    const radiusX=0.32+cast.height*0.06,radiusZ=0.22+cast.height*0.035;
    spot.scale.set(radiusX,1,radiusZ);
    writeBirdShadowSurface(shadowGeometry,world,cast,radiusX,radiusZ);
    shade.opacity=birdShadowOpacity(cast.height)*opacity;
  });
  return <>
    <mesh ref={shadow} geometry={shadowGeometry} material={shade} renderOrder={3} visible={false}
      frustumCulled={false}/>
    <mesh ref={body} material={art} quaternion={SPRITE_FACING}>
      <planeGeometry args={[width,height]}/>
    </mesh>
  </>;
}

interface FlyoverState { species:BirdSpecies; start:number; x:number; z:number; y:number; vx:number; vz:number; entered:boolean }

function Flyovers({game,world,time}:{game:Game;world:WorldData;time:React.RefObject<number>}) {
  const meshes=useRef<Array<THREE.Mesh|null>>([null,null]);
  const shadows=useRef<Array<THREE.Mesh|null>>([null,null]);
  const flights=useRef<Array<FlyoverState|null>>([null,null]);
  const projected=useRef(new THREE.Vector3());
  const next=useRef(7+(world.seed%5));
  const serial=useRef(0);
  const wasQuiet=useRef(false);
  const materials=useMemo(()=>Array.from({length:2},()=>new THREE.MeshBasicMaterial({
    map:birdTexture('azul','fly',2),transparent:true,alphaTest:0.45,side:THREE.DoubleSide,
    depthTest:false,depthWrite:false
  })),[]);
  const shadeMaterials=useMemo(()=>Array.from({length:2},()=>new THREE.MeshBasicMaterial({
    color:'#17232c',transparent:true,opacity:0.05,depthWrite:false
  })),[]);
  const shadowGeometries=useMemo(()=>Array.from({length:2},()=>
    new THREE.CircleGeometry(1,16).rotateX(-Math.PI/2)),[]);
  useEffect(()=>()=>{materials.forEach(material=>material.dispose());
    shadeMaterials.forEach(material=>material.dispose());
    shadowGeometries.forEach(geometry=>geometry.dispose());},[materials,shadeMaterials,shadowGeometries]);
  useFrame(({camera})=>{
    const quiet=birdQuietHours(game.hour);
    if(!quiet&&wasQuiet.current)next.current=time.current+5+(world.seed%5);
    wasQuiet.current=quiet;
    if(game.mode==='battle'||game.mode==='title'||quiet){
      if(quiet)flights.current.fill(null);
      meshes.current.forEach(mesh=>{if(mesh)mesh.visible=false;});
      shadows.current.forEach(mesh=>{if(mesh)mesh.visible=false;});
      return;
    }
    if(game.mode==='explore'&&birdCanStartFlight(game.hour)&&time.current>=next.current){
      const n=serial.current++;
      for(let pair=0;pair<(n%3===0?2:1);pair++){
        const slot=flights.current.findIndex(value=>!value);
        if(slot<0)break;
        const direction=n%2===0?1:-1;
        const species=(Object.keys(BIRD_SPECIES) as BirdSpecies[])[(world.seed+n+pair)%3];
        flights.current[slot]={species,start:time.current,
          x:game.player.x-direction*(21+pair*2),z:game.player.z+((n*7)%13)-6+pair*3,
          y:game.getGroundHeight(game.player.x,game.player.z)+3.7+(n%3)*0.45+pair*0.3,
          vx:direction*(7.1+(n%3)*0.4),vz:(n%2===0?1:-1)*1.25,entered:false};
      }
      next.current=time.current+11+((world.seed+serial.current*37)%8);
    }
    for(let slot=0;slot<2;slot++){
      const mesh=meshes.current[slot],shadow=shadows.current[slot],flight=flights.current[slot];
      if(!mesh||!shadow)continue;
      if(!flight){mesh.visible=false;shadow.visible=false;continue;}
      const age=time.current-flight.start;
      mesh.position.set(flight.x+flight.vx*age,flight.y+Math.sin(age*4)*0.08,flight.z+flight.vz*age);
      const screen=projected.current.copy(mesh.position).project(camera);
      const onScreen=Math.abs(screen.x)<1.02&&Math.abs(screen.y)<1.02;
      flight.entered ||= onScreen;
      if((flight.entered||age>8)&&age>0.8&&(Math.abs(screen.x)>1.2||Math.abs(screen.y)>1.2)){
        flights.current[slot]=null;mesh.visible=false;shadow.visible=false;continue;
      }
      mesh.visible=true;
      const distance=Math.hypot(mesh.position.x-game.player.x,mesh.position.z-game.player.z);
      const cast=birdShadowPoint(world,mesh.position.x,mesh.position.y,mesh.position.z);
      const size=birdAirScale(cast.height,distance);
      mesh.scale.set(facingForDirection(flight.vx,flight.vz)*size,size,1);
      shadow.visible=true;
      shadow.position.set(cast.x,cast.y,cast.z);
      const radiusX=0.32+cast.height*0.06,radiusZ=0.22+cast.height*0.035;
      shadow.scale.set(radiusX,1,radiusZ);
      writeBirdShadowSurface(shadowGeometries[slot],world,cast,radiusX,radiusZ);
      shadeMaterials[slot].opacity=birdShadowOpacity(cast.height);
      const frame=Math.floor(age/BIRD_SPECIES[flight.species].flySeconds*6)%6;
      const texture=birdTexture(flight.species,'fly',frame);
      const material=materials[slot];
      if(material.map!==texture){material.map=texture;material.needsUpdate=true;}
    }
  });
  return <>{materials.map((material,index)=><group key={index}>
    <mesh ref={mesh=>{shadows.current[index]=mesh;}} geometry={shadowGeometries[index]}
      material={shadeMaterials[index]} renderOrder={3} visible={false} frustumCulled={false}/>
    <mesh ref={mesh=>{meshes.current[index]=mesh;}} quaternion={SPRITE_FACING}
      material={material} visible={false} renderOrder={FLYING_RENDER_ORDER}>
      <planeGeometry args={[0.9,0.9]}/>
    </mesh>
  </group>)}</>;
}

export function AmbientBirds({game,world}:{game:Game;world:WorldData}) {
  const sites=useMemo(()=>birdSites(world),[world]);
  const time=useRef(0);
  useFrame((_,delta)=>{if(game.mode==='explore')time.current+=Math.min(delta,0.05);});
  return <group>
    {sites.map(site=><SceneBird key={site.id} game={game} world={world} site={site} time={time}/>)}
    <Flyovers game={game} world={world} time={time}/>
  </group>;
}
