import { describe, expect, it } from 'vitest';
import { PROP_SIZE } from '../game/assets';
import { SHADOW_CALIBRATION, calibratedCasterHeight, shadowGroupForAsset,
  shadowGroupOffset } from './shadowCalibration';

describe('calibração das sombras aprovada',()=>{
  it('classifica os assets do mapa nas famílias usadas no laboratório',()=>{
    for(const asset of Object.keys(PROP_SIZE)){
      expect(['arvores','pedras','plantas','objetos']).toContain(shadowGroupForAsset(asset));
    }
    expect(shadowGroupForAsset('casa-cartas')).toBe('casas');
    expect(shadowGroupForAsset('boathouse')).toBe('casas');
    expect(shadowGroupForAsset('tree')).toBe('arvores');
    expect(shadowGroupForAsset('rock')).toBe('pedras');
    expect(shadowGroupForAsset('flower-bush')).toBe('plantas');
    expect(shadowGroupForAsset('village-lamp')).toBe('objetos');
  });
  it('desloca só a sombra e escala a altura pela família',()=>{
    const house=shadowGroupOffset('casas');
    expect(house.x).toBeCloseTo(-1.75*Math.SQRT1_2);
    expect(house.z).toBeCloseTo(-1.75*Math.SQRT1_2);
    expect(calibratedCasterHeight(8,'casas')).toBeCloseTo(4.4*1.45);
    expect(calibratedCasterHeight(2,'personagens')).toBeCloseTo(1.8);
    expect(SHADOW_CALIBRATION.sunOffset).toEqual({x:-24.4,y:72,z:-15.84});
  });
  it('mantém os parâmetros atualizados de cada grupo',()=>{
    expect(SHADOW_CALIBRATION.groups).toEqual({
      personagens:{heightScale:0.9,side:0,depth:-0.05},
      casas:{heightScale:1.45,side:0,depth:-1.75},
      arvores:{heightScale:0.65,side:0.1,depth:-0.55},
      pedras:{heightScale:1.2,side:0,depth:-0.6},
      plantas:{heightScale:1.2,side:0.05,depth:-0.6},
      objetos:{heightScale:0.7,side:0.1,depth:-0.5}
    });
  });
});
