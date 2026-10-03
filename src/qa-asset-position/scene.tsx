import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE_ATLAS } from '../game/biomeArt';
import { imageTexture, terrainAtlas } from '../render/art';
import { CAMERA_OFFSET, SPRITE_FACING, SPRITE_UP } from '../render/camera';
import { projectedShadowMaterial, setProjectedShadowOpacity } from '../render/ProjectedShadows';
import { flatShadowGeometry, samples, type SampleAsset } from '../qa-shadows/scene';
import { groupShadowOffset, type ShadowSettings } from '../qa-shadows/settings';
import { groundOnlyOverlay, groundingDepthBias, markGroundStencil, markSpriteStencil } from '../render/assetPositionCalibration';
import { withSpriteDepth } from '../render/spriteDepth';
import type { PositionSettings, StageFocus } from './settings';

const GROUND = 0.1;

function groundGeometry(): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let z = -10; z < 10; z++) for (let x = -13; x < 13; x++) {
    const atlas = x < -3 ? TILE_ATLAS.base.city : z > 2 ? TILE_ATLAS.base.meadow : TILE_ATLAS.base.forest;
    const column = atlas % TILE_ATLAS.columns, row = Math.floor(atlas / TILE_ATLAS.columns);
    const u0 = column / TILE_ATLAS.columns + 0.001, u1 = (column + 1) / TILE_ATLAS.columns - 0.001;
    const v0 = 1 - (row + 1) / TILE_ATLAS.rows + 0.001, v1 = 1 - row / TILE_ATLAS.rows - 0.001;
    const start = positions.length / 3;
    positions.push(x, GROUND, z, x + 1, GROUND, z, x + 1, GROUND, z + 1, x, GROUND, z + 1);
    uvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
    indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function PositionMarker({asset, height, depth}: {asset: SampleAsset; height: number; depth: number}) {
  const moved = Math.abs(height) > 0.001 || Math.abs(depth) > 0.001;
  const radius = asset.group === 'casas' ? 0.17 : 0.095;
  return <>
    <mesh position={[asset.x, GROUND + 0.045, asset.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
      <ringGeometry args={[radius * 0.68, radius, 24]}/>
      <meshBasicMaterial color="#ffcd71" depthTest={false} depthWrite={false}/>
    </mesh>
    {moved && <mesh position={[asset.x, GROUND + height + 0.05, asset.z + depth]}
      rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
      <ringGeometry args={[radius * 0.72, radius * 1.2, 24]}/>
      <meshBasicMaterial color="#69edec" depthTest={false} depthWrite={false}/>
    </mesh>}
  </>;
}

function Sample({asset, settings, shadows}: {asset: SampleAsset; settings: PositionSettings; shadows: ShadowSettings}) {
  const texture = useMemo(() => imageTexture(asset.path, asset.smooth || asset.group === 'casas'), [asset.path, asset.smooth, asset.group]);
  const footV = (texture.userData.footV as number | undefined) ?? 0;
  const height = settings.heightY[asset.group], depth = settings.depthZ[asset.group];
  const inFrontOfTerrain = settings.frontGroups[asset.group] || settings.frontAssetIds.includes(asset.id);
  const center = useMemo(() => new THREE.Vector3(asset.x, GROUND + height, asset.z + depth)
    .addScaledVector(SPRITE_UP, asset.size * (0.5 - footV)), [asset.x, asset.z, asset.size, footV, height, depth]);
  const material = useMemo(() => markSpriteStencil(withSpriteDepth(new THREE.MeshLambertMaterial({
    map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 0.3,
    transparent: true, alphaTest: asset.group === 'personagens' ? 0.45 : 0.18,
    side: THREE.DoubleSide, depthTest: true, depthWrite: true
  }))), [texture, asset.group]);
  // A second pass fills only pixels where the ground was visible. Other sprites
  // mark their visible pixels with stencil 2, so they keep their normal overlap.
  const groundOverlay = useMemo(() => inFrontOfTerrain ? groundOnlyOverlay(withSpriteDepth(new THREE.MeshLambertMaterial({
    map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 0.3,
    transparent: true, alphaTest: asset.group === 'personagens' ? 0.45 : 0.18,
    side: THREE.DoubleSide
  }), groundingDepthBias(height))) : null, [texture, asset.group, inFrontOfTerrain, height]);
  const shadowGeometry = useMemo(() => flatShadowGeometry({...asset, z: asset.z + depth}, footV, shadows),
    [asset, depth, footV, shadows]);
  const shadowMaterial = useMemo(() => {
    const shadow = projectedShadowMaterial(texture);
    shadow.uniforms.uAlphaCut.value = asset.group === 'personagens' ? 0.45 : 0.18;
    return shadow;
  }, [texture, asset.group]);
  useEffect(() => {
    shadowMaterial.uniforms.uFootGain.value = shadows.footGain;
    shadowMaterial.uniforms.uEdgeSoftness.value = shadows.softness;
  }, [shadowMaterial, shadows.footGain, shadows.softness]);
  const shadowOffset = groupShadowOffset(shadows, asset.group);
  useEffect(() => () => {
    material.dispose(); groundOverlay?.dispose(); shadowGeometry.dispose(); shadowMaterial.dispose();
  }, [material, groundOverlay, shadowGeometry, shadowMaterial]);
  return <group>
    {shadows.showShadows && <mesh geometry={shadowGeometry} material={shadowMaterial} renderOrder={1}/>}
    <mesh position={center} quaternion={SPRITE_FACING} material={material} renderOrder={2}>
      <planeGeometry args={[asset.size, asset.size]}/>
    </mesh>
    {groundOverlay && <mesh position={center} quaternion={SPRITE_FACING} material={groundOverlay} renderOrder={7}>
      <planeGeometry args={[asset.size, asset.size]}/>
    </mesh>}
    {settings.showAnchors && <PositionMarker asset={asset} height={height} depth={depth}/>}
    {shadows.showAnchors && <mesh position={[asset.x + shadowOffset.x, GROUND + 0.07,
      asset.z + depth + shadowOffset.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={12}>
      <ringGeometry args={[0.16, 0.2, 24]}/>
      <meshBasicMaterial color="#d7a3ff" depthTest={false} depthWrite={false}/>
    </mesh>}
  </group>;
}

function LabCamera({zoom, focus}: {zoom: number; focus: StageFocus}) {
  const {camera, size} = useThree();
  useEffect(() => {
    const target = focus === 'casas' ? new THREE.Vector3(-6.2, 1.4, 0.8) :
      focus === 'personagens' ? new THREE.Vector3(2.1, 0.5, 5.2) :
      focus === 'arvores' ? new THREE.Vector3(5.7, 1, -2.2) :
      focus === 'pedras' ? new THREE.Vector3(6.3, 0.5, 3) :
      focus === 'plantas' ? new THREE.Vector3(-1.3, 0.5, 4.7) :
      focus === 'objetos' ? new THREE.Vector3(3, 0.7, 2) : new THREE.Vector3(0, 0.9, 0);
    if (camera instanceof THREE.OrthographicCamera) {
      const focusZoom = focus === 'personagens' ? 1.5 : focus === 'todos' ? 0.86 : focus === 'casas' ? 1.12 : 1.25;
      camera.zoom = zoom * focusZoom * Math.min(1, Math.max(0.57, size.height / 690));
      camera.updateProjectionMatrix();
    }
    camera.position.copy(CAMERA_OFFSET).add(target);
    camera.lookAt(target);
  }, [camera, size.height, zoom, focus]);
  return null;
}

function LabContent({settings, shadows, focus}: {settings: PositionSettings; shadows: ShadowSettings; focus: StageFocus}) {
  const floor = useMemo(groundGeometry, []);
  const floorMaterial = useMemo(() => markGroundStencil(new THREE.MeshLambertMaterial({
    map: terrainAtlas(), side: THREE.DoubleSide
  })), []);
  useEffect(() => () => {floor.dispose(); floorMaterial.dispose();}, [floor, floorMaterial]);
  useEffect(() => setProjectedShadowOpacity(shadows.opacity), [shadows.opacity]);
  const azimuth = THREE.MathUtils.degToRad(shadows.azimuth);
  const elevation = THREE.MathUtils.degToRad(shadows.elevation);
  const sunRadius = 32 * Math.cos(elevation);
  const sunX = (Math.cos(azimuth) + Math.sin(azimuth)) * Math.SQRT1_2;
  const sunZ = (Math.cos(azimuth) - Math.sin(azimuth)) * Math.SQRT1_2;
  return <>
    <color attach="background" args={['#9ebfc4']}/>
    <LabCamera zoom={settings.zoom} focus={focus}/>
    <ambientLight intensity={0.8}/>
    <hemisphereLight args={['#d4e5e8', '#746652', 0.47]}/>
    <directionalLight position={[-sunX * sunRadius, 32 * Math.sin(elevation), -sunZ * sunRadius]}
      intensity={shadows.sunStrength} color="#fff0cc"/>
    <mesh geometry={floor} material={floorMaterial}/>
    {samples.filter(asset => focus === 'todos' || asset.group === focus)
      .map(asset => <Sample key={asset.id} asset={asset} settings={settings} shadows={shadows}/>)}
  </>;
}

export function AssetPositionScene({settings, shadows, focus}: {settings: PositionSettings; shadows: ShadowSettings; focus: StageFocus}) {
  return <Canvas orthographic dpr={[1, 1.75]} gl={{antialias: false, stencil: true, powerPreference: 'high-performance'}}
    camera={{position: [13, 17, 13], zoom: settings.zoom, near: 0.1, far: 100}}>
    <LabContent settings={settings} shadows={shadows} focus={focus}/>
  </Canvas>;
}
