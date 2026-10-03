import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cameraZoom, captureCameraZoom, perspectiveFovForZoom, victoryCameraZoom } from './cameraZoom';
import { CAMERA_OFFSET, SPRITE_FACING, SPRITE_RIGHT, SPRITE_UP, spriteSurfaceOffset } from './camera';
import { BATTLE_RECALL_END_SECONDS, BATTLE_ZOOM_OUT_END_SECONDS, CAPTURE_RECALL_END_SECONDS, CAPTURE_ZOOM_OUT_END_SECONDS } from '../game/game';

describe('enquadramento da câmera',()=>{
  it('aproxima a arena em desktop e celular horizontal',()=>{
    expect(cameraZoom(1280,800,true)).toBeGreaterThan(cameraZoom(1280,800,false));
    expect(cameraZoom(844,390,true)).toBeGreaterThan(cameraZoom(844,390,false));
  });
  it('mantém a exploração próxima do herói em desktop e celular',()=>{
    expect(cameraZoom(1280,800,false)).toBe(102);
    expect(cameraZoom(844,390,false)).toBe(73);
    expect(cameraZoom(390,844,false)).toBe(83);
    expect(cameraZoom(844,390,true)).toBeGreaterThan(cameraZoom(844,390,false));
  });
  it.each([[1280,720],[844,390]])('mostra objetos abaixo menores ao subir em %ix%i',(width,height)=>{
    const zoom=cameraZoom(width,height,false);
    const high=4*0.85;
    const camera=new THREE.PerspectiveCamera(perspectiveFovForZoom(height,zoom,CAMERA_OFFSET.length()),width/height,0.1,150);
    camera.position.copy(CAMERA_OFFSET).add(new THREE.Vector3(0,high,0));
    camera.lookAt(0,high,0);
    camera.updateMatrixWorld();
    const right=new THREE.Vector3(Math.SQRT1_2,0,-Math.SQRT1_2);
    const projectedWidth=(y:number)=>{
      const left=right.clone().multiplyScalar(-0.5).setY(y).project(camera);
      const opposite=right.clone().multiplyScalar(0.5).setY(y).project(camera);
      return (opposite.x-left.x)*width/2;
    };
    expect(projectedWidth(high)).toBeCloseTo(zoom,5);
    expect(projectedWidth(0)).toBeLessThan(projectedWidth(high)*0.9);
    expect(new THREE.Vector3(0,0,0).project(camera).y).toBeLessThan(
      new THREE.Vector3(0,high,0).project(camera).y);
  });
  it('mantém um PNG grande sem deformação e apoia seu último pixel no terreno',()=>{
    const camera=new THREE.PerspectiveCamera(20,16/9,0.1,150);
    camera.position.copy(CAMERA_OFFSET);
    camera.lookAt(0,0,0);
    camera.updateMatrixWorld();
    const size=6.6,footV=0.02;
    const foot=new THREE.Vector3(0,0,0);
    const center=foot.clone().addScaledVector(SPRITE_UP,size*(0.5-footV));
    const right=new THREE.Vector3(1,0,0).applyQuaternion(SPRITE_FACING);
    const pixelFoot=center.clone().addScaledVector(SPRITE_UP,size*(footV-0.5));
    expect(pixelFoot.distanceTo(foot)).toBeLessThan(1e-10);
    expect(pixelFoot.clone().project(camera).distanceTo(foot.clone().project(camera))).toBeLessThan(1e-10);
    const projectedWidth=(y:number)=>{
      const left=center.clone().addScaledVector(SPRITE_UP,y).addScaledVector(right,-size/2).project(camera);
      const opposite=center.clone().addScaledVector(SPRITE_UP,y).addScaledVector(right,size/2).project(camera);
      return opposite.x-left.x;
    };
    expect(projectedWidth(size/2)).toBeCloseTo(projectedWidth(-size/2),6);
  });
  it('mantém um ponto de pouso colado ao pixel do asset quando a câmera se desloca',()=>{
    const size=6.25,footV=0.023,u=318/512,v=152/512;
    const ground=new THREE.Vector3(48.5,0.1,51.5);
    const anchor=ground.clone().add(spriteSurfaceOffset(size,footV,u,v));
    const center=ground.clone().addScaledVector(SPRITE_UP,size*(0.5-footV));
    const pixel=center.addScaledVector(SPRITE_RIGHT,size*(u-0.5))
      .addScaledVector(SPRITE_UP,size*(0.5-v));
    for(const pan of [new THREE.Vector3(),new THREE.Vector3(4,0,-3)]){
      const camera=new THREE.PerspectiveCamera(35,16/9,0.1,150);
      camera.position.copy(CAMERA_OFFSET).add(ground).add(pan);
      camera.lookAt(ground.clone().add(pan));
      camera.updateMatrixWorld();
      expect(anchor.clone().project(camera).distanceTo(pixel.clone().project(camera)))
        .toBeLessThan(1e-10);
    }
  });
  it.each([[1280,800],[844,390]])('espera a carta voltar antes de afastar do herói em %ix%i',(width,height)=>{
    const close=victoryCameraZoom(width,height,BATTLE_RECALL_END_SECONDS);
    expect(close).toBeGreaterThan(cameraZoom(width,height,true));
    expect(victoryCameraZoom(width,height,BATTLE_RECALL_END_SECONDS-0.1)).toBe(close);
    expect(victoryCameraZoom(width,height,3.1)).toBeLessThan(close);
    expect(victoryCameraZoom(width,height,BATTLE_ZOOM_OUT_END_SECONDS)).toBe(cameraZoom(width,height,false));
  });
  it('mantém o enquadramento da captura até o companheiro virar carta',()=>{
    const close=captureCameraZoom(1280,800,CAPTURE_RECALL_END_SECONDS);
    expect(close).toBeGreaterThan(cameraZoom(1280,800,true));
    expect(captureCameraZoom(1280,800,CAPTURE_RECALL_END_SECONDS-0.1)).toBe(close);
    expect(captureCameraZoom(1280,800,CAPTURE_ZOOM_OUT_END_SECONDS)).toBe(cameraZoom(1280,800,false));
  });
});
