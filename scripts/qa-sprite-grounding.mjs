import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const source=fs.readFileSync('src/render/spriteAnchors.ts','utf8');
const anchors=JSON.parse(source.match(/= (\{[\s\S]*?\});/)[1]);
let frames=0,smallest=Infinity,largest=-Infinity;
const problems=[];
for(const [asset,feet] of Object.entries(anchors)){
  const {data,info}=await sharp(path.join('public',asset)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.width%feet.length){problems.push(`${asset}: largura incompatível`);continue;}
  const frameWidth=info.width/feet.length;
  const building=asset.includes('/environment/casa-')||
    /\/environment\/(woodcutter-hut|boathouse)\.png$/.test(asset);
  const threshold=asset.includes('/environment/')?(building?36:51):115;
  for(let frame=0;frame<feet.length;frame++){
    let bottom=-1;
    for(let y=info.height-1;y>=0&&bottom<0;y--)for(let x=frame*frameWidth;x<(frame+1)*frameWidth;x++)
      if(data[(y*info.width+x)*info.channels+3]>=threshold){bottom=y;break;}
    if(bottom<0){problems.push(`${asset}:${frame}: sem pixels visíveis`);continue;}
    const inside=feet[frame]*info.height-(info.height-1-bottom);
    frames++;smallest=Math.min(smallest,inside);largest=Math.max(largest,inside);
    if(Math.abs(inside-4)>0.02)problems.push(`${asset}:${frame}: ${inside.toFixed(2)} pixels`);
  }
}
console.log(`${Object.keys(anchors).length} PNGs, ${frames} quadros; apoio ${smallest.toFixed(3)}–${largest.toFixed(3)} pixels acima do último pixel`);
if(problems.length){console.error(problems.slice(0,20).join('\n'));process.exitCode=1;}
