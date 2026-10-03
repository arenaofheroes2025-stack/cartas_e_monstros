import * as THREE from 'three';
import { CAMERA_OFFSET } from './camera';
import { cameraOffsetForSettings, DEFAULT_CAMERA_LAB_SETTINGS, type CameraLabSettings } from './cameraLabSettings';

const depthSlope=CAMERA_OFFSET.y/Math.hypot(CAMERA_OFFSET.x,CAMERA_OFFSET.z);
const defaultSine=CAMERA_OFFSET.y/CAMERA_OFFSET.length();
const sharedSpriteUniforms={
  uSpriteDepthSlope:{value:depthSlope},
  uSpriteGroundBiasScale:{value:1},
  uSpriteWarpPitch:{value:0},
  uSpriteWarpYaw:{value:0},
  uSpriteStretch:{value:1}
};

/** Update billboard depth and the optional top-to-bottom camera-follow deformation. */
export function setSpriteCameraAppearance(settings:CameraLabSettings|null):void {
  if(!settings){
    sharedSpriteUniforms.uSpriteDepthSlope.value=depthSlope;
    sharedSpriteUniforms.uSpriteGroundBiasScale.value=1;
    sharedSpriteUniforms.uSpriteWarpPitch.value=0;
    sharedSpriteUniforms.uSpriteWarpYaw.value=0;
    sharedSpriteUniforms.uSpriteStretch.value=1;
    return;
  }
  const offset=cameraOffsetForSettings(settings);
  const sine=Math.max(0.1,offset.y/offset.length());
  sharedSpriteUniforms.uSpriteDepthSlope.value=offset.y/Math.hypot(offset.x,offset.z);
  sharedSpriteUniforms.uSpriteGroundBiasScale.value=defaultSine/sine;
  const warp=settings.spriteMode==='acompanhar'?settings.spriteWarp:0;
  sharedSpriteUniforms.uSpriteWarpPitch.value=THREE.MathUtils.degToRad(
    settings.elevation-DEFAULT_CAMERA_LAB_SETTINGS.elevation)*warp;
  sharedSpriteUniforms.uSpriteWarpYaw.value=THREE.MathUtils.degToRad(
    settings.azimuth-DEFAULT_CAMERA_LAB_SETTINGS.azimuth)*warp;
  sharedSpriteUniforms.uSpriteStretch.value=1+(settings.spriteStretch-1)*warp;
}

/** Keep artwork square to the screen while sorting its upper pixels at their 3D height. */
export function withSpriteDepth<T extends THREE.MeshLambertMaterial>(material:T,groundBias=0,footPivot=0):T {
  const compile=material.onBeforeCompile.bind(material);
  const cacheKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    compile(shader,renderer);
    Object.assign(shader.uniforms,sharedSpriteUniforms);
    shader.uniforms.uSpriteFootPivot={value:footPivot};
    shader.vertexShader=`uniform float uSpriteDepthSlope;
      uniform float uSpriteGroundBiasScale;
      uniform float uSpriteWarpPitch;
      uniform float uSpriteWarpYaw;
      uniform float uSpriteStretch;
      uniform float uSpriteFootPivot;\n${shader.vertexShader}`;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      float spriteFromFoot=max(0.0,transformed.y-uSpriteFootPivot);
      float spriteTop=clamp(spriteFromFoot/max(0.001,-2.0*uSpriteFootPivot),0.0,1.0);
      transformed.y+=spriteFromFoot*(mix(1.0,uSpriteStretch*cos(uSpriteWarpPitch),spriteTop)-1.0);
      transformed.z+=spriteFromFoot*sin(uSpriteWarpPitch)*spriteTop+transformed.x*sin(uSpriteWarpYaw)*spriteTop;
      transformed.x*=mix(1.0,cos(uSpriteWarpYaw),spriteTop);
    `);
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      #include <project_vertex>
      vec4 spriteCenterView = vec4(0.0, 0.0, 0.0, 1.0);
      #ifdef USE_INSTANCING
        spriteCenterView = instanceMatrix * spriteCenterView;
      #endif
      spriteCenterView = modelViewMatrix * spriteCenterView;
      float raisedDepth = mvPosition.z + max(0.0, mvPosition.y - spriteCenterView.y) * uSpriteDepthSlope + 0.02 + ${groundBias.toFixed(8)}*uSpriteGroundBiasScale;
      vec4 spriteDepthClip = projectionMatrix * vec4(0.0, 0.0, raisedDepth, 1.0);
      gl_Position.z = spriteDepthClip.z * gl_Position.w / spriteDepthClip.w;
    `);
  };
  material.customProgramCacheKey=()=>`${cacheKey()}-sprite-depth-v3-${groundBias.toFixed(4)}`;
  return material;
}
