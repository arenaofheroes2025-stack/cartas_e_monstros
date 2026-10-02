import type { Decoration, Place, Tile } from './world';
import { BIOME_PROP_SHEETS, type BiomeProp } from './biomeArt';

const BIOME_PROP_SIZE = Object.fromEntries(Object.values(BIOME_PROP_SHEETS).flat().map((id) => {
  const large = ['mountain-boulder','obsidian-spire','sandstone-pillar','ruin-column','ruin-arch','town-fountain','stalagmites','cave-boulder','ice-block'].includes(id);
  const tiny = ['grass-tuft','field-flowers','shale-fragments','desert-pebbles','snowdrift','lily-pads','bank-grass','shells','magic-flowers'].includes(id);
  return [id, large ? 2.45 : tiny ? 1.2 : 1.7];
})) as Record<BiomeProp,number>;

export const PROP_SIZE: Record<Exclude<Tile['prop'],null>|'willow',number> = {
  tree:4.65, willow:4.65, pine:4.8, 'copper-tree':4.7, 'marsh-willow':4.65,
  rock:1.75, 'moss-rock':1.8, 'basalt-rock':1.8,
  'flower-bush':1.5, reeds:1.5, flowers:1.05, lamp:2.55,
  'village-lamp':2.6, 'bloom-bush':2.25, bench:2.7, well:3.1,
  crates:2.5, 'flower-planter':2.4, 'carroca-mercador':3.2, 'arco-pedra':3.35,
  ...BIOME_PROP_SIZE
};

export function propAsset(tile:Tile):string|null {
  return tile.prop==='tree'&&tile.biome==='lago'?'willow':tile.prop;
}

export function placeSize(place:Place|Decoration):number {
  if(place.id==='casa-estalagem')return 8.2;
  if(place.id==='casa-pedra')return 6.6;
  if(place.id==='casa-caverna')return 6.1;
  return place.kind==='house'||place.id.startsWith('casa-')?6.25:place.kind==='decoration'?5.7:3.8;
}
