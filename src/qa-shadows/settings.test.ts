import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, groupShadowOffset, groupShadowValues, parseShadowSettings, shadowSunOffset } from './settings';
import { SUN_OFFSET } from '../render/sun';
import { SHADOW_CALIBRATION, shadowGroupOffset as gameShadowOffset } from '../render/shadowCalibration';

describe('laboratório de sombras',()=>{
  it('abre perto da posição solar atual do jogo',()=>{
    const sun=shadowSunOffset(DEFAULT_SETTINGS);
    expect(sun.y).toBe(SUN_OFFSET.y);
    expect(sun.x).toBeCloseTo(SUN_OFFSET.x,0);
    expect(sun.z).toBeCloseTo(SUN_OFFSET.z,0);
  });
  it('abre com os seis perfis aprovados para o jogo',()=>{
    expect(parseShadowSettings('')).toEqual(DEFAULT_SETTINGS);
    for(const group of ['personagens','casas','arvores','pedras','plantas','objetos'] as const){
      expect(groupShadowValues(DEFAULT_SETTINGS,group)).toEqual(SHADOW_CALIBRATION.groups[group]);
      expect(groupShadowOffset(DEFAULT_SETTINGS,group)).toEqual(gameShadowOffset(group));
    }
  });
  it('converte os controles de tela em deslocamento no plano do mapa',()=>{
    const right=groupShadowOffset({...DEFAULT_SETTINGS,houseShadowSide:1,houseShadowDepth:0},'casas');
    expect(right.x).toBeCloseTo(Math.SQRT1_2);
    expect(right.z).toBeCloseTo(-Math.SQRT1_2);
    const down=groupShadowOffset({...DEFAULT_SETTINGS,treeShadowSide:0,treeShadowDepth:1},'arvores');
    expect(down.x).toBeCloseTo(Math.SQRT1_2);
    expect(down.z).toBeCloseTo(Math.SQRT1_2);
    expect(groupShadowOffset({...DEFAULT_SETTINGS,houseShadowSide:1},'personagens'))
      .toEqual(groupShadowOffset(DEFAULT_SETTINGS,'personagens'));
  });
  it('leva os controles antigos dos objetos para casas, árvores e objetos sem afetar personagens',()=>{
    const settings=parseShadowSettings('?objectHeightScale=1.75&objectShadowSide=0.3&objectShadowDepth=-0.4');
    for(const group of ['casas','arvores','objetos'] as const){
      expect(groupShadowValues(settings,group)).toEqual({heightScale:1.75,side:0.3,depth:-0.4});
    }
    expect(groupShadowValues(settings,'personagens')).toEqual(SHADOW_CALIBRATION.groups.personagens);
    const overridden=parseShadowSettings('?objectShadowSide=0.3&houseShadowSide=-0.7');
    expect(groupShadowValues(overridden,'casas').side).toBe(-0.7);
    expect(groupShadowValues(overridden,'arvores').side).toBe(0.3);
    const olderLink=parseShadowSettings('?objectShadowSide=-0.2',
      {houseShadowSide:1.1,objectShadowSide:0.8});
    expect(groupShadowValues(olderLink,'casas').side).toBe(-0.2);
    expect(Object.keys(olderLink)).not.toContain('objectShadowSide');
  });
  it('inicia pedras e plantas com o antigo perfil de objetos, permitindo ajustes independentes',()=>{
    const migrated=parseShadowSettings('?propHeightScale=0.85&propShadowSide=0.05&propShadowDepth=-0.6');
    expect(groupShadowValues(migrated,'pedras')).toEqual({heightScale:0.85,side:0.05,depth:-0.6});
    expect(groupShadowValues(migrated,'plantas')).toEqual({heightScale:0.85,side:0.05,depth:-0.6});
    const changed=parseShadowSettings('?propShadowSide=0.05&stoneShadowSide=0.4&plantShadowSide=-0.2');
    expect(groupShadowValues(changed,'pedras').side).toBe(0.4);
    expect(groupShadowValues(changed,'plantas').side).toBe(-0.2);
    expect(groupShadowValues(changed,'objetos').side).toBe(0.05);
  });
});
