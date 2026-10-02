// Row-major order in the three 4×4 source sheets. Keep this catalogue independent
// of the world generator so future regions can reuse the complete art library.
export const BIOME_PROP_SHEETS = {
  core: [
    'forest-shrub','fallen-log','root-cluster','moss-boulder',
    'field-flowers','grass-tuft','field-stump','fieldstone',
    'mountain-boulder','shale-fragments','mineral-cluster','scree-pile',
    'basalt-shard','ash-heap','obsidian-spire','lava-boulder'
  ],
  climate: [
    'desert-thorn','sandstone-boulder','sandstone-pillar','desert-pebbles',
    'snowdrift','frozen-boulder','ice-crystals','ice-block',
    'swamp-reeds','waterlogged-stump','wet-rock','lily-pads',
    'driftwood','bank-grass','river-stones','shells'
  ],
  culture: [
    'town-fountain','street-sign','market-barrel','market-crate',
    'ruin-column','ruin-block','ruin-arch','ruin-slab',
    'magic-crystal','rune-stone','glow-mushrooms','magic-flowers',
    'stalagmites','cave-boulder','geode','cave-mushrooms'
  ]
} as const;

export type BiomeProp = (typeof BIOME_PROP_SHEETS)[keyof typeof BIOME_PROP_SHEETS][number];

// The first two sheets are the original richly textured art. Extensions match it.
// Atlas rows: original foundations, original variants, new biomes, transitions, bare cliff faces.
export const TILE_ATLAS = {
  columns: 4,
  rows: 20,
  base: {forest:0,wet:1,dry:2,road:3,city:4,bridge:5,water:6,volcanic:8,volcanicWall:9,mossWall:10,waterAlt:11,earthWall:12,meadow:13,beach:14,ruins:15},
  variants: {forest:[16,17,18,19],wet:[20,21,22,23],volcanic:[24,25,26,27],road:[28,29,30,31]},
  biome: {forest:32,field:33,mountain:34,rocky:35,desert:36,volcanic:37,ice:38,swamp:39,riverbank:40,lakeside:41,beach:42,road:43,ruins:44,city:45,magic:46,cave:47},
  transition: {forestField:48,fieldDry:49,dryEarth:50,earthRock:51,earthDamp:52,dampMud:53,mudRiverbank:54,riverWater:55,fieldSnow:56,snowIce:57,snowMountain:58,iceLake:59,cityRoad:60,roadGrass:61,rockVolcanic:62,ruinMagic:63},
  walls: {earth:64,limestone:65,redBasalt:66,brownRock:67,slate:68,sandstone:69,ice:70,riverstone:71,peat:72,city:73,ruins:74,cave:75,obsidian:76,granite:77,beach:78,magic:79}
} as const;

// A ground family always declares its own independent, vegetation-free wall.
// Top surfaces never determine wall artwork by atlas row or by chance.
export const TERRAIN_MATERIALS = {
  forest:{top:TILE_ATLAS.base.forest,wall:TILE_ATLAS.walls.earth},
  wet:{top:TILE_ATLAS.base.wet,wall:TILE_ATLAS.walls.peat},
  dry:{top:TILE_ATLAS.base.dry,wall:TILE_ATLAS.walls.brownRock},
  road:{top:TILE_ATLAS.base.road,wall:TILE_ATLAS.walls.earth},
  city:{top:TILE_ATLAS.base.city,wall:TILE_ATLAS.walls.city},
  bridge:{top:TILE_ATLAS.base.bridge,wall:TILE_ATLAS.walls.earth},
  volcanic:{top:TILE_ATLAS.base.volcanic,wall:TILE_ATLAS.walls.redBasalt},
  mountain:{top:TILE_ATLAS.biome.mountain,wall:TILE_ATLAS.walls.slate},
  rocky:{top:TILE_ATLAS.biome.rocky,wall:TILE_ATLAS.walls.granite},
  desert:{top:TILE_ATLAS.biome.desert,wall:TILE_ATLAS.walls.sandstone},
  ice:{top:TILE_ATLAS.biome.ice,wall:TILE_ATLAS.walls.ice},
  swamp:{top:TILE_ATLAS.biome.swamp,wall:TILE_ATLAS.walls.peat},
  riverbank:{top:TILE_ATLAS.biome.riverbank,wall:TILE_ATLAS.walls.riverstone},
  lakeside:{top:TILE_ATLAS.biome.lakeside,wall:TILE_ATLAS.walls.riverstone},
  beach:{top:TILE_ATLAS.biome.beach,wall:TILE_ATLAS.walls.beach},
  ruins:{top:TILE_ATLAS.biome.ruins,wall:TILE_ATLAS.walls.ruins},
  magic:{top:TILE_ATLAS.biome.magic,wall:TILE_ATLAS.walls.magic},
  cave:{top:TILE_ATLAS.biome.cave,wall:TILE_ATLAS.walls.cave}
} as const;

