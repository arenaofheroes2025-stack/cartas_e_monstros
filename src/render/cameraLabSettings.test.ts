import { describe, expect, it } from 'vitest';
import { DEFAULT_CAMERA_LAB_SETTINGS, cameraLabExport, cameraOffsetForSettings,
  sanitizeCameraLabSettings } from './cameraLabSettings';

describe('perfil padrão da câmera',()=>{
  it('usa o enquadramento aprovado no jogo e na batalha',()=>{
    expect(cameraOffsetForSettings(DEFAULT_CAMERA_LAB_SETTINGS).length()).toBeCloseTo(28.8);
    const exported=JSON.parse(cameraLabExport(DEFAULT_CAMERA_LAB_SETTINGS,1912,948));
    expect(exported.zoomAtualPixelsPorUnidade).toBe(92.82);
    expect(exported.campoDeVisaoGraus).toBe(20.11);
    expect(exported.camera.focusX).toBe(-3.9);
    expect(exported.camera.blurFocusOffset).toBe(-2.5);
  });
  it('rejeita valores inválidos e limita os controles',()=>{
    const settings=sanitizeCameraLabSettings({zoomScale:100,elevation:-40,
      blurEnabled:false,spriteMode:'acompanhar',spriteStretch:Number.NaN});
    expect(settings.zoomScale).toBe(1.6);
    expect(settings.elevation).toBe(20);
    expect(settings.blurEnabled).toBe(false);
    expect(settings.spriteMode).toBe('acompanhar');
    expect(settings.spriteStretch).toBe(DEFAULT_CAMERA_LAB_SETTINGS.spriteStretch);
  });
});
