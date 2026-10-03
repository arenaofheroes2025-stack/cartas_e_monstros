import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../game/game';
import { type ItemSpawn } from '../game/world';
import { itemArt } from '../game/items';
import { imageTexture } from './art';
import { makeProjectedShadowGeometry, projectedShadowMaterial, writeProjectedShadow } from './ProjectedShadows';

const SIZE=0.76;
function Pickup({game,item}:{game:Game;item:ItemSpawn}) {
  const mesh=useRef<THREE.Mesh>(null),shadow=useRef<THREE.Mesh>(null);
  const x=item.x+0.5,z=item.z+0.5;
  const texture=imageTexture(itemArt(item.itemId));
  const geometry=useMemo(()=>makeProjectedShadowGeometry(game.world!,[{x,z,y:game.getGroundHeight(x,z)+0.1}],SIZE,SIZE),[game.world,x,z]);
  const material=useMemo(()=>{const value=projectedShadowMaterial(texture,0.38);value.uniforms.uAlphaCut.value=0.2;return value;},[texture]);
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  useFrame(({camera})=>{
    if(!mesh.current||!shadow.current||!game.world)return;
    const visible=!!game.save&&game.world.items.some(active=>active.id===item.id)&&Math.hypot(x-game.player.x,z-game.player.z)<19;
    mesh.current.visible=shadow.current.visible=visible;
    if(!visible)return;
    const t=game.save!.elapsed;
    const lift=0.42+Math.sin(t*2.5+x*0.7+z)*0.09;
    mesh.current.position.set(x,game.getGroundHeight(x,z)+lift+0.4,z);
    mesh.current.quaternion.copy(camera.quaternion);
    material.uniforms.uOpacity.value=game.isNight?0.19:0.36;
    writeProjectedShadow(geometry,game.world,{x,z,y:game.getGroundHeight(x,z)+0.1},SIZE,SIZE,0,lift-0.3);
  });
  return <><mesh ref={shadow} geometry={geometry} material={material} renderOrder={3} frustumCulled={false}/>
    <mesh ref={mesh}><planeGeometry args={[SIZE,SIZE]}/><meshBasicMaterial map={texture} transparent alphaTest={0.1} side={THREE.DoubleSide} toneMapped={false}/></mesh></>;
}
export function ItemPickups({game}:{game:Game}) {return <group>{game.world?.items.map(item=><Pickup key={item.id} game={game} item={item}/>)}</group>;}