// Each biome has one repeatable base floor and one matching bare cliff face.
// The four painted layers are sampled over that floor with a world-space brush
// mask. Their art never replaces the entire square tile at random.
export const BIOME_BRUSH_PROFILES = {
  forest:{base:TERRAIN_MATERIALS.forest.top,wall:TERRAIN_MATERIALS.forest.wall,layers:{path:Aroad(),dense:TILE_ATLAS.variants.forest[0],feature:TILE_ATLAS.variants.forest[1],accent:TILE_ATLAS.variants.forest[3]}},
  field:{base:TILE_ATLAS.biome.field,wall:TERRAIN_MATERIALS.forest.wall,layers:{path:Aroad(),dense:TILE_ATLAS.base.meadow,feature:TILE_ATLAS.variants.forest[0],accent:TILE_ATLAS.variants.forest[3]}},
  mountain:{base:TERRAIN_MATERIALS.mountain.top,wall:TERRAIN_MATERIALS.mountain.wall,layers:{path:Aroad(),dense:TILE_ATLAS.biome.rocky,feature:TILE_ATLAS.variants.volcanic[3],accent:TILE_ATLAS.biome.cave}},
  rocky:{base:TERRAIN_MATERIALS.rocky.top,wall:TERRAIN_MATERIALS.rocky.wall,layers:{path:Aroad(),dense:TILE_ATLAS.biome.mountain,feature:TILE_ATLAS.biome.cave,accent:TILE_ATLAS.biome.rocky}},
  desert:{base:TERRAIN_MATERIALS.desert.top,wall:TERRAIN_MATERIALS.desert.wall,layers:{path:Aroad(),dense:TILE_ATLAS.biome.beach,feature:TILE_ATLAS.biome.rocky,accent:TILE_ATLAS.biome.desert}},
  volcanic:{base:TERRAIN_MATERIALS.volcanic.top,wall:TERRAIN_MATERIALS.volcanic.wall,layers:{path:Aroad(),dense:TILE_ATLAS.variants.volcanic[2],feature:TILE_ATLAS.variants.volcanic[0],accent:TILE_ATLAS.biome.volcanic}},
  ice:{base:TERRAIN_MATERIALS.ice.top,wall:TERRAIN_MATERIALS.ice.wall,layers:{path:Aroad(),dense:TILE_ATLAS.transition.fieldSnow,feature:TILE_ATLAS.transition.snowIce,accent:TILE_ATLAS.transition.iceLake}},
  swamp:{base:TERRAIN_MATERIALS.wet.top,wall:TERRAIN_MATERIALS.swamp.wall,layers:{path:Aroad(),dense:TILE_ATLAS.variants.wet[0],feature:TILE_ATLAS.variants.wet[1],accent:TILE_ATLAS.variants.wet[3]}},
  riverbank:{base:TERRAIN_MATERIALS.riverbank.top,wall:TERRAIN_MATERIALS.riverbank.wall,layers:{path:Aroad(),dense:TILE_ATLAS.variants.wet[0],feature:TILE_ATLAS.transition.mudRiverbank,accent:TILE_ATLAS.biome.lakeside}},
  lake:{base:TERRAIN_MATERIALS.wet.top,wall:TERRAIN_MATERIALS.wet.wall,layers:{path:Aroad(),dense:TILE_ATLAS.variants.wet[0],feature:TILE_ATLAS.variants.wet[1],accent:TILE_ATLAS.biome.riverbank}},
  beach:{base:TERRAIN_MATERIALS.beach.top,wall:TERRAIN_MATERIALS.beach.wall,layers:{path:Aroad(),dense:TILE_ATLAS.biome.desert,feature:TILE_ATLAS.transition.riverWater,accent:TILE_ATLAS.biome.beach}},
  road:{base:TERRAIN_MATERIALS.road.top,wall:TERRAIN_MATERIALS.road.wall,layers:{path:Aroad(),dense:TILE_ATLAS.variants.road[2],feature:TILE_ATLAS.biome.road,accent:TILE_ATLAS.variants.road[1]}},
  ruins:{base:TERRAIN_MATERIALS.ruins.top,wall:TERRAIN_MATERIALS.ruins.wall,layers:{path:Aroad(),dense:TILE_ATLAS.base.ruins,feature:TILE_ATLAS.transition.ruinMagic,accent:TILE_ATLAS.biome.ruins}},
  city:{base:TERRAIN_MATERIALS.city.top,wall:TERRAIN_MATERIALS.city.wall,layers:{path:Aroad(),dense:TILE_ATLAS.variants.road[0],feature:TILE_ATLAS.biome.city,accent:TILE_ATLAS.transition.cityRoad}},
  magic:{base:TERRAIN_MATERIALS.magic.top,wall:TERRAIN_MATERIALS.magic.wall,layers:{path:Aroad(),dense:TILE_ATLAS.transition.ruinMagic,feature:TILE_ATLAS.biome.magic,accent:TILE_ATLAS.base.ruins}},
  cave:{base:TERRAIN_MATERIALS.cave.top,wall:TERRAIN_MATERIALS.cave.wall,layers:{path:Aroad(),dense:TILE_ATLAS.biome.mountain,feature:TILE_ATLAS.variants.volcanic[3],accent:TILE_ATLAS.biome.cave}}
} as const;

