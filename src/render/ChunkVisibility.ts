import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const CHUNK_SIZE = 16;

const projection = new THREE.Matrix4();
const frustum = new THREE.Frustum();
let currentCamera: THREE.Camera | null = null;
let currentFrame = -1;

function cameraFrustum(camera: THREE.Camera, frame: number): THREE.Frustum {
  if (camera !== currentCamera || frame !== currentFrame) {
    camera.updateMatrixWorld();
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    currentCamera = camera;
    currentFrame = frame;
  }
  return frustum;
}

export function useChunkVisibility(chunkX: number, chunkZ: number, margin = 5) {
  const group = useRef<THREE.Group>(null);
  const bounds = useRef(new THREE.Box3(
    new THREE.Vector3(chunkX * CHUNK_SIZE - margin, -0.5, chunkZ * CHUNK_SIZE - margin),
    new THREE.Vector3((chunkX + 1) * CHUNK_SIZE + margin, 8, (chunkZ + 1) * CHUNK_SIZE + margin)
  ));
  useFrame(({ camera, clock }) => {
    if (group.current) group.current.visible = cameraFrustum(camera, clock.elapsedTime).intersectsBox(bounds.current);
  });
  return group;
}
