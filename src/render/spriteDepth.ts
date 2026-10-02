import * as THREE from 'three';
import { CAMERA_OFFSET } from './camera';

const depthSlope=CAMERA_OFFSET.y/Math.hypot(CAMERA_OFFSET.x,CAMERA_OFFSET.z);

/** Keep artwork square to the screen while sorting its upper pixels at their 3D height. */
export function withSpriteDepth<T extends THREE.MeshLambertMaterial>(material:T):T {
  const compile=material.onBeforeCompile.bind(material);
  const cacheKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    compile(shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      #include <project_vertex>
      vec4 spriteCenterView = vec4(0.0, 0.0, 0.0, 1.0);
      #ifdef USE_INSTANCING
        spriteCenterView = instanceMatrix * spriteCenterView;
      #endif
      spriteCenterView = modelViewMatrix * spriteCenterView;
      float raisedDepth = mvPosition.z + max(0.0, mvPosition.y - spriteCenterView.y) * ${depthSlope.toFixed(8)} + 0.02;
      vec4 spriteDepthClip = projectionMatrix * vec4(0.0, 0.0, raisedDepth, 1.0);
      gl_Position.z = spriteDepthClip.z * gl_Position.w / spriteDepthClip.w;
    `);
  };
  material.customProgramCacheKey=()=>`${cacheKey()}-sprite-depth-v1`;
  return material;
}
