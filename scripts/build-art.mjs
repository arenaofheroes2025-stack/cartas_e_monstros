import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { buildFootprints } from './build-footprints.mjs';
import { buildSpriteAnchors } from './build-sprite-anchors.mjs';
import { buildItemIcons } from './build-items.mjs';

const root = process.cwd();
const source = (...parts) => path.join(root, 'assets', 'source', ...parts);
const output = (...parts) => path.join(root, 'public', 'art', ...parts);
const creatures = ['brasito','brasalto','cinzuri','vulcazuri','gotejo','marejo','conchilo','coracilo','brotelho','cervaflor','musgato','floragato'];

function bounds(data, width, channels, area, threshold = 150) {
  let left = area.left + area.width, top = area.top + area.height, right = area.left, bottom = area.top;
  for (let y = area.top; y < area.top + area.height; y++) {
    for (let x = area.left; x < area.left + area.width; x++) {
      if (data[(y * width + x) * channels + 3] < threshold) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error(`No opaque artwork in ${JSON.stringify(area)}`);
  return {left, top, width: right - left + 1, height: bottom - top + 1};
}

async function loadCells(file, columns, rows) {
  const image = sharp(file);
  const {data, info} = await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const cells = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const left = Math.round(col * info.width / columns);
    const top = Math.round(row * info.height / rows);
    const right = Math.round((col + 1) * info.width / columns);
    const bottom = Math.round((row + 1) * info.height / rows);
    const area = {left, top, width:right-left, height:bottom-top};
    const core = bounds(data, info.width, info.channels, area);
    const pad = 8;
    const box = {
      left:Math.max(area.left,core.left-pad),top:Math.max(area.top,core.top-pad),
      width:Math.min(area.left+area.width,core.left+core.width+pad)-Math.max(area.left,core.left-pad),
      height:Math.min(area.top+area.height,core.top+core.height+pad)-Math.max(area.top,core.top-pad)
    };
    cells.push({box, image:await sharp(file).extract(box).png().toBuffer()});
  }
  return cells;
}

async function normalizeCells(file, columns, rows, size, names, folder, strip = false, kernel = 'nearest') {
  const cells = await loadCells(file, columns, rows);
  const maxWidth = Math.max(...cells.map(c=>c.box.width));
  const maxHeight = Math.max(...cells.map(c=>c.box.height));
  const scale = Math.min((size - 10) / maxWidth, (size - 8) / maxHeight);
  const frames = [];
  for (const cell of cells) {
    const width = Math.max(1,Math.round(cell.box.width*scale));
    const height = Math.max(1,Math.round(cell.box.height*scale));
    const image = await sharp(cell.image).resize(width,height,{kernel}).png().toBuffer();
    const frame = await sharp({create:{width:size,height:size,channels:4,background:'#00000000'}})
      .composite([{input:image,left:Math.floor((size-width)/2),top:size-height-4}]).png().toBuffer();
    frames.push(frame);
  }
  fs.mkdirSync(output(folder),{recursive:true});
  if (strip) {
    const layers=frames.map((input,i)=>({input,left:i*size,top:0}));
    const result=await sharp({create:{width:size*frames.length,height:size,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
    fs.writeFileSync(output(folder,`${names[0]}.png`),result);
    fs.writeFileSync(output(folder,`${names[0]}-idle.png`),frames[0]);
  } else {
    frames.forEach((frame,i)=>fs.writeFileSync(output(folder,`${names[i]}.png`),frame));
  }
}

for (const id of creatures) await normalizeCells(source('creatures',`${id}.png`),3,2,128,[id],'creatures',true);
await normalizeCells(source('people','player.png'),3,2,128,['player'],'people',true);
await normalizeCells(source('people','player-jump.png'),1,1,128,['player-jump'],'people',false,'lanczos3');
await normalizeCells(source('people','player-summon.png'),1,1,128,['player-summon'],'people',false,'lanczos3');
const playerAnimations={
  idle:{count:4},
  // The approved walk uses every generated pose except its neutral first cell.
  walk:{count:7,sourceName:'walk-v4',sourceCount:8,indices:[1,2,3,4,5,6,7]},
  jump:{count:6},
  summon:{count:6,sourceName:'summon-v3'},
  cardRecall:{count:6,sourceName:'summon-v1'},
  itemThrow:{count:6},
  pickup:{count:4,sourceName:'pickup-v2'},
  command:{count:4},talk:{count:4},victory:{count:6},defeat:{count:6}
};
for (const [animation,config] of Object.entries(playerAnimations)) {
  const {count,sourceName=animation,sourceCount=count}=config;
  const indices=config.indices??Array.from({length:count},(_,index)=>index);
  const sheet=source('people','player-animations',`${sourceName}-spritesheet.png`);
  const metadata=await sharp(sheet).metadata();
  const cellSize=metadata.height;
  if(![128,132].includes(cellSize)||metadata.width!==cellSize*sourceCount||metadata.channels!==4)
    throw new Error(`Invalid ${animation} sheet: expected ${sourceCount} transparent square frames`);
  const frames=[];
  const frameDirectory=output('people','player-frames');
  fs.mkdirSync(frameDirectory,{recursive:true});
  for(const filename of fs.readdirSync(frameDirectory))
    if(filename.startsWith(`${animation}-`)&&filename.endsWith('.png'))
      fs.unlinkSync(path.join(frameDirectory,filename));
  for(let frame=0;frame<count;frame++){
    const sourceFrame=await sharp(sheet)
      .extract({left:indices[frame]*cellSize,top:0,width:cellSize,height:cellSize})
      .resize(128,128,{kernel:'nearest'}).png().toBuffer();
    if(animation==='summon'&&frame===count-1){
      // The raised-card pose fills this cell; retain the generated final pose.
      frames.push(sourceFrame);
      fs.writeFileSync(path.join(frameDirectory,`${animation}-${String(frame).padStart(2,'0')}.png`),sourceFrame);
      continue;
    }
    const {data,info}=await sharp(sourceFrame).raw().toBuffer({resolveWithObject:true});
    let top=128,bottom=-1;
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      if(data[(y*128+x)*info.channels+3]<115)continue;
      top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    if(bottom<0)throw new Error(`Empty ${animation} frame ${frame}`);
    // SpriteCook places grounded boots on the final pixel row. Move the art up
    // while keeping the jump apex inside the canvas and preserving each pose.
    const shiftY=Math.max(-5,2-top);
    if(shiftY>0||bottom+shiftY>123)throw new Error(`Clipped ${animation} frame ${frame}`);
    const cropped=await sharp(sourceFrame).extract({left:0,top:-shiftY,width:128,height:128+shiftY}).png().toBuffer();
    let image=await sharp({create:{width:128,height:128,channels:4,background:'#00000000'}})
      .composite([{input:cropped,left:0,top:0}]).png().toBuffer();
    frames.push(image);
    fs.writeFileSync(path.join(frameDirectory,`${animation}-${String(frame).padStart(2,'0')}.png`),image);
    if(animation==='idle'&&frame===0)fs.writeFileSync(output('people','player-idle.png'),image);
  }
  fs.writeFileSync(output('people',`player-anim-${animation}.png`),
    await sharp({create:{width:128*count,height:128,channels:4,background:'#00000000'}})
      .composite(frames.map((input,index)=>({input,left:128*index,top:0}))).png().toBuffer());
}
await normalizeCells(source('people','npcs.png'),2,2,512,['artisan','healer','keeper','guardian'],'people',false,'lanczos3');
await normalizeCells(source('people','cartographer-walk.png'),3,1,384,['cartographer'],'people',true,'lanczos3');
await normalizeCells(source('people','botanist-walk.png'),3,1,384,['botanist'],'people',true,'lanczos3');
await normalizeCells(source('people','baker-walk.png'),3,1,384,['baker'],'people',true,'lanczos3');
await normalizeCells(source('people','courier-walk.png'),3,1,384,['courier'],'people',true,'lanczos3');
await normalizeCells(source('environment','houses.png'),3,1,512,['casa-cartas','casa-cura','casa-arquivo'],'environment',false,'lanczos3');
await normalizeCells(source('environment','town-houses.png'),2,1,512,['casa-padaria','casa-vila'],'environment',false,'lanczos3');
await normalizeCells(source('environment','shrines.png'),3,1,256,['selo-natureza','selo-fogo','selo-agua'],'environment');
await normalizeCells(source('environment','props.png'),3,2,256,['tree','willow','rock','reeds','flowers','lamp'],'environment');
await normalizeCells(source('environment','town-props.png'),3,2,256,['village-lamp','bloom-bush','bench','well','crates','flower-planter'],'environment',false,'lanczos3');
const biomeProps={
  core:['forest-shrub','fallen-log','root-cluster','moss-boulder','field-flowers','grass-tuft','field-stump','fieldstone','mountain-boulder','shale-fragments','mineral-cluster','scree-pile','basalt-shard','ash-heap','obsidian-spire','lava-boulder'],
  climate:['desert-thorn','sandstone-boulder','sandstone-pillar','desert-pebbles','snowdrift','frozen-boulder','ice-crystals','ice-block','swamp-reeds','waterlogged-stump','wet-rock','lily-pads','driftwood','bank-grass','river-stones','shells'],
  culture:['town-fountain','street-sign','market-barrel','market-crate','ruin-column','ruin-block','ruin-arch','ruin-slab','magic-crystal','rune-stone','glow-mushrooms','magic-flowers','stalagmites','cave-boulder','geode','cave-mushrooms']
};
for(const [sheet,names] of Object.entries(biomeProps))
  await normalizeCells(source('environment',`biome-props-${sheet}.png`),4,4,256,names,'environment',false,'lanczos3');
for (const name of ['pine','copper-tree','marsh-willow','moss-rock','basalt-rock','flower-bush']) {
  await normalizeCells(source('environment','single',`${name}.png`),1,1,256,[name],'environment');
}
await normalizeCells(source('environment','houses-variants.png'),2,1,512,['woodcutter-hut','boathouse'],'environment',false,'lanczos3');
for(const element of ['fogo','agua','natureza'])
  await normalizeCells(source('environment','cards-simple',`${element}.png`),1,1,192,[element],'cards');
await normalizeCells(source('environment','effects.png'),3,2,192,['fire-hit','water-hit','nature-hit','capture','evolve','seal'],'effects');
await normalizeCells(source('interiors','rooms.png'),3,1,320,['artisan','healer','keeper'],'interiors');

const tileSize=48;
const tiles=[];
for(const [sheet,filename] of ['terrain-atlas.png','terrain-variants.png','terrain-biome-detailed.png','terrain-transitions-detailed.png','terrain-cliff-stone.png'].entries()) {
  const atlasSource=source('environment',filename);
  const {width:atlasWidth,height:atlasHeight}=await sharp(atlasSource).metadata();
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const left=Math.round(col*atlasWidth/4),top=Math.round(row*atlasHeight/4);
    const right=Math.round((col+1)*atlasWidth/4),bottom=Math.round((row+1)*atlasHeight/4);
    const index=row*4+col;
    let tile;
    if(sheet===0&&index===6){
      tile=sharp(source('environment','water-clear.png')).resize(tileSize,tileSize,{kernel:'lanczos3'});
    }else if((sheet===0&&index===3)||(sheet===2&&index===11)){
      tile=sharp(source('environment','dirt-road-bare.png')).resize(tileSize,tileSize,{kernel:'lanczos3'});
    }else if(sheet===2&&[2,3,15].includes(index)){
      const cell={2:0,3:1,15:3}[index];
      const rock=source('environment','terrain-rock-bare.png');
      const {width,height}=await sharp(rock).metadata();
      tile=sharp(rock).extract({left:(cell%2)*Math.round(width/2),top:Math.floor(cell/2)*Math.round(height/2),
        width:Math.round(width/2),height:Math.round(height/2)}).resize(tileSize,tileSize,{kernel:'lanczos3'});
    }else{
      tile=sharp(atlasSource).extract({left,top,width:right-left,height:bottom-top}).resize(tileSize,tileSize,{kernel:'lanczos3'});
    }
    const input=await tile.png().toBuffer();
    tiles.push({input,left:col*tileSize,top:(sheet*4+row)*tileSize});
  }
}
const atlas=await sharp({create:{width:tileSize*4,height:tileSize*20,channels:4,background:'#00000000'}}).composite(tiles).png().toBuffer();
fs.writeFileSync(output('terrain-atlas.png'),atlas);
for (const size of [192,512]) {
  const icon=await sharp(source('ui','app-icon.png')).resize(size,size,{kernel:'lanczos3'}).png().toBuffer();
  fs.writeFileSync(output(`pwa-${size}.png`),icon);
}
fs.copyFileSync(source('ui','trio-elemental-web.png'),output('trio-elemental-web.png'));
fs.mkdirSync(output('ui'),{recursive:true});
await sharp(source('ui','hero-satchel.png')).resize(128,128,{fit:'contain',kernel:'nearest'})
  .png().toFile(output('ui','hero-satchel.png'));
await buildItemIcons();
await buildFootprints(root);
await buildSpriteAnchors(root);
console.log(`Built ${creatures.length} creature strips, player, NPCs, buildings, interiors, 48 biome props, cards, effects and 80 terrain tiles.`);
