import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE_ATLAS } from '../game/biomeArt';
import { placeSize, PROP_SIZE } from '../game/assets';
import { imageTexture, terrainAtlas } from '../render/art';
import { CAMERA_OFFSET, SPRITE_PITCH_COMPENSATION } from '../render/camera';
import { projectedShadowMaterial, setProjectedShadowOpacity, SHADOW_SEGMENTS } from '../render/ProjectedShadows';
import { groupShadowOffset, groupShadowValues, type ShadowSettings, type ShadowGroup, type StageFocus } from './settings';

const GROUND = 0.1;
const facing = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);

export interface SampleAsset {
  id: string;
  label: string;
  path: string;
  size: number;
  x: number;
  z: number;
  group: ShadowGroup;
  smooth?: boolean;
}

export const samples: SampleAsset[] = [
  {id:'house-cards',label:'Casa das Cartas',path:'/art/environment/casa-cartas.png',size:placeSize({kind:'house',id:'casa-cartas',x:0,z:0} as Parameters<typeof placeSize>[0]),x:-6.2,z:-3.5,group:'casas'},
  {id:'house-village',label:'Casa da Vila',path:'/art/environment/casa-vila.png',size:6.25,x:-6.2,z:0.8,group:'casas'},
  {id:'house-healing',label:'Casa de Cura',path:'/art/environment/casa-cura.png',size:6.25,x:-6.2,z:5.1,group:'casas'},
  {id:'tree',label:'Árvore',path:'/art/environment/tree.png',size:PROP_SIZE.tree,x:2.0,z:-4.4,group:'arvores'},
  {id:'pine',label:'Pinheiro',path:'/art/environment/pine.png',size:PROP_SIZE.pine,x:6.4,z:-3.3,group:'arvores'},
  {id:'willow',label:'Salgueiro',path:'/art/environment/willow.png',size:PROP_SIZE.willow,x:8.7,z:0.8,group:'arvores'},
  {id:'lamp',label:'Poste de Vila',path:'/art/environment/village-lamp.png',size:PROP_SIZE['village-lamp'],x:-0.5,z:0.1,group:'objetos'},
  {id:'lantern',label:'Lampião',path:'/art/environment/lamp.png',size:PROP_SIZE.lamp,x:2.1,z:0.7,group:'objetos'},
  {id:'well',label:'Poço',path:'/art/environment/well.png',size:PROP_SIZE.well,x:-0.8,z:3.3,group:'objetos'},
  {id:'bench',label:'Banco',path:'/art/environment/bench.png',size:PROP_SIZE.bench,x:3.6,z:3.2,group:'objetos'},
  {id:'crates',label:'Caixotes',path:'/art/environment/crates.png',size:PROP_SIZE.crates,x:6.4,z:4.2,group:'objetos'},
  {id:'rock',label:'Pedra',path:'/art/environment/rock.png',size:PROP_SIZE.rock,x:5.2,z:0.8,group:'pedras'},
  {id:'moss-rock',label:'Pedra com musgo',path:'/art/environment/moss-rock.png',size:PROP_SIZE['moss-rock'],x:7.4,z:2.0,group:'pedras'},
  {id:'basalt-rock',label:'Pedra de basalto',path:'/art/environment/basalt-rock.png',size:PROP_SIZE['basalt-rock'],x:4.8,z:4.5,group:'pedras'},
  {id:'mountain-boulder',label:'Pedregulho',path:'/art/environment/mountain-boulder.png',size:2.45,x:8.0,z:5.3,group:'pedras'},
  {id:'flower-bush',label:'Arbusto florido',path:'/art/environment/flower-bush.png',size:PROP_SIZE['flower-bush'],x:-4.0,z:4.4,group:'plantas'},
  {id:'bloom-bush',label:'Arbusto alto',path:'/art/environment/bloom-bush.png',size:PROP_SIZE['bloom-bush'],x:-1.2,z:2.5,group:'plantas'},
  {id:'forest-shrub',label:'Moita',path:'/art/environment/forest-shrub.png',size:1.7,x:1.1,z:4.4,group:'plantas'},
  {id:'flower-planter',label:'Floreira',path:'/art/environment/flower-planter.png',size:PROP_SIZE['flower-planter'],x:-3.0,z:6.7,group:'plantas'},
  {id:'glow-mushrooms',label:'Cogumelos',path:'/art/environment/glow-mushrooms.png',size:1.7,x:1.1,z:7.5,group:'plantas'},
  {id:'player',label:'Herói',path:'/art/people/player-idle.png',size:1.42,x:-1.4,z:6.3,group:'personagens'},
  {id:'npc',label:'NPC',path:'/art/people/artisan.png',size:1.42,x:1.0,z:6.3,group:'personagens',smooth:true},
  {id:'courier',label:'Mensageiro',path:'/art/people/courier-idle.png',size:1.42,x:3.4,z:6.3,group:'personagens',smooth:true},
  {id:'healer',label:'Curandeira',path:'/art/people/healer.png',size:1.42,x:5.8,z:6.3,group:'personagens',smooth:true},
  {id:'monster',label:'Brasito',path:'/art/creatures/brasito-idle.png',size:1.36,x:-1.4,z:4.2,group:'personagens'},
  {id:'musgato',label:'Musgato',path:'/art/creatures/musgato-idle.png',size:1.36,x:1.0,z:4.2,group:'personagens'},
  {id:'gotejo',label:'Gotejo',path:'/art/creatures/gotejo-idle.png',size:1.36,x:3.4,z:4.2,group:'personagens'}
];

