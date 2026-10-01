import * as THREE from 'three';

export interface CullableLight { id:string;x:number;y:number;z:number;reach:number }

const matrix=new THREE.Matrix4();
const frustum=new THREE.Frustum();
const sphere=new THREE.Sphere();

export function visibleLightIds(camera:THREE.Camera,sources:CullableLight[],active:ReadonlySet<string>,enterMargin=3,exitMargin=6):string[] {
  camera.updateMatrixWorld();
  matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(matrix);
  return sources.filter(source=>{
    sphere.center.set(source.x,source.y,source.z);
    sphere.radius=source.reach+(active.has(source.id)?exitMargin:enterMargin);
    return frustum.intersectsSphere(sphere);
  }).map(source=>source.id);
}
