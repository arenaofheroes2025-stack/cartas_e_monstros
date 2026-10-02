import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export function opaqueComponents(data,width,height,threshold=80){
  const seen=new Uint8Array(width*height),groups=[];
  for(let start=0;start<seen.length;start++){
    if(seen[start]||data[start*4+3]<threshold)continue;
    const queue=[start];seen[start]=1;
    let left=width,right=0,top=height,bottom=0;
    for(let head=0;head<queue.length;head++){
      const at=queue[head],x=at%width,y=Math.floor(at/width);
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy,next=ny*width+nx;
        if(nx<0||ny<0||nx>=width||ny>=height||seen[next]||data[next*4+3]<threshold)continue;
        seen[next]=1;queue.push(next);
      }
    }
    groups.push({area:queue.length,left,right,top,bottom});
  }
  return groups.sort((a,b)=>b.area-a.area);
}

// Some painted sheets let the previous row or column spill into the next cell.
// Erase only components separated from the main silhouette by transparent space.
export function removeDetachedBleed(data,width,height){
  const pixels=Buffer.from(data);
  const groups=opaqueComponents(pixels,width,height);
  const main=groups[0];
  if(!main)return {pixels,removed:0};
  let removed=0;
  for(const group of groups.slice(1)){
    if(group.area<2||!(group.bottom<main.top-5||group.top>main.bottom+5||
      group.right<main.left-5||group.left>main.right+5))continue;
    const left=Math.max(0,group.left-4),right=Math.min(width-1,group.right+4);
    const top=Math.max(0,group.top-4),bottom=Math.min(height-1,group.bottom+4);
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)pixels.fill(0,(y*width+x)*4,(y*width+x)*4+4);
    removed++;
  }
  return {pixels,removed};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const strict=process.argv.includes('--strict');
  const intentionalDetached=new Map([
    ['effects/nature-hit.png',{area:30,left:13,top:165}],
    ['effects/water-hit.png',{area:35,left:90,top:175}],
    ['people/player-anim-itemThrow.png#5',{area:65,left:115,top:28}]
  ]);
  let unexpected=0;
  for(const category of ['environment','cards','effects','interiors','people','creatures','birds','items','ui']){
    const folder=path.join(process.cwd(),'public','art',category);
    if(!fs.existsSync(folder))continue;
    for(const name of fs.readdirSync(folder).filter(name=>name.endsWith('.png')).sort()){
      const file=path.join(folder,name),meta=await sharp(file).metadata();
      const frames=meta.width>meta.height&&meta.width%meta.height===0&&meta.width/meta.height<=16?
        meta.width/meta.height:1;
      for(let frame=0;frame<frames;frame++){
        const width=meta.width/frames,height=meta.height;
        const {data}=await sharp(file).extract({left:frame*width,top:0,width,height})
          .ensureAlpha().raw().toBuffer({resolveWithObject:true});
        const groups=opaqueComponents(data,width,height).filter(group=>group.area>=8);
        if(groups.length<2)continue;
        const main=groups[0];
        const detached=groups.slice(1).filter(group=>group.area>=Math.max(12,main.area*0.0004)&&
          (group.bottom<main.top-5||group.top>main.bottom+5||group.right<main.left-5||group.left>main.right+5));
        if(detached.length){
          const key=`${category}/${name}${frames>1?`#${frame}`:''}`;
          const allowed=intentionalDetached.get(key);
          const approved=allowed&&detached.length===1&&detached[0].area<=allowed.area&&
            detached[0].left>=allowed.left&&detached[0].top>=allowed.top;
          if(!approved)unexpected++;
          if(!strict||!approved)
            console.log(key,JSON.stringify({main,detached:detached.slice(0,8)}));
        }
      }
    }
  }
  if(strict){
    if(unexpected)process.exitCode=1;
    else console.log('No detached artwork from neighboring sprite cells.');
  }
}
