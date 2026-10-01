import { SHADOW_CALIBRATION, type ShadowGroup } from '../render/shadowCalibration';
export type { ShadowGroup };
export type StageFocus = 'todos'|ShadowGroup;

export interface ShadowSettings {
  azimuth:number;
  elevation:number;
  casterHeight:number;
  characterHeightScale:number;
  characterShadowSide:number;
  characterShadowDepth:number;
  houseHeightScale:number;
  houseShadowSide:number;
  houseShadowDepth:number;
  treeHeightScale:number;
  treeShadowSide:number;
  treeShadowDepth:number;
  stoneHeightScale:number;
  stoneShadowSide:number;
  stoneShadowDepth:number;
  plantHeightScale:number;
  plantShadowSide:number;
  plantShadowDepth:number;
  propHeightScale:number;
  propShadowSide:number;
  propShadowDepth:number;
  reach:number;
  opacity:number;
  footGain:number;
  softness:number;
  sunStrength:number;
  zoom:number;
  showShadows:boolean;
  showAnchors:boolean;
}

export type GroupParameter = 'heightScale'|'side'|'depth';
type NumericShadowKey = Exclude<keyof ShadowSettings,'showShadows'|'showAnchors'>;
export const GROUP_KEYS:Record<ShadowGroup,Record<GroupParameter,NumericShadowKey>> = {
  personagens:{heightScale:'characterHeightScale',side:'characterShadowSide',depth:'characterShadowDepth'},
  casas:{heightScale:'houseHeightScale',side:'houseShadowSide',depth:'houseShadowDepth'},
  arvores:{heightScale:'treeHeightScale',side:'treeShadowSide',depth:'treeShadowDepth'},
  pedras:{heightScale:'stoneHeightScale',side:'stoneShadowSide',depth:'stoneShadowDepth'},
  plantas:{heightScale:'plantHeightScale',side:'plantShadowSide',depth:'plantShadowDepth'},
  objetos:{heightScale:'propHeightScale',side:'propShadowSide',depth:'propShadowDepth'}
};

export const GROUP_LABELS:Record<ShadowGroup,string> = {
  personagens:'Personagens',casas:'Casas',arvores:'Árvores',
  pedras:'Pedras',plantas:'Plantas',objetos:'Objetos gerais'
};

export const DEFAULT_SETTINGS:ShadowSettings = {
  azimuth:SHADOW_CALIBRATION.azimuth,elevation:SHADOW_CALIBRATION.elevation,
  casterHeight:SHADOW_CALIBRATION.casterHeight,
  characterHeightScale:SHADOW_CALIBRATION.groups.personagens.heightScale,
  characterShadowSide:SHADOW_CALIBRATION.groups.personagens.side,
  characterShadowDepth:SHADOW_CALIBRATION.groups.personagens.depth,
  houseHeightScale:SHADOW_CALIBRATION.groups.casas.heightScale,
  houseShadowSide:SHADOW_CALIBRATION.groups.casas.side,
  houseShadowDepth:SHADOW_CALIBRATION.groups.casas.depth,
  treeHeightScale:SHADOW_CALIBRATION.groups.arvores.heightScale,
  treeShadowSide:SHADOW_CALIBRATION.groups.arvores.side,
  treeShadowDepth:SHADOW_CALIBRATION.groups.arvores.depth,
  stoneHeightScale:SHADOW_CALIBRATION.groups.pedras.heightScale,
  stoneShadowSide:SHADOW_CALIBRATION.groups.pedras.side,
  stoneShadowDepth:SHADOW_CALIBRATION.groups.pedras.depth,
  plantHeightScale:SHADOW_CALIBRATION.groups.plantas.heightScale,
  plantShadowSide:SHADOW_CALIBRATION.groups.plantas.side,
  plantShadowDepth:SHADOW_CALIBRATION.groups.plantas.depth,
  propHeightScale:SHADOW_CALIBRATION.groups.objetos.heightScale,
  propShadowSide:SHADOW_CALIBRATION.groups.objetos.side,
  propShadowDepth:SHADOW_CALIBRATION.groups.objetos.depth,
  reach:SHADOW_CALIBRATION.reach,opacity:SHADOW_CALIBRATION.opacity,
  footGain:SHADOW_CALIBRATION.footGain,softness:SHADOW_CALIBRATION.softness,
  sunStrength:SHADOW_CALIBRATION.sunStrength,zoom:42,
  showShadows:true,showAnchors:false
};

