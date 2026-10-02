export const TREE_WIND = {
  tree: { frames: 6, duration: 1.65 },
  willow: { frames: 6, duration: 2.0 },
  pine: { frames: 4, duration: 2.15 },
  'copper-tree': { frames: 6, duration: 1.75 },
  'marsh-willow': { frames: 6, duration: 2.1 }
} as const;

export type TreeWindAsset = keyof typeof TREE_WIND;
export const TREE_WIND_PHASES = 4;
const TREE_ASSETS = Object.keys(TREE_WIND) as TreeWindAsset[];
const PHASE_SPEED = [0.96, 1.04, 1, 1.08] as const;

export function treeWindConfig(asset: string): (typeof TREE_WIND)[TreeWindAsset] | null {
  return Object.hasOwn(TREE_WIND, asset) ? TREE_WIND[asset as TreeWindAsset] : null;
}

export function treeWindBucket(asset: TreeWindAsset, x: number, z: number): number {
  let seed = Math.imul(x + 1, 73856093) ^ Math.imul(z + 1, 19349663) ^
    Math.imul(TREE_ASSETS.indexOf(asset) + 1, 83492791);
  seed ^= seed >>> 16;
  seed = Math.imul(seed, 0x7feb352d);
  seed ^= seed >>> 15;
  return (seed >>> 0) % TREE_WIND_PHASES;
}

export function treeWindFrame(asset: TreeWindAsset, elapsed: number, phaseBucket: number): number {
  const { frames, duration } = TREE_WIND[asset];
  const phase = phaseBucket / TREE_WIND_PHASES;
  const cycle = elapsed / (duration * PHASE_SPEED[phaseBucket]) + phase;
  return Math.floor((cycle % 1) * frames);
}
