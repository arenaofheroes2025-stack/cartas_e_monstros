import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { generateWorld, tileAt } from '../game/world';
import { makeProjectedShadowGeometry, projectedPoint, projectedShadowMaterial, setProjectedShadowOpacity, shadowCasterHeight } from './ProjectedShadows';
import { reliefGeometry } from './GroundShadows';
import { SHADOW_CALIBRATION } from './shadowCalibration';
import { SUN_OFFSET } from './sun';
import { spriteFootV } from './spriteAnchors';

describe('sombras do sol',()=>{
  it('não permite que sombras de itens alterem a opacidade dos demais assets',()=>{
    const asset=projectedShadowMaterial(new THREE.Texture());
    const item=projectedShadowMaterial(new THREE.Texture(),0.38);
    try {
      setProjectedShadowOpacity(0.68);
      item.uniforms.uOpacity.value=0.36;
      expect(asset.uniforms.uOpacity.value).toBe(0.68);
      expect(item.uniforms.uOpacity.value).toBe(0.36);
    } finally {
      setProjectedShadowOpacity(SHADOW_CALIBRATION.opacity);
      asset.dispose();
      item.dispose();
    }
  });
  it('projeta a silhueta do próprio PNG na direção oposta ao sol',()=>{
    const world=generateWorld(40732);
    const origin={x:world.start.x+0.5,z:world.start.z+0.5,
      y:0.1+tileAt(world,world.start.x,world.start.z)!.height*0.85};
    const foot=projectedPoint(world,origin,1.4,2,0.5,0);
    const head=projectedPoint(world,origin,1.4,2,0.5,1);
    expect(SUN_OFFSET.x).toBeLessThan(0);
    expect(foot[0]).toBeCloseTo(origin.x,4);
    expect(foot[2]).toBeCloseTo(origin.z,4);
    expect(head[0]).toBeGreaterThan(foot[0]);
    expect(head[2]).toBeGreaterThan(foot[2]);
    expect(Math.hypot(head[0]-foot[0],head[2]-foot[2])).toBeCloseTo(
      2*SHADOW_CALIBRATION.reach/Math.tan(SHADOW_CALIBRATION.elevation*Math.PI/180),1);
    const geometry=makeProjectedShadowGeometry(world,[origin],1.4,2);
    expect(geometry.getAttribute('uv').count).toBe(36);
    expect(geometry.getAttribute('position').count).toBe(36);
    geometry.dispose();
    const material=projectedShadowMaterial(new THREE.Texture());
    expect(material.fragmentShader).toContain('texture2D(uTexture,sampleUv).a');
    material.dispose();
    const playerFoot=spriteFootV('/art/people/player.png');
    expect(playerFoot).toBeGreaterThan(0);
    const anchored=makeProjectedShadowGeometry(world,[origin],1.4,2,playerFoot);
    expect((anchored.getAttribute('uv') as THREE.BufferAttribute).getY(0)).toBeCloseTo(playerFoot,4);
    const first=(anchored.getAttribute('position') as THREE.BufferAttribute);
    expect(first.getX(0)).toBeCloseTo(origin.x-0.7*Math.SQRT1_2,4);
    expect(first.getZ(0)).toBeCloseTo(origin.z+0.7*Math.SQRT1_2,4);
    anchored.dispose();
  });
  it('mantém a base do sprite no chão e encurta a sombra de arte isométrica alta',()=>{
    const world=generateWorld(40732);
    const origin={x:world.start.x+0.5,z:world.start.z+0.5,
      y:0.1+tileAt(world,world.start.x,world.start.z)!.height*0.85};
    const houseHeight=7.8;
    const projected=shadowCasterHeight(houseHeight);
    expect(projected).toBe(SHADOW_CALIBRATION.casterHeight);
    const foot=projectedPoint(world,origin,6.25,projected,0.5,0);
    const roof=projectedPoint(world,origin,6.25,projected,0.5,1);
    expect(foot[0]).toBeCloseTo(origin.x,4);
    expect(foot[2]).toBeCloseTo(origin.z,4);
    expect(Math.hypot(roof[0]-foot[0],roof[2]-foot[2])).toBeLessThan(2.2);
    expect(shadowCasterHeight(2)).toBe(2);
  });
  it('desenha faixas no topo, na parede e no nível inferior de cada queda',()=>{
    const world=generateWorld(40732);
    const geometries=[];
    for(let z=0;z<6;z++)for(let x=0;x<6;x++)geometries.push(reliefGeometry(world,x,z));
    const active=geometries.find(geometry=>geometry.getAttribute('position').count>0);
    expect(active).toBeDefined();
    expect(active!.getAttribute('position').count%12).toBe(0);
    expect(active!.getAttribute('shadeAlpha').count).toBe(active!.getAttribute('position').count);
    geometries.forEach(geometry=>geometry.dispose());
  });
});