export const PRESETS:Record<string,ShadowSettings> = {
  'Jogo atual': DEFAULT_SETTINGS,
  'Sol mais alto': {...DEFAULT_SETTINGS,azimuth:0,elevation:82,casterHeight:3.2,opacity:0.5,footGain:1.4},
  'Sombra visível': {...DEFAULT_SETTINGS,azimuth:12,elevation:68,casterHeight:4.4,opacity:0.48,softness:0.3}
};

export function shadowSunOffset(settings:ShadowSettings):{x:number;y:number;z:number} {
  const angle=settings.azimuth*Math.PI/180;
  const horizontal=SHADOW_CALIBRATION.sunOffset.y/Math.tan(settings.elevation*Math.PI/180);
  return {
    x:Number((-(Math.cos(angle)+Math.sin(angle))*Math.SQRT1_2*horizontal).toFixed(2)),
    y:SHADOW_CALIBRATION.sunOffset.y,
    z:Number((-(Math.cos(angle)-Math.sin(angle))*Math.SQRT1_2*horizontal).toFixed(2))
  };
}

export function groupShadowValues(settings:ShadowSettings,group:ShadowGroup):{
  heightScale:number;side:number;depth:number
} {
  const keys=GROUP_KEYS[group];
  return {
    heightScale:settings[keys.heightScale] as number,
    side:settings[keys.side] as number,
    depth:settings[keys.depth] as number
  };
}

// The fixed camera sees world X-Z as screen-right and X+Z as screen-down.
export function groupShadowOffset(settings:ShadowSettings,group:ShadowGroup):{x:number;z:number} {
  const {side,depth}=groupShadowValues(settings,group);
  return {x:(side+depth)*Math.SQRT1_2,z:(depth-side)*Math.SQRT1_2};
}

const limits:Record<keyof Pick<ShadowSettings,
  'azimuth'|'elevation'|'casterHeight'|'characterHeightScale'|'characterShadowSide'|'characterShadowDepth'|
  'houseHeightScale'|'houseShadowSide'|'houseShadowDepth'|
  'treeHeightScale'|'treeShadowSide'|'treeShadowDepth'|
  'stoneHeightScale'|'stoneShadowSide'|'stoneShadowDepth'|
  'plantHeightScale'|'plantShadowSide'|'plantShadowDepth'|
  'propHeightScale'|'propShadowSide'|'propShadowDepth'|
  'reach'|'opacity'|'footGain'|'softness'|'sunStrength'|'zoom'>,[number,number]> = {
  azimuth:[-60,60],elevation:[40,86],casterHeight:[1,8.5],
  characterHeightScale:[0.2,2.5],characterShadowSide:[-2,2],characterShadowDepth:[-2,2],
  houseHeightScale:[0.2,2.5],houseShadowSide:[-2,2],houseShadowDepth:[-2,2],
  treeHeightScale:[0.2,2.5],treeShadowSide:[-2,2],treeShadowDepth:[-2,2],
  stoneHeightScale:[0.2,2.5],stoneShadowSide:[-2,2],stoneShadowDepth:[-2,2],
  plantHeightScale:[0.2,2.5],plantShadowSide:[-2,2],plantShadowDepth:[-2,2],
  propHeightScale:[0.2,2.5],propShadowSide:[-2,2],propShadowDepth:[-2,2],
  reach:[0.4,1.8],opacity:[0,0.8],footGain:[0.5,2],softness:[0.02,0.49],
  sunStrength:[0.5,3],zoom:[26,60]
};

