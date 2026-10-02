import { describe, expect, it } from 'vitest';
import { daylightPhase, strongSunPhase, townLightPhase } from './daylightPhase';

describe('luz ao longo do dia',()=>{
  it('é clara ao meio-dia, aquece no fim da tarde e cede à noite',()=>{
    expect(daylightPhase(8).morning).toBeGreaterThan(0.7);
    expect(daylightPhase(12)).toEqual({daylight:1,morning:0,warmth:0});
    expect(daylightPhase(16).warmth).toBeGreaterThan(0.9);
    expect(daylightPhase(17.5).warmth).toBeGreaterThan(0);
    expect(daylightPhase(17).daylight).toBe(1);
    expect(daylightPhase(17.5).daylight).toBeGreaterThan(daylightPhase(18).daylight);
    expect(daylightPhase(18).daylight).toBeGreaterThan(0);
    expect(daylightPhase(6).daylight).toBe(0);
    expect(daylightPhase(18.5).daylight).toBe(0);
    expect(daylightPhase(22)).toEqual({daylight:0,morning:0,warmth:0});
  });

  it('acende as luzes da cidade durante o crepúsculo',()=>{
    expect(townLightPhase(17.5)).toBe(0);
    expect(townLightPhase(18)).toBeCloseTo(0.5);
    expect(townLightPhase(18.5)).toBe(1);
    expect(townLightPhase(22)).toBe(1);
    expect(townLightPhase(7.5)).toBe(0);
  });

  it('reforça as sombras entre 10h e 17h sem salto na entrada ou no entardecer',()=>{
    expect(strongSunPhase(8)).toBe(0);
    expect(strongSunPhase(9.5)).toBeGreaterThan(0);
    expect(strongSunPhase(9.5)).toBeLessThan(1);
    for(const hour of [10,12,16,17])expect(strongSunPhase(hour)).toBe(1);
    expect(strongSunPhase(17.5)).toBeGreaterThan(0);
    expect(strongSunPhase(17.5)).toBeLessThan(1);
    expect(strongSunPhase(18)).toBe(0);
    expect(strongSunPhase(22)).toBe(0);
    for(const hour of [9,10,17,18])
      expect(Math.abs(strongSunPhase(hour+0.01)-strongSunPhase(hour-0.01))).toBeLessThan(0.01);
  });

  it('transita sem saltos nos horários em que as cores mudam',()=>{
    for(const hour of [6,7,7.5,10.5,14,16,17,17.5,18,18.5]){
      const before=daylightPhase(hour-0.01),after=daylightPhase(hour+0.01);
      expect(Math.abs(after.daylight-before.daylight)).toBeLessThan(0.02);
      expect(Math.abs(after.morning-before.morning)).toBeLessThan(0.02);
      expect(Math.abs(after.warmth-before.warmth)).toBeLessThan(0.02);
    }
  });
});
