import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { ELEMENT_COLOR } from '../game/content';
import { visibleLightIds } from './lightCulling';
import { worldLightSources, type SceneLightSource } from './lightSources';
import { SUN_OFFSET } from './sun';
import { SHADOW_CALIBRATION } from './shadowCalibration';
import { setProjectedShadowOpacity } from './ProjectedShadows';
import { setTownLightNight, setTownLightSources, setWorldLightGrade } from './CloudShadows';
import { daylightPhase } from './daylightPhase';

const daySky=new THREE.Color('#9cccd4');
const nightSky=new THREE.Color('#142a42');
const daySun=new THREE.Color('#fff5d5');
const morningSun=new THREE.Color('#d9eaff');
const warmSun=new THREE.Color('#ffc18b');
const nightMoon=new THREE.Color('#9ab8e3');
const daylightAmbient=new THREE.Color('#f6f1df');
const morningAmbient=new THREE.Color('#d4e8f8');
const warmAmbient=new THREE.Color('#f7d8b3');
const morningSky=new THREE.Color('#8bbbe0');
const warmSky=new THREE.Color('#df9f80');
// Keep the WebGL light count fixed: changing it recompiles every lit material.
const LIGHT_POOL_SIZE=20;

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
  const lights=useRef<(THREE.PointLight|null)[]>([]);
  const lightPool=useMemo(()=>Array.from({length:LIGHT_POOL_SIZE},(_,slot)=><pointLight key={slot}
    ref={light=>{lights.current[slot]=light;}} position={[0,-100,0]}
    color="#ffc27b" distance={0.01} decay={2} intensity={0}/>),[]);
  const lightSlots=useRef<(SceneLightSource|null)[]>(Array(LIGHT_POOL_SIZE).fill(null));
  const assignments=useRef(new Map<string,number>());
  const active=useRef(new Set<string>());
  const glowMeshes=useRef<(THREE.Mesh|null)[]>([]);
  const glowGeometry=useMemo(()=>new THREE.PlaneGeometry(1,1),[]);
  const glowMaterials=useMemo(()=>Array.from({length:LIGHT_POOL_SIZE},()=>glowMaterial()),[]);
  const sky=useMemo(()=>new THREE.Color(),[]);
  const {scene,gl}=useThree();
  const lastCull=useRef(-1);
  const lastShadow=useRef({x:Number.NaN,z:Number.NaN,at:0});
  const sources=useMemo(()=>game.world?worldLightSources(game.world):[],[game.world]);
  const townSources=useMemo(()=>sources.filter(source=>source.kind==='house'||source.kind==='lamp'),[sources]);
  const opened=game.save?.openedCaches.join('|')||'';
  const cards=useMemo<SceneLightSource[]>(()=>{
    if(!game.world)return [];
    const found=new Set(opened?opened.split('|'):[]);
    return game.world.caches.filter(cache=>!found.has(cache.id)).map(cache=>{
      const groundY=game.getGroundHeight(cache.x+0.5,cache.z+0.5)+0.13;
      return {id:`card-${cache.id}`,kind:'card',x:cache.x+0.5,y:groundY+0.52,z:cache.z+0.5,groundY,
        color:ELEMENT_COLOR[cache.element],reach:3.5};
    });
  },[game.world,opened]);
  const allSources=useMemo(()=>[...sources,...cards],[sources,cards]);
  const sourceById=useMemo(()=>new Map(allSources.map(source=>[source.id,source])),[allSources]);
  useEffect(()=>()=>{glowGeometry.dispose();glowMaterials.forEach(material=>material.dispose());},[glowGeometry,glowMaterials]);
  useEffect(()=>{
    assignments.current.clear();
    lightSlots.current.fill(null);
    active.current.clear();
    lastCull.current=-1;
    setTownLightSources([]);
  },[game.world]);
  useEffect(()=>{
    lastShadow.current.x=Number.NaN;
    gl.shadowMap.needsUpdate=true;
  },[game.world,quality,gl]);

  useFrame(({clock,camera})=>{
    if(!main.current||!ambient.current||!hemisphere.current||!village.current)return;
    const hour=game.hour;
    const {daylight,morning,warmth}=daylightPhase(hour);
    const night=1-daylight;
    setTownLightNight(night);
    const clearDay=daylight*(1-Math.max(morning,warmth)*0.3);
    const dayLift=1+daylight*0.15+clearDay*0.18;
    setWorldLightGrade(
      dayLift*(1+daylight*0.04-morning*0.09+warmth*0.14)-night*0.06,
      dayLift*(1+daylight*0.025+morning*0.01-warmth*0.03)-night*0.03,
      dayLift*(1-daylight*0.04+morning*0.18-warmth*0.2)+night*0.06,
      daylight*(0.22+0.14*(1-Math.max(morning,warmth))),
      clearDay*0.26+warmth*0.06
    );
    setProjectedShadowOpacity(0.045+daylight*(SHADOW_CALIBRATION.opacity-0.045));
    const px=game.player.x,pz=game.player.z;
    main.current.intensity=0.62+daylight*(SHADOW_CALIBRATION.sunStrength-0.62);
    main.current.color.copy(nightMoon).lerp(daySun,daylight)
      .lerp(morningSun,morning*0.65).lerp(warmSun,warmth*0.85);
    main.current.position.set(px+SUN_OFFSET.x,SUN_OFFSET.y,pz+SUN_OFFSET.z);
    main.current.target.position.set(px,0,pz);
    main.current.target.updateMatrixWorld();
    ambient.current.intensity=0.64+daylight*0.48;
    ambient.current.color.set('#9bb8dc').lerp(daylightAmbient,daylight)
      .lerp(morningAmbient,morning*0.48).lerp(warmAmbient,warmth*0.6);
    hemisphere.current.intensity=0.36+daylight*0.28;
    sky.copy(nightSky).lerp(daySky,daylight)
      .lerp(morningSky,morning*0.25).lerp(warmSky,warmth*0.35);
    scene.background=sky;
    if(scene.fog instanceof THREE.Fog){
      scene.fog.color.copy(sky);
      scene.fog.near=18+daylight*5;
      scene.fog.far=45+daylight*20;
    }
    village.current.intensity=0.35+night*2.1;

    if(clock.elapsedTime-lastCull.current>0.2){
      lastCull.current=clock.elapsedTime;
      setTownLightSources(townSources.filter(source=>
        Math.hypot(source.x-px,source.z-pz)<source.reach+3)
        .sort((a,b)=>
          (a.x-px)**2+(a.z-pz)**2-(b.x-px)**2-(b.z-pz)**2));
      const visible=visibleLightIds(camera,allSources,active.current,3.5,7);
      const next=visible.length<=LIGHT_POOL_SIZE?visible:visible
        .sort((a,b)=>{
          const first=sourceById.get(a)!,second=sourceById.get(b)!;
          const distance=(source:SceneLightSource)=>
            (source.x-camera.position.x)**2+(source.z-camera.position.z)**2;
          return distance(first)-distance(second);
        }).slice(0,LIGHT_POOL_SIZE);
      const selected=new Set(next);
      for(const [id,slot] of assignments.current)if(!selected.has(id)){
        assignments.current.delete(id);
        lightSlots.current[slot]=null;
      }
      for(const id of next)if(!assignments.current.has(id)){
        const slot=lightSlots.current.findIndex(source=>source===null);
        if(slot<0)continue;
        assignments.current.set(id,slot);
        lightSlots.current[slot]=sourceById.get(id)!;
      }
      active.current=selected;
    }
    for(let slot=0;slot<LIGHT_POOL_SIZE;slot++){
      const light=lights.current[slot];
      const glow=glowMeshes.current[slot];
      if(!light||!glow)continue;
      const source=lightSlots.current[slot];
      if(!source){light.intensity=0;glow.visible=false;continue;}
      const card=source.kind==='card';
      light.position.set(source.x,source.y,source.z);
      light.color.set(source.color);
      light.distance=source.reach;
      light.intensity=card?0.5+night*0.55:
        source.kind==='lamp'?0.28+night*2.8:
        source.kind==='house'?0.28+night*2.5:0.25+night*2.05;
      glow.visible=true;
      glow.position.set(source.x,source.groundY,source.z);
      glow.scale.setScalar(card?2.4:source.reach*0.7);
      const material=glowMaterials[slot];
      material.uniforms.uColor.value.set(source.color);
      material.uniforms.uOpacity.value=card?0.1+night*0.28:
        source.kind==='shrine'?0.035+night*0.32:0.015+night*0.105;
    }
    // The sun keeps a fixed direction. Its shadow depth map only needs to
    // follow the player when the light's coverage has moved far enough.
    const shadow=lastShadow.current;
    const minInterval=quality==='low'?0.75:0.5;
    const minDistance=quality==='low'?1.2:0.8;
    if(!Number.isFinite(shadow.x)||
      (clock.elapsedTime-shadow.at>minInterval&&Math.hypot(px-shadow.x,pz-shadow.z)>minDistance)){
      gl.shadowMap.needsUpdate=true;
      shadow.x=px;shadow.z=pz;shadow.at=clock.elapsedTime;
    }
  });

  return <group>
    <ambientLight ref={ambient} intensity={0.6}/>
    <hemisphereLight ref={hemisphere} args={['#c7e0ec','#615f51',0.45]}/>
    <directionalLight ref={main} intensity={1.4} position={[SUN_OFFSET.x,SUN_OFFSET.y,SUN_OFFSET.z]} castShadow
      shadow-mapSize={[quality==='high'?1024:512,quality==='high'?1024:512]}
      shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22}
      shadow-camera-near={0.5} shadow-camera-far={135} shadow-bias={-0.00025} shadow-normalBias={0.006}/>
    <pointLight ref={village} position={[48,3,53]} color="#f5c997" distance={14} decay={2} intensity={1}/>
    {lightPool}
    {glowMaterials.map((material,slot)=><mesh key={slot} ref={mesh=>{glowMeshes.current[slot]=mesh;}}
      geometry={glowGeometry} material={material} visible={false}
      rotation={[-Math.PI/2,0,0]} renderOrder={5}/>)}
  </group>;
}
