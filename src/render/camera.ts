import * as THREE from 'three';

export const CAMERA_OFFSET = new THREE.Vector3(10, 13, 10);
export const SPRITE_PITCH_COMPENSATION = CAMERA_OFFSET.length() / Math.hypot(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
// Sprite planes stay parallel to the screen. Their transparent foot pixel is
// placed on the terrain; perspective then changes size without skewing art.
export const SPRITE_FACING = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().lookAt(CAMERA_OFFSET,new THREE.Vector3(),new THREE.Vector3(0,1,0)));
export const SPRITE_UP = new THREE.Vector3(0,1,0).applyQuaternion(SPRITE_FACING);
