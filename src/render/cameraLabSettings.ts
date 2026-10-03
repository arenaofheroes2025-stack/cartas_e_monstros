import * as THREE from 'three';
import { cameraZoom, perspectiveFovForZoom } from './cameraZoom';

export interface CameraLabSettings {
  zoomScale: number;
  elevation: number;
  azimuth: number;
  distance: number;
  focusHeight: number;
  focusX: number;
  focusZ: number;
  lookAhead: number;
  leadResponse: number;
  followResponse: number;
  zoomResponse: number;
  blurEnabled: boolean;
  blurRadius: number;
  blurAmount: number;
  blurFocusOffset: number;
  nearBlurFull: number;
  nearBlurClear: number;
  farBlurStart: number;
  farBlurFull: number;
  spriteMode: 'isometrico' | 'acompanhar';
  spriteWarp: number;
  spriteStretch: number;
}

export const DEFAULT_CAMERA_LAB_SETTINGS: CameraLabSettings = {
  zoomScale: 0.91,
  elevation: 33,
  azimuth: 45,
  distance: 28.8,
  focusHeight: -2.55, focusX: -3.9, focusZ: -3.9,
  lookAhead: 1, leadResponse: 1.6, followResponse: 6.2, zoomResponse: 5.2,
  blurEnabled: true, blurRadius: 3.5, blurAmount: 0.82,
  blurFocusOffset: -2.5, nearBlurFull: 5, nearBlurClear: 0.3,
  farBlurStart: 6.3, farBlurFull: 8,
  spriteMode: 'isometrico', spriteWarp: 0, spriteStretch: 0.6
};

const ranges: Record<Exclude<keyof CameraLabSettings,'blurEnabled'|'spriteMode'>,[number,number]> = {
  zoomScale:[0.55,1.6],elevation:[20,75],azimuth:[-20,110],distance:[10,36],
  focusHeight:[-3,5],focusX:[-8,8],focusZ:[-8,8],lookAhead:[0,3],
  leadResponse:[0.2,8],followResponse:[0.5,20],zoomResponse:[0.5,20],
  blurRadius:[0,12],blurAmount:[0,1],blurFocusOffset:[-10,10],
  nearBlurFull:[2,16],nearBlurClear:[0.3,7],farBlurStart:[0.3,9],
  farBlurFull:[2,20],spriteWarp:[0,1.5],spriteStretch:[0.6,1.6]
};

export function sanitizeCameraLabSettings(value: unknown): CameraLabSettings {
  const source=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const result={...DEFAULT_CAMERA_LAB_SETTINGS};
  for(const [key,[min,max]] of Object.entries(ranges) as [keyof typeof ranges,[number,number]][]){
    const raw=source[key];
    if(typeof raw!=='number'||!Number.isFinite(raw))continue;
    (result as unknown as Record<string,number>)[key]=Math.min(max,Math.max(min,raw));
  }
  if(typeof source.blurEnabled==='boolean')result.blurEnabled=source.blurEnabled;
  if(source.spriteMode==='isometrico'||source.spriteMode==='acompanhar')result.spriteMode=source.spriteMode;
  return result;
}

export function cameraOffsetForSettings(settings:CameraLabSettings):THREE.Vector3 {
  const elevation=THREE.MathUtils.degToRad(settings.elevation);
  const azimuth=THREE.MathUtils.degToRad(settings.azimuth);
  const horizontal=settings.distance*Math.cos(elevation);
  return new THREE.Vector3(horizontal*Math.sin(azimuth),
    settings.distance*Math.sin(elevation),horizontal*Math.cos(azimuth));
}

export function readCameraLabSettings():CameraLabSettings {
  try{return sanitizeCameraLabSettings(JSON.parse(localStorage.getItem('cartas-camera-lab')||'{}'));}
  catch{return {...DEFAULT_CAMERA_LAB_SETTINGS};}
}

export function saveCameraLabSettings(settings:CameraLabSettings):void {
  try{localStorage.setItem('cartas-camera-lab',JSON.stringify(settings));}
  catch{/* The copyable JSON remains available. */}
}

export function cameraLabExport(settings:CameraLabSettings,width=window.innerWidth,height=window.innerHeight):string {
  const zoom=cameraZoom(width,height,false)*settings.zoomScale;
  return JSON.stringify({
    tipo:'Cartas e Monstros — teste de câmera no jogo',
    unidade:'unidades do mundo e graus',
    nota:'Ajustes de teste; sair do controle restaura o perfil padrão aplicado ao jogo.',
    zoomAtualPixelsPorUnidade:Number(zoom.toFixed(2)),
    campoDeVisaoGraus:Number(perspectiveFovForZoom(height,zoom,settings.distance).toFixed(2)),
    tamanhoDaTela:{largura:width,altura:height},
    camera:settings
  },null,2);
}