function Aroad():number{return TILE_ATLAS.base.road;}

export const REGION_BIOME_PROFILE = {bosque:'forest',brasa:'volcanic',lago:'lake'} as const;

export const BIOME_PROP_KITS = {
  forest:['forest-shrub','fallen-log','root-cluster','moss-boulder','tree','pine','moss-rock'],
  field:['field-flowers','grass-tuft','field-stump','fieldstone','flowers'],
  mountain:['mountain-boulder','shale-fragments','mineral-cluster','scree-pile'],
  rocky:['mountain-boulder','fieldstone','shale-fragments','scree-pile'],
  desert:['desert-thorn','sandstone-boulder','sandstone-pillar','desert-pebbles'],
  volcanic:['basalt-shard','ash-heap','obsidian-spire','lava-boulder','basalt-rock'],
  ice:['snowdrift','frozen-boulder','ice-crystals','ice-block'],
  swamp:['swamp-reeds','waterlogged-stump','wet-rock','lily-pads','marsh-willow'],
  riverbank:['driftwood','bank-grass','river-stones','swamp-reeds'],
  lake:['lily-pads','river-stones','shells','bank-grass'],
  beach:['driftwood','shells','desert-pebbles','bank-grass'],
  road:['street-sign','market-barrel','market-crate'],
  ruins:['ruin-column','ruin-block','ruin-arch','ruin-slab'],
  city:['town-fountain','street-sign','market-barrel','market-crate'],
  magic:['magic-crystal','rune-stone','glow-mushrooms','magic-flowers'],
  cave:['stalagmites','cave-boulder','geode','cave-mushrooms']
} as const;
