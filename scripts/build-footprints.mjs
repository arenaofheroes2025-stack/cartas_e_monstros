import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const bands={
  'casa-cartas':[.76,.86], 'casa-cura':[.76,.86], 'casa-arquivo':[.76,.86],
  'casa-padaria':[.76,.86], 'casa-vila':[.76,.86],
  'woodcutter-hut':[.76,.88], boathouse:[.76,.88],
  'selo-natureza':[.82,.93], 'selo-fogo':[.82,.93], 'selo-agua':[.82,.93],
  tree:[.65,.75], willow:[.65,.75], pine:[.85,.95], 'copper-tree':[.75,.85], 'marsh-willow':[.75,.85],
  rock:[.8,.91], 'moss-rock':[.8,.91], 'basalt-rock':[.8,.91], lamp:[.82,.94],
  'village-lamp':[.8,.94], 'bloom-bush':[.78,.94], bench:[.75,.92],
  well:[.75,.93], crates:[.76,.94], 'flower-planter':[.79,.95]
};
for(const name of [
  'fallen-log','moss-boulder','field-stump','fieldstone','mountain-boulder','basalt-shard',
  'obsidian-spire','lava-boulder','sandstone-boulder','sandstone-pillar','frozen-boulder',
  'ice-block','waterlogged-stump','wet-rock','town-fountain','street-sign','market-barrel',
  'market-crate','ruin-column','ruin-block','ruin-arch','ruin-slab','magic-crystal',
  'rune-stone','stalagmites','cave-boulder','geode'
])bands[name]=[.78,.94];

const trunks=new Set(['tree','willow','pine','copper-tree','marsh-willow']);
const people=['artisan','healer','keeper','guardian','cartographer','botanist','baker','courier'];
const buildings=['casa-cartas','casa-cura','casa-arquivo','casa-padaria','casa-vila','woodcutter-hut','boathouse'];

async function alphaArea(file,start=.58,end=.97) {
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const columns=32,rows=20;
  return Array.from({length:rows},(_,row)=>Array.from({length:columns},(_,column)=>{
    const left=Math.floor(column*info.width/columns),right=Math.ceil((column+1)*info.width/columns);
    const top=Math.floor((start+(end-start)*row/rows)*info.height);
    const bottom=Math.ceil((start+(end-start)*(row+1)/rows)*info.height);
    let opaque=0,total=0;
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
      total++;if(data[(y*info.width+x)*info.channels+3]>110)opaque++;
    }
    return opaque/total>0.12?'1':'0';
  }).join(''));
}

async function alphaBand(file,start,end,{frames=1,trunk=false}={}) {
  const source=sharp(file);
  const metadata=await source.metadata();
  const {data,info}=await source.extract({left:0,top:0,width:Math.floor(metadata.width/frames),height:metadata.height})
    .ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const occupied=Array.from({length:64},(_,column)=>{
    const left=Math.floor(column*info.width/64),right=Math.ceil((column+1)*info.width/64);
    let opaque=0,total=0;
    for(let y=Math.floor(start*info.height);y<Math.ceil(end*info.height);y++)
      for(let x=left;x<right;x++){total++;if(data[(y*info.width+x)*info.channels+3]>100)opaque++;}
    return trunk?opaque/total>=0.7:opaque>0;
  });
  if(trunk){
    let bestStart=0,bestLength=0;
    for(let i=0;i<occupied.length;){
      if(!occupied[i]){i++;continue;}
      const start=i;while(i<occupied.length&&occupied[i])i++;
      if(i-start>bestLength){bestStart=start;bestLength=i-start;}
    }
    return occupied.map((_,i)=>i>=bestStart&&i<bestStart+bestLength?'1':'0').join('');
  }
  return occupied.map(value=>value?'1':'0').join('');
}

export async function buildFootprints(root) {
  const masks={};
  for(const [name,[start,end]] of Object.entries(bands))
    masks[name]=await alphaBand(path.join(root,'public','art','environment',`${name}.png`),start,end,{trunk:trunks.has(name)});
  const areas={};
  for(const name of buildings){
    const rows=await alphaArea(path.join(root,'public','art','environment',`${name}.png`));
    areas[name]={rows,depthMin:name.startsWith('casa-')?-2.65:-2.3,depthMax:0.25};
  }
  const hero=await alphaBand(path.join(root,'public','art','people','player-idle.png'),.85,.94);
  const characters={};
  for(const name of people)characters[name]=await alphaBand(path.join(root,'public','art','people',`${name}.png`),.85,.96,{frames:['cartographer','botanist','baker','courier'].includes(name)?3:1});
  const file=path.join(root,'src','game','generatedFootprints.ts');
  fs.writeFileSync(file,`// Generated from the alpha pixels of the shipped sprites by npm run art:build.\nexport const ART_FOOTPRINTS: Record<string,string> = ${JSON.stringify(masks,null,2)};\nexport const ART_FOOTPRINT_AREAS: Record<string,{rows:string[];depthMin:number;depthMax:number}> = ${JSON.stringify(areas,null,2)};\nexport const HERO_FOOTPRINT = '${hero}';\nexport const CHARACTER_FOOTPRINTS: Record<string,string> = ${JSON.stringify(characters,null,2)};\n`);
}
