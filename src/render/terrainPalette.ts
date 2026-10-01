import { BIOME_BRUSH_PROFILES, REGION_BIOME_PROFILE, TERRAIN_MATERIALS, TILE_ATLAS } from '../game/biomeArt';
import type { Tile, WorldData } from '../game/world';

type BiomeProfile = (typeof BIOME_BRUSH_PROFILES)[keyof typeof BIOME_BRUSH_PROFILES];

export function biomeProfile(tile: Tile): BiomeProfile {
  return BIOME_BRUSH_PROFILES[REGION_BIOME_PROFILE[tile.biome]];
}

function shrineSurface(world: WorldData, tile: Tile): number | undefined {
  const shrine = world.places.find(place => place.kind === 'shrine' &&
    Math.hypot(place.x - tile.x, place.z - tile.z) < 3);
  if (!shrine) return undefined;
  return shrine.element === 'natureza' ? TILE_ATLAS.biome.magic :
    shrine.element === 'fogo' ? TILE_ATLAS.biome.volcanic : TILE_ATLAS.biome.lakeside;
}

// Base surfaces are fixed for an entire biome. A path is painted in the shader;
// it does not swap the floor for a square road tile.
export function terrainIndex(world: WorldData, tile: Tile): number {
  if (tile.terrain === 'water') return TILE_ATLAS.base.water;
  if (tile.terrain === 'bridge') return TERRAIN_MATERIALS.bridge.top;
  if (tile.terrain === 'ramp') return TERRAIN_MATERIALS.ramp.top;
  if (tile.terrain === 'plaza') return shrineSurface(world, tile) ?? biomeProfile(tile).base;
  return biomeProfile(tile).base;
}

export function cliffIndex(world: WorldData, tile: Tile): number {
  if (tile.terrain === 'plaza') {
    const shrine = shrineSurface(world, tile);
    if (shrine === TILE_ATLAS.biome.magic) return TERRAIN_MATERIALS.magic.wall;
    if (shrine === TILE_ATLAS.biome.volcanic) return TERRAIN_MATERIALS.volcanic.wall;
    if (shrine === TILE_ATLAS.biome.lakeside) return TERRAIN_MATERIALS.lakeside.wall;
    return biomeProfile(tile).wall;
  }
  return biomeProfile(tile).wall;
}

export function overlayIndices(tile: Tile): [number, number, number, number] {
  const { path, dense, feature, accent } = biomeProfile(tile).layers;
  return [path, dense, feature, accent];
}
