export type ShadowGroup = 'personagens'|'casas'|'arvores'|'pedras'|'plantas'|'objetos';

interface GroupCalibration {
  heightScale:number;
  side:number;
  depth:number;
}

// Approved in the shadow laboratory. Side/depth follow the fixed camera axes.
export const SHADOW_CALIBRATION = {
  azimuth:12,
  elevation:68,
  casterHeight:4.4,
  reach:1,
  opacity:0.48,
  footGain:1.2,
  softness:0.3,
  sunStrength:1.85,
  sunOffset:{x:-24.4,y:72,z:-15.84},
  groups:{
    personagens:{heightScale:0.9,side:0,depth:-0.05},
    casas:{heightScale:1.45,side:0,depth:-1.75},
    arvores:{heightScale:0.65,side:0.1,depth:-0.55},
    pedras:{heightScale:1.2,side:0,depth:-0.6},
    plantas:{heightScale:1.2,side:0.05,depth:-0.6},
    objetos:{heightScale:0.7,side:0.1,depth:-0.5}
  } satisfies Record<ShadowGroup,GroupCalibration>
} as const;

const trees=new Set(['tree','willow','pine','copper-tree','marsh-willow']);
const stones=new Set([
  'rock','moss-rock','basalt-rock','moss-boulder','fieldstone','mountain-boulder',
  'shale-fragments','mineral-cluster','scree-pile','basalt-shard','ash-heap',
  'obsidian-spire','lava-boulder','sandstone-boulder','sandstone-pillar',
  'desert-pebbles','frozen-boulder','ice-crystals','ice-block','wet-rock',
  'river-stones','rune-stone','magic-crystal','stalagmites','cave-boulder','geode'
]);
const plants=new Set([
  'flower-bush','flowers','bloom-bush','forest-shrub','field-flowers','grass-tuft',
  'root-cluster','fallen-log','field-stump','reeds','desert-thorn','swamp-reeds',
  'waterlogged-stump','lily-pads','driftwood','bank-grass','flower-planter',
  'glow-mushrooms','magic-flowers','cave-mushrooms'
]);

export function shadowGroupForAsset(asset:string):ShadowGroup {
  if(asset.startsWith('casa-')||asset==='woodcutter-hut'||asset==='boathouse')return 'casas';
  if(trees.has(asset))return 'arvores';
  if(stones.has(asset))return 'pedras';
  if(plants.has(asset))return 'plantas';
  return 'objetos';
}

export function shadowGroupOffset(group:ShadowGroup):{x:number;z:number} {
  const {side,depth}=SHADOW_CALIBRATION.groups[group];
  return {x:(side+depth)*Math.SQRT1_2,z:(depth-side)*Math.SQRT1_2};
}

export function calibratedCasterHeight(visualHeight:number,group:ShadowGroup):number {
  return Math.min(visualHeight,SHADOW_CALIBRATION.casterHeight)*SHADOW_CALIBRATION.groups[group].heightScale;
}
