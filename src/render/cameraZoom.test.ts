import { describe, expect, it } from 'vitest';
import { cameraZoom, captureCameraZoom, victoryCameraZoom } from './cameraZoom';
import { BATTLE_RECALL_END_SECONDS, BATTLE_ZOOM_OUT_END_SECONDS, CAPTURE_RECALL_END_SECONDS, CAPTURE_ZOOM_OUT_END_SECONDS } from '../game/game';

describe('enquadramento da câmera',()=>{
  it('aproxima a arena em desktop e celular horizontal',()=>{
    expect(cameraZoom(1280,800,true)).toBeGreaterThan(cameraZoom(1280,800,false));
    expect(cameraZoom(844,390,true)).toBeGreaterThan(cameraZoom(844,390,false));
  });
  it('aproxima a exploração um pouco mais no celular',()=>{
    expect(cameraZoom(390,844,false)).toBeGreaterThan(cameraZoom(1280,800,false));
    expect(cameraZoom(844,390,false)).toBeGreaterThan(48);
    expect(cameraZoom(1280,800,false)).toBeGreaterThan(60);
  });
  it.each([[1280,800],[844,390]])('espera a carta voltar antes de afastar do herói em %ix%i',(width,height)=>{
    const close=victoryCameraZoom(width,height,BATTLE_RECALL_END_SECONDS);
    expect(close).toBeGreaterThan(cameraZoom(width,height,true));
    expect(victoryCameraZoom(width,height,BATTLE_RECALL_END_SECONDS-0.1)).toBe(close);
    expect(victoryCameraZoom(width,height,3.1)).toBeLessThan(close);
    expect(victoryCameraZoom(width,height,BATTLE_ZOOM_OUT_END_SECONDS)).toBe(cameraZoom(width,height,false));
  });
  it('mantém o enquadramento da captura até o companheiro virar carta',()=>{
    const close=captureCameraZoom(1280,800,CAPTURE_RECALL_END_SECONDS);
    expect(close).toBeGreaterThan(cameraZoom(1280,800,true));
    expect(captureCameraZoom(1280,800,CAPTURE_RECALL_END_SECONDS-0.1)).toBe(close);
    expect(captureCameraZoom(1280,800,CAPTURE_ZOOM_OUT_END_SECONDS)).toBe(cameraZoom(1280,800,false));
  });
});
