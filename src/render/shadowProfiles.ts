import { ART_FOOTPRINTS, ART_FOOTPRINT_AREAS } from '../game/generatedFootprints';
import { depthFor } from '../game/assetCollision';
import type { SceneLightSource } from './lightSources';
import { daylightPhase } from './daylightPhase';
import { SHADOW_SLOPE } from './sun';

const INV_SQRT2=Math.SQRT1_2;
export interface GroundProfile {
  offsetX:number;
  offsetZ:number;
  width:number;
  depth:number;
  castHeight:number;
}

export function groundProfile(asset:string,size:number):GroundProfile {
  const area=ART_FOOTPRINT_AREAS[asset];
  let across=0,depth=0,width=size*0.42,groundDepth=Math.min(size*0.62,depthFor(asset)*2);
  if(area){
    let count=0,minColumn=Infinity,maxColumn=-1,minRow=Infinity,maxRow=-1;
    for(let row=0;row<area.rows.length;row++)for(let column=0;column<area.rows[row].length;column++){
      if(area.rows[row][column]!=='1')continue;
      const acrossPixel=(column+0.5)/area.rows[row].length-0.5;
      const depthPixel=area.depthMin+(row+0.5)/area.rows.length*(area.depthMax-area.depthMin);
      across+=acrossPixel;depth+=depthPixel;count++;
      minColumn=Math.min(minColumn,column);maxColumn=Math.max(maxColumn,column);
      minRow=Math.min(minRow,row);maxRow=Math.max(maxRow,row);
    }
    if(count){
      across=across/count*size;depth/=count;
      width=(maxColumn-minColumn+1)/area.rows[0].length*size*0.9;
      groundDepth=(maxRow-minRow+1)/area.rows.length*(area.depthMax-area.depthMin)*0.8;
    }
  }else{
    const mask=ART_FOOTPRINTS[asset];
    if(mask){
      const first=mask.indexOf('1'),last=mask.lastIndexOf('1');
      if(first>=0){
        across=((first+last+1)/2/mask.length-0.5)*size;
        width=(last-first+1)/mask.length*size*0.9;
      }
    }
  }
  const tall=asset.startsWith('casa-')||asset==='woodcutter-hut'||asset==='boathouse'||
    ['tree','willow','pine','copper-tree','marsh-willow'].includes(asset);
  const castHeight=tall?size*0.78:asset.includes('lamp')?size*0.72:asset.includes('rock')?size*0.42:size*0.35;
  return {
    offsetX:(across+depth)*INV_SQRT2,
    offsetZ:(depth-across)*INV_SQRT2,
    width:Math.max(0.28,width),
    depth:Math.max(0.28,groundDepth),
    castHeight
  };
}

export function sunlightDirection(_hour:number):{x:number;z:number} {
  const length=Math.hypot(SHADOW_SLOPE.x,SHADOW_SLOPE.z);
  return {x:SHADOW_SLOPE.x/length,z:SHADOW_SLOPE.z/length};
}

export function dominantShadowDirection(hour:number,x:number,z:number,sources:SceneLightSource[]):{x:number;z:number} {
  const daylight=daylightPhase(hour).daylight;
  if(daylight<0.45){
    let nearest:SceneLightSource|undefined,closest=Infinity;
    for(const source of sources){
      const distance=Math.hypot(x-source.x,z-source.z);
      if(distance<closest&&distance>0.3&&distance<source.reach){nearest=source;closest=distance;}
    }
    if(nearest)return {x:(x-nearest.x)/closest,z:(z-nearest.z)/closest};
  }
  return sunlightDirection(hour);
}