type LegacyObjectSettings = {objectHeightScale?:number;objectShadowSide?:number;objectShadowDepth?:number};

function inheritedObjectValue(params:URLSearchParams,stored:LegacyObjectSettings,key:keyof LegacyObjectSettings):number|undefined {
  const fromUrl=params.get(key);
  if(fromUrl!==null)return Number(fromUrl);
  return stored[key];
}

export function parseShadowSettings(search:string,stored:Partial<ShadowSettings>&LegacyObjectSettings={}):ShadowSettings {
  const params=new URLSearchParams(search);
  const result={...DEFAULT_SETTINGS};
  for(const key of Object.keys(limits) as (keyof typeof limits)[]){
    if(stored[key]!==undefined)result[key]=stored[key] as number;
  }
  for(const key of ['showShadows','showAnchors'] as const){
    if(stored[key]!==undefined)result[key]=stored[key] as boolean;
  }
  // A group URL wins first; an old shared URL wins over stored values on revisit.
  for(const group of ['casas','arvores','objetos'] as const){
    for(const [field,legacy] of [['heightScale','objectHeightScale'],['side','objectShadowSide'],['depth','objectShadowDepth']] as const){
      const key=GROUP_KEYS[group][field];
      if(params.has(key))continue;
      if(!params.has(legacy)&&Object.hasOwn(stored,key))continue;
      const value=inheritedObjectValue(params,stored,legacy);
      if(value!==undefined)(result as unknown as Record<string,number>)[key]=value;
    }
  }
  // Previously stones and plants were part of "objetos". Keep that link's look
  // until either new group receives an explicit setting.
  for(const group of ['pedras','plantas'] as const){
    for(const [field,legacy] of [['heightScale','objectHeightScale'],['side','objectShadowSide'],['depth','objectShadowDepth']] as const){
      const key=GROUP_KEYS[group][field];
      const propKey=GROUP_KEYS.objetos[field];
      if(params.has(key))continue;
      if(params.has(propKey))result[key]=Number(params.get(propKey));
      else if(params.has(legacy))result[key]=Number(params.get(legacy));
      else if(!Object.hasOwn(stored,key)&&
        (Object.hasOwn(stored,propKey)||Object.hasOwn(stored,legacy)))result[key]=result[propKey];
    }
  }
  for(const [key,[min,max]] of Object.entries(limits) as [keyof typeof limits,[number,number]][]){
    const fromUrl=params.get(key);
    const value=fromUrl===null?Number(result[key]):Number(fromUrl);
    result[key]=Number.isFinite(value)?Math.min(max,Math.max(min,value)):DEFAULT_SETTINGS[key];
  }
  for(const key of ['showShadows','showAnchors'] as const){
    const fromUrl=params.get(key);
    if(fromUrl!==null)result[key]=fromUrl==='1';
    else result[key]=typeof result[key]==='boolean'?result[key]:DEFAULT_SETTINGS[key];
  }
  return result;
}

export function readShadowSettings():ShadowSettings {
  let stored:Partial<ShadowSettings>&LegacyObjectSettings={};
  try{stored=JSON.parse(localStorage.getItem('cartas-shadow-lab')||'{}') as typeof stored;}
  catch{/* Ignore old presets. */}
  return parseShadowSettings(window.location.search,stored);
}

export function shadowSettingsUrl(settings:ShadowSettings):string {
  const params=new URLSearchParams();
  for(const key of Object.keys(limits) as (keyof typeof limits)[])params.set(key,String(settings[key]));
  params.set('showShadows',settings.showShadows?'1':'0');
  params.set('showAnchors',settings.showAnchors?'1':'0');
  return `${window.location.origin}${window.location.pathname}?${params}`;
}

export function saveShadowSettings(settings:ShadowSettings):void {
  localStorage.setItem('cartas-shadow-lab',JSON.stringify(settings));
  history.replaceState(null,'',shadowSettingsUrl(settings));
}
