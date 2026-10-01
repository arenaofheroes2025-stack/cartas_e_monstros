import * as THREE from 'three';

export const CAMERA_OFFSET = new THREE.Vector3(13, 17, 13);
export const SPRITE_PITCH_COMPENSATION = CAMERA_OFFSET.length() / Math.hypot(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
