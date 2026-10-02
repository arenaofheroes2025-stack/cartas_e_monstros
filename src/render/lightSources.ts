import { ELEMENT_COLOR } from '../game/content';
import { HEIGHT_STEP, tileAt, type WorldData } from '../game/world';

export interface SceneLightSource {
  id:string;
  kind:'shrine'|'house'|'lamp'|'card';
  x:number;
  y:number;
  z:number;
  groundY:number;
  color:string;
  reach:number;
}

export function worldLightSources(world:WorldData):SceneLightSource[] {
  const sources:SceneLightSource[]=[];
  for(const place of [...world.places,...world.decorations]){
    const tile=tileAt(world,place.x,place.z)!;
    const groundY=tile.height*HEIGHT_STEP+0.13;
    if(place.kind==='shrine'){
      sources.push({id:place.id,kind:'shrine',x:place.x+0.5,y:groundY+1.4,z:place.z+0.5,groundY,
        color:ELEMENT_COLOR[place.element!],reach:6.5});
    }else{
      sources.push({id:place.id,kind:'house',x:place.x+0.95,y:groundY+2.05,z:place.z+0.95,groundY,
        color:'#ffd098',reach:11});
    }
  }
  for(const tile of world.tiles)if(tile.prop==='lamp'||tile.prop==='village-lamp'){
    const groundY=tile.height*HEIGHT_STEP+0.13;
    sources.push({id:`lamp-${tile.x}-${tile.z}`,kind:'lamp',x:tile.x+0.5,y:groundY+1.7,z:tile.z+0.5,groundY,
      color:'#ffcb84',reach:10.5});
  }
  return sources;
}
