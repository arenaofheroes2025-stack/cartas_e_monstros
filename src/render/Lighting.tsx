import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { ELEMENT_COLOR } from '../game/content';
import { visibleLightIds } from './lightCulling';
import { worldLightSources, type SceneLightSource } from './lightSources';
import { SUN_OFFSET } from './sun';
import { SHADOW_CALIBRATION } from './shadowCalibration';
import { setProjectedShadowOpacity } from './ProjectedShadows';

const daySky=new THREE.Color('#9cccd4');
const nightSky=new THREE.Color('#142a42');
const daySun=new THREE.Color('#fff2d2');
const nightMoon=new THREE.Color('#9ab8e3');
const daylightAmbient=new THREE.Color('#e6efe2');

function glowMaterial():THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms:{uColor:{value:new THREE.Color('#ffc583')},uOpacity:{value:0}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv;uniform vec3 uColor;uniform float uOpacity;void main(){float r=length(vUv-0.5)*2.0;float a=pow(max(0.0,1.0-r),2.0)*uOpacity;gl_FragColor=vec4(uColor,a);}',
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide
  });
}

export function Lighting({game,quality}:{game:Game;quality:'high'|'low'}) {
  const main=useRef<THREE.DirectionalLight>(null);
  const ambient=useRef<THREE.AmbientLight>(null);
  const hemisphere=useRef<THREE.HemisphereLight>(null);
  const village=useRef<THREE.PointLight>(null);
  const lights=useRef(new Map<string,THREE.PointLight>());
  const active=useRef(new Set<string>());
  const [activeIds,setActiveIds]=useState<string[]>([]);
  const {scene,gl}=useThree();
  const lastCull=useRef(-1);
  const lastShadow=useRef(0);
  const sources=useMemo(()=>game.world?worldLightSources(game.world):[],[game.world]);
  const opened=game.save?.openedCaches.join('|')||'';
  const cards=useMemo<SceneLightSource[]>(()=>{
    if(!game.world)return [];
    const found=new Set(opened?opened.split('|'):[]);
    return game.world.caches.filter(cache=>!found.has(cache.id)).map(cache=>{
      const groundY=game.getGroundHeight(cache.x+0.5,cache.z+0.5)+0.13;
      return {id:`card-${cache.id}`,x:cache.x+0.5,y:groundY+0.52,z:cache.z+0.5,groundY,
        color:ELEMENT_COLOR[cache.element],reach:3.5};
    });
  },[game.world,opened]);
  const allSources=useMemo(()=>[...sources,...cards],[sources,cards]);
  const glows=useMemo(()=>new Map(allSources.map(source=>[source.id,glowMaterial()])),[allSources]);
  useEffect(()=>()=>{for(const material of glows.values())material.dispose();},[glows]);

  useFrame(({clock,camera})=>{
    if(!main.current||!ambient.current||!hemisphere.current||!village.current)return;
    const hour=game.hour;
    const dawn=Math.min(1,Math.max(0,(hour-5)/2.5));
    const dusk=Math.min(1,Math.max(0,(20-hour)/2.5));
    const daylight=dawn*dusk,night=1-daylight;
    setProjectedShadowOpacity(0.045+daylight*(SHADOW_CALIBRATION.opacity-0.045));
    const px=game.player.x,pz=game.player.z;
    main.current.intensity=0.62+daylight*(SHADOW_CALIBRATION.sunStrength-0.62);
    main.current.color.copy(nightMoon).lerp(daySun,daylight);
    main.current.position.set(px+SUN_OFFSET.x,SUN_OFFSET.y,pz+SUN_OFFSET.z);
    main.current.target.position.set(px,0,pz);
    main.current.target.updateMatrixWorld();
    ambient.current.intensity=0.64+daylight*0.26;
    ambient.current.color.set('#9bb8dc').lerp(daylightAmbient,daylight);
    hemisphere.current.intensity=0.36+daylight*0.16;
    const sky=nightSky.clone().lerp(daySky,daylight);
    scene.background=sky;
    if(scene.fog instanceof THREE.Fog){
      scene.fog.color.copy(sky);
      scene.fog.near=18+daylight*5;
      scene.fog.far=45+daylight*20;
    }
    village.current.intensity=0.4+night*1.7;

    if(clock.elapsedTime-lastCull.current>0.2){
      lastCull.current=clock.elapsedTime;
      const next=visibleLightIds(camera,allSources,active.current,3.5,7);
      if(next.length!==active.current.size||next.some(id=>!active.current.has(id))){
        active.current=new Set(next);
        setActiveIds(next);
      }
    }
    for(const source of allSources){
      if(!active.current.has(source.id))continue;
      const light=lights.current.get(source.id);
      const card=source.id.startsWith('card-');
      if(light)light.intensity=card?0.5+night*0.55:0.25+night*2.05;
      const glow=glows.get(source.id);
      if(glow){
        glow.uniforms.uColor.value.set(source.color);
        glow.uniforms.uOpacity.value=card?0.1+night*0.28:0.035+night*0.32;
      }
    }
    if(clock.elapsedTime-lastShadow.current>0.35){gl.shadowMap.needsUpdate=true;lastShadow.current=clock.elapsedTime;}
  });

  return <group>
    <ambientLight ref={ambient} intensity={0.6}/>
    <hemisphereLight ref={hemisphere} args={['#c7e0ec','#615f51',0.45]}/>
    <directionalLight ref={main} intensity={1.4} position={[SUN_OFFSET.x,SUN_OFFSET.y,SUN_OFFSET.z]} castShadow
      shadow-mapSize={[quality==='high'?1024:512,quality==='high'?1024:512]}
      shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22}
      shadow-camera-near={0.5} shadow-camera-far={135} shadow-bias={-0.00025} shadow-normalBias={0.006}/>
    <pointLight ref={village} position={[48,3,48]} color="#f1ad69" distance={14} decay={2} intensity={1}/>
    {allSources.filter(source=>activeIds.includes(source.id)).map(source=>{
      const card=source.id.startsWith('card-');
      return <group key={source.id}>
        <pointLight ref={light=>{if(light)lights.current.set(source.id,light);else lights.current.delete(source.id);}}
          position={[source.x,source.y,source.z]} color={source.color} distance={source.reach} decay={2} intensity={0}/>
        <mesh material={glows.get(source.id)} position={[source.x,source.groundY,source.z]}
          rotation={[-Math.PI/2,0,0]} renderOrder={5}>
          <planeGeometry args={[card?2.4:5.8,card?2.4:5.8]}/>
        </mesh>
      </group>;
    })}
  </group>;
}
