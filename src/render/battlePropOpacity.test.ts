import { describe,expect,it } from 'vitest';
import { BATTLE_INTRO_SECONDS, BATTLE_RECALL_END_SECONDS, BATTLE_ZOOM_OUT_END_SECONDS, CAPTURE_RECALL_END_SECONDS, CAPTURE_ZOOM_OUT_END_SECONDS } from '../game/game';
import { battlePropOpacity } from './battlePropOpacity';

describe('transição dos objetos da arena',()=>{
  it('suaviza a entrada e acompanha o zoom de saída',()=>{
    expect(battlePropOpacity({intro:BATTLE_INTRO_SECONDS},1,0.05)).toBe(1);
    const entering=battlePropOpacity({intro:BATTLE_INTRO_SECONDS-0.4},1,0.05);
    expect(entering).toBeGreaterThan(0);
    expect(entering).toBeLessThan(1);
    expect(battlePropOpacity({intro:0},entering,0.05)).toBe(0);
    expect(battlePropOpacity({intro:0,finisher:{elapsed:BATTLE_RECALL_END_SECONDS}},0,0.05)).toBe(0);
    const returning=battlePropOpacity({intro:0,finisher:{elapsed:(BATTLE_RECALL_END_SECONDS+BATTLE_ZOOM_OUT_END_SECONDS)/2}},0,0.05);
    expect(returning).toBeGreaterThan(0);
    expect(returning).toBeLessThan(1);
    expect(battlePropOpacity({intro:0,finisher:{elapsed:BATTLE_ZOOM_OUT_END_SECONDS}},0,0.05)).toBe(1);
  });

  it('recupera os objetos gradualmente após captura ou fuga',()=>{
    expect(battlePropOpacity({intro:0,captureSequence:{elapsed:CAPTURE_RECALL_END_SECONDS,success:true}},0,0.05)).toBe(0);
    expect(battlePropOpacity({intro:0,captureSequence:{elapsed:(CAPTURE_RECALL_END_SECONDS+CAPTURE_ZOOM_OUT_END_SECONDS)/2,success:true}},0,0.05)).toBeGreaterThan(0);
    expect(battlePropOpacity({intro:0,captureSequence:{elapsed:CAPTURE_ZOOM_OUT_END_SECONDS,success:true}},0,0.05)).toBe(1);
    expect(battlePropOpacity({intro:0,captureSequence:{elapsed:1,success:false}},0,0.05)).toBe(0);
    expect(battlePropOpacity(null,0,0.1)).toBeGreaterThan(0);
    expect(battlePropOpacity(null,0,0.1)).toBeLessThan(1);
    expect(battlePropOpacity(null,0.9,0.1)).toBe(1);
  });
});