function shadowDirection(settings: ShadowSettings): {x:number;z:number} {
  const angle = THREE.MathUtils.degToRad(settings.azimuth);
  return {
    x:(Math.cos(angle)+Math.sin(angle))*Math.SQRT1_2,
    z:(Math.cos(angle)-Math.sin(angle))*Math.SQRT1_2
  };
}

export function flatShadowGeometry(asset:SampleAsset, footV:number, settings:ShadowSettings):THREE.BufferGeometry {
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  const direction=shadowDirection(settings);
  const visualHeight=asset.size*SPRITE_PITCH_COMPENSATION;
  const baseHeight=Math.min(visualHeight,settings.casterHeight);
  const casterHeight=baseHeight*groupShadowValues(settings,asset.group).heightScale;
  const offset=groupShadowOffset(settings,asset.group);
  const slope=1/Math.tan(THREE.MathUtils.degToRad(settings.elevation));
  for(let row=0;row<=SHADOW_SEGMENTS;row++)for(let column=0;column<=SHADOW_SEGMENTS;column++){
    const u=column/SHADOW_SEGMENTS;
    const v=footV+(1-footV)*row/SHADOW_SEGMENTS;
    const across=(u-0.5)*asset.size*Math.SQRT1_2;
    const distance=(v-footV)*casterHeight*slope*settings.reach;
    positions.push(asset.x+offset.x+across+direction.x*distance,GROUND+0.026,
      asset.z+offset.z-across+direction.z*distance);
    uvs.push(u,v);
  }
  for(let row=0;row<SHADOW_SEGMENTS;row++)for(let column=0;column<SHADOW_SEGMENTS;column++){
    const a=row*(SHADOW_SEGMENTS+1)+column;
    indices.push(a,a+1,a+SHADOW_SEGMENTS+2,a,a+SHADOW_SEGMENTS+2,a+SHADOW_SEGMENTS+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function groundGeometry():THREE.BufferGeometry {
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  const atlas=TILE_ATLAS.base.city;
  const column=atlas%TILE_ATLAS.columns,row=Math.floor(atlas/TILE_ATLAS.columns);
  const u0=column/TILE_ATLAS.columns+0.001,u1=(column+1)/TILE_ATLAS.columns-0.001;
  const v0=1-(row+1)/TILE_ATLAS.rows+0.001,v1=1-row/TILE_ATLAS.rows-0.001;
  for(let z=-9;z<9;z++)for(let x=-12;x<12;x++){
    const start=positions.length/3;
    positions.push(x,GROUND,z,x+1,GROUND,z,x+1,GROUND,z+1,x,GROUND,z+1);
    uvs.push(u0,v1,u1,v1,u1,v0,u0,v0);
    indices.push(start,start+2,start+1,start,start+3,start+2);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Sample({asset,settings}:{asset:SampleAsset;settings:ShadowSettings}) {
  const texture=useMemo(()=>imageTexture(asset.path,asset.smooth),[asset.path,asset.smooth]);
  const footV=(texture.userData.footV as number|undefined)??0;
  const visualHeight=asset.size*SPRITE_PITCH_COMPENSATION;
  const objectOffset=groupShadowOffset(settings,asset.group);
  const geometry=useMemo(()=>flatShadowGeometry(asset,footV,settings),
    [asset,footV,settings.azimuth,settings.elevation,settings.casterHeight,settings.reach,
      settings.characterHeightScale,settings.characterShadowSide,settings.characterShadowDepth,
      settings.houseHeightScale,settings.houseShadowSide,settings.houseShadowDepth,
      settings.treeHeightScale,settings.treeShadowSide,settings.treeShadowDepth,
      settings.stoneHeightScale,settings.stoneShadowSide,settings.stoneShadowDepth,
      settings.plantHeightScale,settings.plantShadowSide,settings.plantShadowDepth,
      settings.propHeightScale,settings.propShadowSide,settings.propShadowDepth]);
  const shadow=useMemo(()=>projectedShadowMaterial(texture),[texture]);
  const body=useMemo(()=>new THREE.MeshLambertMaterial({map:texture,emissiveMap:texture,emissive:'#ffffff',
    emissiveIntensity:0.3,transparent:true,alphaTest:asset.group==='personagens'?0.45:0.18,
    side:THREE.DoubleSide,depthWrite:true}),[texture,asset.group]);
  useEffect(()=>()=>{geometry.dispose();},[geometry]);
  useEffect(()=>()=>{shadow.dispose();body.dispose();},[shadow,body]);
  useEffect(()=>{
    shadow.uniforms.uAlphaCut.value=asset.group==='personagens'?0.45:0.18;
    shadow.uniforms.uFootGain.value=settings.footGain;
    shadow.uniforms.uEdgeSoftness.value=settings.softness;
  },[shadow,asset.group,settings.footGain,settings.softness]);
  return <group>
    {settings.showShadows&&<mesh geometry={geometry} material={shadow} renderOrder={3}/>}
    <mesh position={[asset.x,GROUND+visualHeight*(0.5-footV),asset.z]} quaternion={facing} material={body}>
      <planeGeometry args={[asset.size,visualHeight]}/>
    </mesh>
    {settings.showAnchors&&<mesh position={[asset.x,GROUND+0.065,asset.z]} rotation={[-Math.PI/2,0,0]} renderOrder={5}>
      <ringGeometry args={[0.045,0.072,16]}/><meshBasicMaterial color="#fff2a6" depthTest={false} depthWrite={false}/>
    </mesh>}
    {settings.showAnchors&&
      (Math.abs(objectOffset.x)>0.001||Math.abs(objectOffset.z)>0.001)&&
      <mesh position={[asset.x+objectOffset.x,GROUND+0.067,asset.z+objectOffset.z]}
        rotation={[-Math.PI/2,0,0]} renderOrder={6}>
        <ringGeometry args={[0.075,0.105,20]}/>
        <meshBasicMaterial color="#75eced" depthTest={false} depthWrite={false}/>
      </mesh>}
  </group>;
}

function LabCamera({zoom,focus}:{zoom:number;focus:StageFocus}) {
  const {camera,size}=useThree();
  useEffect(()=>{
    const target=focus==='casas'?new THREE.Vector3(-6.2,1.4,0.8):
      focus==='personagens'?new THREE.Vector3(2.1,0.5,5.2):
      focus==='arvores'?new THREE.Vector3(5.7,1,-2.2):
      focus==='pedras'?new THREE.Vector3(6.3,0.5,3):
      focus==='plantas'?new THREE.Vector3(-1.3,0.5,4.7):
      focus==='objetos'?new THREE.Vector3(3,0.7,2):new THREE.Vector3(0,0.9,0);
    const focusZoom=focus==='personagens'?1.5:focus==='todos'?0.86:focus==='casas'?1.12:1.25;
    if(camera instanceof THREE.OrthographicCamera){
      camera.zoom=zoom*focusZoom*Math.min(1,Math.max(0.57,size.height/690));
      camera.updateProjectionMatrix();
    }
    camera.position.copy(CAMERA_OFFSET).add(target);
    camera.lookAt(target);
  },[camera,size.height,zoom,focus]);
  return null;
}

function LabContent({settings,focus}:{settings:ShadowSettings;focus:StageFocus}) {
  const floor=useMemo(groundGeometry,[]);
  const floorMaterial=useMemo(()=>new THREE.MeshLambertMaterial({map:terrainAtlas(),side:THREE.DoubleSide}),[]);
  useEffect(()=>()=>{floor.dispose();floorMaterial.dispose();},[floor,floorMaterial]);
  useEffect(()=>setProjectedShadowOpacity(settings.opacity),[settings.opacity]);
  const direction=shadowDirection(settings);
  const elevation=THREE.MathUtils.degToRad(settings.elevation);
  const radius=32*Math.cos(elevation);
  return <>
    <color attach="background" args={['#9ebfc4']}/>
    <LabCamera zoom={settings.zoom} focus={focus}/>
    <ambientLight intensity={0.78}/>
    <hemisphereLight args={['#d4e5e8','#746652',0.47]}/>
    <directionalLight position={[-direction.x*radius,32*Math.sin(elevation),-direction.z*radius]}
      intensity={settings.sunStrength} color="#fff0cc"/>
    <mesh geometry={floor} material={floorMaterial} receiveShadow/>
    {samples.filter(asset=>focus==='todos'||asset.group===focus).map(asset=><Sample key={asset.id} asset={asset} settings={settings}/>)}
  </>;
}

export function ShadowLabScene({settings,focus}:{settings:ShadowSettings;focus:StageFocus}) {
  return <Canvas orthographic dpr={[1,1.75]} gl={{antialias:false,powerPreference:'high-performance'}}
    camera={{position:[13,17,13],zoom:settings.zoom,near:0.1,far:100}}>
    <LabContent settings={settings} focus={focus}/>
  </Canvas>;
}
