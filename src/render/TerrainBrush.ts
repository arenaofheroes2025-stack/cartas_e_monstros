import * as THREE from 'three';
import { tileAt, type Tile, type WorldData, WORLD_SIZE } from '../game/world';

function hash(x: number, z: number, seed: number): number {
  let value = Math.imul(x + seed, 73856093) ^ Math.imul(z - seed, 19349663);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value >>> 0) / 4294967295;
}

function noise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const north = THREE.MathUtils.lerp(hash(ix, iz, seed), hash(ix + 1, iz, seed), sx);
  const south = THREE.MathUtils.lerp(hash(ix, iz + 1, seed), hash(ix + 1, iz + 1, seed), sx);
  return THREE.MathUtils.lerp(north, south, sz);
}

function smoothstep(a: number, b: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function nearbyWater(world: WorldData, x: number, z: number): number {
  let nearest = 4;
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    if (tileAt(world, x + dx, z + dz)?.terrain === 'water')
      nearest = Math.min(nearest, Math.hypot(dx, dz));
  }
  return 1 - THREE.MathUtils.clamp((nearest - 1) / 2.5, 0, 1);
}

function interiorWeight(world: WorldData, x: number, z: number): number {
  const center = tileAt(world, x, z)!;
  let different = 0;
  for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
    const other = tileAt(world, x + dx, z + dz);
    if (other && other.biome !== center.biome) different++;
  }
  return 1 - different * 0.23;
}

function isTownStone(world: WorldData, tile: Tile): boolean {
  if (tile.terrain === 'plaza') return !world.places.some(place =>
    place.kind === 'shrine' && Math.hypot(place.x - tile.x, place.z - tile.z) < 3);
  if (tile.terrain !== 'path') return false;
  if (Math.hypot(world.start.x - tile.x, world.start.z - tile.z) < 12) return true;
  return world.places.some(place => place.kind === 'house' &&
    Math.hypot(place.x - tile.x, place.z - tile.z) < 5) ||
    world.decorations.some(place => place.id.startsWith('casa-') &&
      Math.hypot(place.x - tile.x, place.z - tile.z) < 5);
}

// One RGBA mask for the entire world. Linear texture sampling feathers the
// painted layers across tile boundaries; no per-tile random atlas swaps.
export function terrainBrushPixels(world: WorldData): Uint8Array {
  const pixels = new Uint8Array(WORLD_SIZE * WORLD_SIZE * 4);
  for (let z = 0; z < WORLD_SIZE; z++) for (let x = 0; x < WORLD_SIZE; x++) {
    const tile = tileAt(world, x, z)!;
    const i = (z * WORLD_SIZE + x) * 4;
    if (tile.terrain === 'water' || tile.terrain === 'bridge' || tile.terrain === 'plaza' || tile.terrain === 'ramp') continue;
    const interior = interiorWeight(world, x, z);
    // R: bare dirt road; G: broad habitat clusters; B: water/terrain edge;
    // A: smaller infrequent accents. The road is composited last.
    const path = tile.terrain === 'path' && !isTownStone(world, tile) ? 1 : 0;
    const forestRibbon = 1 - smoothstep(0.025, 0.13,
      Math.abs(noise(x / 18, z / 18, world.seed + 177) - 0.52));
    const dense = tile.biome === 'bosque'
      ? Math.max(smoothstep(0.47, 0.71, noise(x / 11, z / 11, world.seed + 611)) * 0.6,
        forestRibbon * 0.61) * interior
      : smoothstep(0.46, 0.72, noise(x / 11, z / 11, world.seed + 611)) * 0.67 * interior;
    const shore = nearbyWater(world, x, z);
    const terrainDetail = tile.height >= 2 ? 0.27 : 0.07;
    const feature = tile.biome === 'bosque'
      ? Math.max(smoothstep(0.48, 0.71, noise(x / 13, z / 13, world.seed + 977)) * 0.49,
        shore * 0.2) * interior
      : Math.max(shore * 0.52, terrainDetail * noise(x / 6, z / 6, world.seed + 977)) * interior;
    const accent = smoothstep(0.64, 0.83, noise(x / 5, z / 5, world.seed + 1327)) * 0.38 * interior;
    pixels[i] = Math.round(path * 255);
    pixels[i + 1] = Math.round(dense * 255);
    pixels[i + 2] = Math.round(feature * 255);
    pixels[i + 3] = Math.round(accent * 255);
  }
  return pixels;
}

// City stone is a fifth brush layer. Its coverage follows connected plaza and
// town-street tiles, then scatters into neighboring grass instead of exposing
// the generator's square plaza footprint.
export function urbanBrushPixels(world: WorldData): Uint8Array {
  const pixels = new Uint8Array(WORLD_SIZE * WORLD_SIZE * 4);
  for (let z = 0; z < WORLD_SIZE; z++) for (let x = 0; x < WORLD_SIZE; x++) {
    const tile = tileAt(world, x, z)!;
    const i = (z * WORLD_SIZE + x) * 4;
    if (tile.terrain === 'water' || tile.terrain === 'bridge' || tile.terrain === 'ramp') continue;
    const center = isTownStone(world, tile);
    const adjacent = !center && [[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dz])=>{
      const neighbor = tileAt(world, x + dx, z + dz);
      return neighbor && isTownStone(world, neighbor);
    });
    const scatter = noise(x / 2.8, z / 2.8, world.seed + 1701);
    const coverage = center ? 1 : adjacent ? 0.12 + 0.3 * scatter : 0;
    pixels[i] = Math.round(coverage * 255);
    pixels[i + 3] = 255;
  }
  return pixels;
}

export function terrainBrushTexture(world: WorldData): THREE.DataTexture {
  return brushTexture(terrainBrushPixels(world));
}

export function urbanBrushTexture(world: WorldData): THREE.DataTexture {
  return brushTexture(urbanBrushPixels(world));
}

function brushTexture(pixels: Uint8Array): THREE.DataTexture {
  const texture = new THREE.DataTexture(pixels, WORLD_SIZE, WORLD_SIZE, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
