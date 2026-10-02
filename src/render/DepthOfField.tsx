import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { Game } from '../game/game';

const fragmentShader=`
  #include <packing>
  varying vec2 vUv;
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform float uFocus;
  uniform float uNear;
  uniform float uFar;
  uniform float uRadius;
  float sceneDistance(vec2 uv) {
    return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,uNear,uFar);
  }
  void main() {
    vec4 sharp=texture2D(tColor,vUv);
    float depth=sceneDistance(vUv);
    float nearBlur=1.0-smoothstep(uFocus-8.0,uFocus-2.0,depth);
    float farBlur=smoothstep(uFocus+3.0,uFocus+10.0,depth);
    float amount=max(nearBlur,farBlur);
    if(amount<0.01){gl_FragColor=sharp;}
    else {
      vec2 radius=uTexel*uRadius;
      vec4 sum=sharp*2.0;
      for(int i=0;i<4;i++){
        vec2 stepUv=i==0?vec2(radius.x,0.0):i==1?vec2(-radius.x,0.0):
          i==2?vec2(0.0,radius.y):vec2(0.0,-radius.y);
        vec2 uv=clamp(vUv+stepUv,vec2(0.0),vec2(1.0));
        sum+=texture2D(tColor,uv);
      }
      gl_FragColor=mix(sharp,sum/6.0,amount*0.9);
    }
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** One scene render and a small focus-aware screen pass; DOM HUD stays crisp. */
export function DepthOfField({game,quality}:{game:Game;quality:'high'|'low'}) {
  const {gl,scene,camera}=useThree();
  const drawingSize=useMemo(()=>new THREE.Vector2(),[]);
  const focusPoint=useMemo(()=>new THREE.Vector3(),[]);
  const dimensions=useRef({width:0,height:0});
  const {target,material,quad}=useMemo(()=>{
    const depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    depthTexture.minFilter=depthTexture.magFilter=THREE.NearestFilter;
    const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,depthTexture});
    const material=new THREE.ShaderMaterial({
      uniforms:{tColor:{value:target.texture},tDepth:{value:depthTexture},
        uTexel:{value:new THREE.Vector2()},uFocus:{value:19},uNear:{value:camera.near},
        uFar:{value:camera.far},uRadius:{value:1}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader,depthTest:false,depthWrite:false,toneMapped:false
    });
    return {target,material,quad:new FullScreenQuad(material)};
  },[camera]);
  useEffect(()=>()=>{quad.dispose();material.dispose();target.dispose();},[quad,material,target]);
  useFrame(()=>{
    gl.getDrawingBufferSize(drawingSize);
    const width=Math.max(1,Math.round(drawingSize.x)),height=Math.max(1,Math.round(drawingSize.y));
    if(dimensions.current.width!==width||dimensions.current.height!==height){
      target.setSize(width,height);
      material.uniforms.uTexel.value.set(1/width,1/height);
      dimensions.current={width,height};
    }
    const player=game.player;
    const battle=game.battle;
    focusPoint.set(battle?.center.x??player.x,
      game.getGroundHeight(battle?.center.x??player.x,battle?.center.z??player.z)+0.5,
      battle?.center.z??player.z);
    material.uniforms.uFocus.value=camera.position.distanceTo(focusPoint);
    material.uniforms.uNear.value=camera.near;
    material.uniforms.uFar.value=camera.far;
    material.uniforms.uRadius.value=(quality==='high'?3.4:2.65)*gl.getPixelRatio();
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene,camera);
    gl.setRenderTarget(null);
    quad.render(gl);
  },1);
  return null;
}
